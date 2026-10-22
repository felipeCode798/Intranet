import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpException,
  HttpStatus,
  Injectable,
  Module,
  Post,
  Query,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AttendanceRecord, AttendanceType, Prisma } from '@prisma/client';
import { createHmac, randomInt, timingSafeEqual } from 'crypto';
import { IsOptional, IsString, Matches } from 'class-validator';
import { AuthUser } from '../common/auth-user';
import { CurrentUser } from '../common/decorators';
import { addDays, atBogota, crossesMidnight, DATE_RE, dateOnly, fmtDay, minutesBetween, todayBogota } from '../common/dates';
import { RequireModule } from '../common/modules';
import { MailService, renderEmail } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { SchedulesModule, SchedulesService } from '../schedules/schedules.module';

/** Vigencia del código y límites para que no se pueda adivinar ni usar de forma masiva */
const CODE_TTL_MIN = 10;
const RESEND_COOLDOWN_S = 60;
const MAX_ATTEMPTS = 5;
/** Tolerancia antes de marcar tarde / salida anticipada */
const GRACE_MIN = 10;
/** Una entrada abierta hace más de esto se considera olvidada (no bloquea la siguiente entrada) */
const OPEN_SHIFT_MAX_HOURS = 20;
const MAX_TEAM_DAYS = 31;

class VerifyDto {
  @IsString() @Matches(/^\d{6}$/, { message: 'El código tiene 6 dígitos' }) code: string;
}

class TeamQuery {
  @IsOptional() @Matches(DATE_RE) from?: string;
  @IsOptional() @Matches(DATE_RE) to?: string;
  @IsOptional() @IsString() areaId?: string;
  @IsOptional() @IsString() companyId?: string;
}

const TYPE_LABEL: Record<AttendanceType, string> = { CHECK_IN: 'entrada', CHECK_OUT: 'salida' };

const maskEmail = (e: string) => {
  const [name, domain] = e.split('@');
  return `${name.slice(0, 2)}${'•'.repeat(Math.max(2, name.length - 2))}@${domain}`;
};

export interface DaySummary {
  date: string;
  firstIn: string | null;
  lastOut: string | null;
  workedMinutes: number;
  open: boolean;
  punctuality: string | null;
  earlyLeave: boolean;
  records: { id: string; type: AttendanceType; at: Date; punctuality: string | null; deviationMinutes: number | null }[];
}

/** Agrupa los registros de una persona por día laboral */
function summarizeDays(records: AttendanceRecord[]): DaySummary[] {
  const byDay = new Map<string, AttendanceRecord[]>();
  for (const r of records) byDay.set(fmtDay(r.workDate), [...(byDay.get(fmtDay(r.workDate)) || []), r]);
  return [...byDay.entries()]
    .map(([date, rs]) => {
      rs.sort((a, b) => a.at.getTime() - b.at.getTime());
      let worked = 0;
      let openAt: Date | null = null;
      for (const r of rs) {
        if (r.type === 'CHECK_IN') openAt = openAt ?? r.at;
        else if (openAt) {
          worked += minutesBetween(openAt, r.at);
          openAt = null;
        }
      }
      const firstIn = rs.find((r) => r.type === 'CHECK_IN');
      const outs = rs.filter((r) => r.type === 'CHECK_OUT');
      const lastOut = outs[outs.length - 1];
      return {
        date,
        firstIn: firstIn?.at.toISOString() ?? null,
        lastOut: lastOut?.at.toISOString() ?? null,
        workedMinutes: worked,
        open: !!openAt,
        punctuality: firstIn?.punctuality ?? null,
        earlyLeave: lastOut?.punctuality === 'EARLY_LEAVE',
        records: rs.map(({ id, type, at, punctuality, deviationMinutes }) => ({ id, type, at, punctuality, deviationMinutes })),
      };
    })
    .sort((a, b) => (a.date < b.date ? 1 : -1));
}

@Injectable()
export class AttendanceService {
  private readonly secret: string;

  constructor(
    private prisma: PrismaService,
    private mail: MailService,
    private schedules: SchedulesService,
    config: ConfigService,
  ) {
    this.secret = config.get<string>('JWT_SECRET', 'dev-secret');
  }

  /** El código se liga al usuario: HMAC(secreto, usuario + código) */
  private hash(userId: string, code: string) {
    return createHmac('sha256', this.secret).update(`${userId}:${code}`).digest('hex');
  }

  private async nextType(userId: string): Promise<{ type: AttendanceType; open: AttendanceRecord | null }> {
    const last = await this.prisma.attendanceRecord.findFirst({ where: { userId }, orderBy: { at: 'desc' } });
    const open = last && last.type === 'CHECK_IN' && Date.now() - last.at.getTime() < OPEN_SHIFT_MAX_HOURS * 3600000 ? last : null;
    return { type: open ? 'CHECK_OUT' : 'CHECK_IN', open };
  }

  async me(u: AuthUser) {
    const today = todayBogota();
    const [{ type, open }, entry, records, pendingCode] = await Promise.all([
      this.nextType(u.id),
      this.schedules.entryFor(u.id, today),
      this.prisma.attendanceRecord.findMany({ where: { userId: u.id, workDate: { gte: dateOnly(addDays(today, -30)) } }, orderBy: { at: 'asc' } }),
      this.prisma.attendanceCode.findFirst({ where: { userId: u.id, usedAt: null, expiresAt: { gt: new Date() } }, orderBy: { createdAt: 'desc' } }),
    ]);
    const days = summarizeDays(records);
    return {
      nextType: type,
      openSince: open?.at ?? null,
      today,
      schedule: entry && { isRest: entry.isRest, startTime: entry.startTime, endTime: entry.endTime },
      todayRecords: days.find((d) => d.date === today)?.records ?? [],
      history: days,
      pendingCode: pendingCode && {
        type: pendingCode.type,
        expiresAt: pendingCode.expiresAt,
        resendAt: new Date(pendingCode.createdAt.getTime() + RESEND_COOLDOWN_S * 1000),
        attemptsLeft: MAX_ATTEMPTS - pendingCode.attempts,
      },
      config: { codeTtlMinutes: CODE_TTL_MIN, graceMinutes: GRACE_MIN },
    };
  }

  /** Genera un código de 6 dígitos y lo envía al correo del usuario autenticado */
  async requestCode(u: AuthUser) {
    const now = new Date();
    const recent = await this.prisma.attendanceCode.findFirst({ where: { userId: u.id }, orderBy: { createdAt: 'desc' } });
    if (recent) {
      const wait = Math.ceil((recent.createdAt.getTime() + RESEND_COOLDOWN_S * 1000 - now.getTime()) / 1000);
      if (wait > 0) throw new HttpException(`Espera ${wait} segundos para pedir otro código`, HttpStatus.TOO_MANY_REQUESTS);
    }
    const { type } = await this.nextType(u.id);
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: u.id }, select: { email: true, company: { select: { name: true, primaryColor: true } } } });

    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    await this.prisma.attendanceCode.updateMany({ where: { userId: u.id, usedAt: null }, data: { usedAt: now } });
    const row = await this.prisma.attendanceCode.create({
      data: { userId: u.id, type, codeHash: this.hash(u.id, code), expiresAt: new Date(now.getTime() + CODE_TTL_MIN * 60000) },
    });

    const status = await this.mail.send({
      to: [user.email],
      subject: `Tu código para registrar la ${TYPE_LABEL[type]}: ${code}`,
      event: 'ATTENDANCE_CODE',
      html: renderEmail({
        color: user.company?.primaryColor,
        companyName: user.company?.name,
        heading: `Código de ${TYPE_LABEL[type]}`,
        intro: `Hola ${u.name.split(' ')[0]}, usa este código para registrar tu ${TYPE_LABEL[type]}. Vence en ${CODE_TTL_MIN} minutos y solo funciona con tu sesión.`,
        code,
        message: { label: 'Importante', text: 'No compartas este código. Si no lo pediste tú, ignora este mensaje.' },
        tone: 'warning',
      }),
    });
    if (status !== 'SENT') {
      await this.prisma.attendanceCode.delete({ where: { id: row.id } });
      throw new HttpException(
        status === 'DISABLED'
          ? 'El envío de correos está desactivado por el administrador, por eso no se puede enviar el código de asistencia'
          : status === 'SKIPPED'
            ? 'El envío de correo no está configurado en el servidor'
            : 'No pudimos enviar el correo con el código. Inténtalo de nuevo.',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    return {
      type,
      sentTo: maskEmail(user.email),
      expiresAt: row.expiresAt,
      resendAt: new Date(row.createdAt.getTime() + RESEND_COOLDOWN_S * 1000),
      attemptsLeft: MAX_ATTEMPTS,
    };
  }

  /**
   * Comprueba el código contra los códigos emitidos A ESTE usuario (el de la sesión).
   * Un código de otra persona nunca coincide porque ni se busca ni su hash incluye este usuario.
   */
  async verify(u: AuthUser, input: string) {
    const now = new Date();
    const row = await this.prisma.attendanceCode.findFirst({
      where: { userId: u.id, usedAt: null, expiresAt: { gt: now } },
      orderBy: { createdAt: 'desc' },
    });
    if (!row) throw new BadRequestException('No hay un código vigente. Solicita uno nuevo.');
    if (row.attempts >= MAX_ATTEMPTS) {
      await this.prisma.attendanceCode.update({ where: { id: row.id }, data: { usedAt: now } });
      throw new BadRequestException('Superaste los intentos permitidos. Solicita un código nuevo.');
    }

    const given = Buffer.from(this.hash(u.id, input));
    const stored = Buffer.from(row.codeHash);
    if (given.length !== stored.length || !timingSafeEqual(given, stored)) {
      const updated = await this.prisma.attendanceCode.update({ where: { id: row.id }, data: { attempts: { increment: 1 } } });
      const left = MAX_ATTEMPTS - updated.attempts;
      if (left <= 0) await this.prisma.attendanceCode.update({ where: { id: row.id }, data: { usedAt: now } });
      throw new BadRequestException(left > 0 ? `Código incorrecto. Te quedan ${left} intento(s).` : 'Código incorrecto. Solicita un código nuevo.');
    }

    // Consumo atómico: si dos peticiones llegan a la vez solo una gana
    const consumed = await this.prisma.attendanceCode.updateMany({ where: { id: row.id, usedAt: null }, data: { usedAt: now } });
    if (!consumed.count) throw new BadRequestException('Este código ya fue usado');

    const { type, open } = await this.nextType(u.id);
    if (type !== row.type) throw new BadRequestException(`Ya no corresponde registrar la ${TYPE_LABEL[row.type]}. Actualiza la página.`);

    const workDate = open ? fmtDay(open.workDate) : todayBogota(now);
    const entry = await this.schedules.entryFor(u.id, workDate);
    let punctuality = 'NO_SCHEDULE';
    let expectedTime: string | null = null;
    let deviation: number | null = null;
    if (entry?.isRest) punctuality = 'REST_DAY';
    else if (entry?.startTime && entry.endTime) {
      if (type === 'CHECK_IN') {
        expectedTime = entry.startTime;
        deviation = Math.max(0, minutesBetween(atBogota(workDate, entry.startTime), now));
        punctuality = deviation > GRACE_MIN ? 'LATE' : 'ON_TIME';
      } else {
        expectedTime = entry.endTime;
        const endDay = crossesMidnight(entry.startTime, entry.endTime) ? addDays(workDate, 1) : workDate;
        deviation = Math.max(0, minutesBetween(now, atBogota(endDay, entry.endTime)));
        punctuality = deviation > GRACE_MIN ? 'EARLY_LEAVE' : 'ON_TIME';
      }
    }

    const record = await this.prisma.attendanceRecord.create({
      data: { userId: u.id, type, at: now, workDate: dateOnly(workDate), expectedTime, deviationMinutes: deviation, punctuality },
    });
    return { record, message: type === 'CHECK_IN' ? 'Entrada registrada' : 'Salida registrada' };
  }

  // ------------------------------------------------------------------ equipo
  private async scopeUsers(u: AuthUser, q: TeamQuery) {
    const where: Prisma.UserWhereInput = { active: true };
    if (u.role === 'SUPER_ADMIN') {
      if (q.companyId) where.companyId = q.companyId;
      if (q.areaId) where.memberships = { some: { areaId: q.areaId } };
    } else if (u.role === 'COMPANY_ADMIN') {
      where.companyId = u.companyId;
      if (q.areaId) where.memberships = { some: { areaId: q.areaId } };
    } else if (u.leaderAreaIds.length) {
      if (q.areaId && !u.leaderAreaIds.includes(q.areaId)) throw new ForbiddenException();
      where.memberships = { some: { areaId: q.areaId ? q.areaId : { in: u.leaderAreaIds } } };
    } else throw new ForbiddenException('Solo los líderes y administradores ven la asistencia del equipo');
    return this.prisma.user.findMany({
      where,
      select: { id: true, name: true, avatarUrl: true, jobTitle: true },
      orderBy: { name: 'asc' },
      take: 300,
    });
  }

  async team(u: AuthUser, q: TeamQuery) {
    const today = todayBogota();
    const from = q.from || today;
    const to = q.to || from;
    if (to < from) throw new BadRequestException('El rango de fechas es inválido');
    if ((dateOnly(to).getTime() - dateOnly(from).getTime()) / 86400000 >= MAX_TEAM_DAYS) throw new BadRequestException(`Máximo ${MAX_TEAM_DAYS} días por consulta`);

    const users = await this.scopeUsers(u, q);
    const ids = users.map((x) => x.id);
    const range = { gte: dateOnly(from), lte: dateOnly(to) };
    const [records, entries, leaves] = await Promise.all([
      this.prisma.attendanceRecord.findMany({ where: { userId: { in: ids }, workDate: range }, orderBy: { at: 'asc' } }),
      this.prisma.scheduleEntry.findMany({ where: { userId: { in: ids }, date: range } }),
      this.prisma.leaveRequest.findMany({
        where: { userId: { in: ids }, status: 'APPROVED', startDate: { lte: dateOnly(to) }, endDate: { gte: dateOnly(from) } },
        select: { userId: true, type: true, startDate: true, endDate: true },
      }),
    ]);

    const recByUser = new Map<string, AttendanceRecord[]>();
    for (const r of records) recByUser.set(r.userId, [...(recByUser.get(r.userId) || []), r]);
    const entryKey = new Map(entries.map((e) => [`${e.userId}|${fmtDay(e.date)}`, e]));

    const rows: any[] = [];
    const nowMs = Date.now();
    for (const user of users) {
      const days = new Map(summarizeDays(recByUser.get(user.id) || []).map((d) => [d.date, d]));
      for (let day = from; day <= to; day = addDays(day, 1)) {
        const leave = leaves.find((l) => l.userId === user.id && fmtDay(l.startDate) <= day && fmtDay(l.endDate) >= day);
        const entry = entryKey.get(`${user.id}|${day}`);
        const sum = days.get(day);
        let status: string | null = null;
        if (leave) status = 'LEAVE';
        else if (sum) status = sum.punctuality === 'LATE' ? 'LATE' : sum.open && day < today ? 'INCOMPLETE' : 'PRESENT';
        else if (entry?.isRest) status = null;
        else if (entry?.startTime && day <= today) {
          const started = atBogota(day, entry.startTime).getTime() + GRACE_MIN * 60000;
          if (day < today || nowMs > started) status = 'ABSENT';
        }
        if (!status) continue;
        rows.push({
          userId: user.id,
          name: user.name,
          avatarUrl: user.avatarUrl,
          jobTitle: user.jobTitle,
          date: day,
          scheduled: entry && !entry.isRest ? { start: entry.startTime, end: entry.endTime } : null,
          leaveType: leave?.type ?? null,
          status,
          firstIn: sum?.firstIn ?? null,
          lastOut: sum?.lastOut ?? null,
          workedMinutes: sum?.workedMinutes ?? 0,
          open: sum?.open ?? false,
          earlyLeave: sum?.earlyLeave ?? false,
        });
      }
    }
    rows.sort((a, b) => (a.date === b.date ? a.name.localeCompare(b.name) : a.date < b.date ? 1 : -1));
    return { from, to, people: users.length, rows };
  }
}

@RequireModule('attendance')
@Controller('attendance')
export class AttendanceController {
  constructor(private svc: AttendanceService) {}

  @Get('me')
  me(@CurrentUser() u: AuthUser) {
    return this.svc.me(u);
  }

  @Post('code')
  code(@CurrentUser() u: AuthUser) {
    return this.svc.requestCode(u);
  }

  @Post('verify')
  verify(@CurrentUser() u: AuthUser, @Body() dto: VerifyDto) {
    return this.svc.verify(u, dto.code);
  }

  @Get('team')
  team(@CurrentUser() u: AuthUser, @Query() q: TeamQuery) {
    return this.svc.team(u, q);
  }
}

@Module({ imports: [SchedulesModule], controllers: [AttendanceController], providers: [AttendanceService] })
export class AttendanceModule {}
