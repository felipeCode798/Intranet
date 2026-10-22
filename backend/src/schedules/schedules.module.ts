import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Injectable,
  Module,
  NotFoundException,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsHexColor,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { ScheduleMode } from '@prisma/client';
import { AuthUser, canManageCompany, isLeaderOf, isSuper } from '../common/auth-user';
import { CurrentUser } from '../common/decorators';
import { addDays, DATE_RE, dateOnly, fmtDay, TIME_RE, todayBogota } from '../common/dates';
import { RequireModule } from '../common/modules';
import { USER_PUBLIC } from '../common/user-select';
import { NoticeService } from '../notice/notice.module';
import { PrismaService } from '../prisma/prisma.service';

const MAX_RANGE_DAYS = 93;

class TemplateDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(40) name?: string;
  @IsOptional() @Matches(TIME_RE, { message: 'Hora de inicio inválida (HH:mm)' }) startTime?: string;
  @IsOptional() @Matches(TIME_RE, { message: 'Hora de fin inválida (HH:mm)' }) endTime?: string;
  @IsOptional() @IsHexColor() color?: string;
  @IsOptional() @IsBoolean() isRest?: boolean;
  @IsOptional() @IsBoolean() active?: boolean;
}

class ModeDto {
  @IsIn(['FIXED', 'DAILY', 'WEEKLY', 'ROTATING']) mode: ScheduleMode;
}

class EntryDto {
  @IsString() userId: string;
  @Matches(DATE_RE, { message: 'Fecha inválida' }) date: string;
  /** Turno predefinido del área; si se omite se usan startTime/endTime */
  @IsOptional() @IsString() templateId?: string | null;
  @IsOptional() @Matches(TIME_RE) startTime?: string;
  @IsOptional() @Matches(TIME_RE) endTime?: string;
  @IsOptional() @IsBoolean() isRest?: boolean;
  @IsOptional() @IsString() @MaxLength(200) note?: string;
  /** Quita el horario de ese día */
  @IsOptional() @IsBoolean() clear?: boolean;
}

class BulkDto {
  @IsArray() @ArrayMaxSize(3000) @ValidateNested({ each: true }) @Type(() => EntryDto) entries: EntryDto[];
}

class RangeQuery {
  @IsOptional() @Matches(DATE_RE) from?: string;
  @IsOptional() @Matches(DATE_RE) to?: string;
}

@Injectable()
export class SchedulesService {
  constructor(
    private prisma: PrismaService,
    private notice: NoticeService,
  ) {}

  private range(q: RangeQuery) {
    const today = todayBogota();
    // Semana actual (lunes a domingo) por defecto
    const dow = (new Date(`${today}T12:00:00Z`).getUTCDay() + 6) % 7;
    const from = q.from || addDays(today, -dow);
    const to = q.to || addDays(from, 6);
    if (to < from) throw new BadRequestException('El rango de fechas es inválido');
    if ((dateOnly(to).getTime() - dateOnly(from).getTime()) / 86400000 > MAX_RANGE_DAYS) throw new BadRequestException(`Máximo ${MAX_RANGE_DAYS} días por consulta`);
    return { from, to };
  }

  private shapeEntry(e: { date: Date; [k: string]: any }) {
    return { ...e, date: fmtDay(e.date) };
  }

  /** Horario vigente de una persona en un día (lo usa la asistencia) */
  async entryFor(userId: string, day: string) {
    return this.prisma.scheduleEntry.findUnique({ where: { userId_date: { userId, date: dateOnly(day) } } });
  }

  async mine(u: AuthUser, q: RangeQuery) {
    const { from, to } = this.range(q);
    const entries = await this.prisma.scheduleEntry.findMany({
      where: { userId: u.id, date: { gte: dateOnly(from), lte: dateOnly(to) } },
      include: { template: { select: { name: true, color: true } }, area: { select: { id: true, name: true } } },
      orderBy: { date: 'asc' },
    });
    const leaves = await this.prisma.leaveRequest.findMany({
      where: { userId: u.id, status: { in: ['PENDING', 'APPROVED'] }, startDate: { lte: dateOnly(to) }, endDate: { gte: dateOnly(from) } },
      select: { id: true, type: true, status: true, startDate: true, endDate: true },
    });
    return {
      from,
      to,
      entries: entries.map((e) => this.shapeEntry(e)),
      leaves: leaves.map((l) => ({ ...l, startDate: fmtDay(l.startDate), endDate: fmtDay(l.endDate) })),
    };
  }

  private async loadArea(areaId: string) {
    const area = await this.prisma.area.findUnique({ where: { id: areaId }, include: { companies: true } });
    if (!area || !area.active) throw new NotFoundException('Área no encontrada');
    return area;
  }

  private assertLeader(u: AuthUser, areaId: string) {
    if (!isLeaderOf(u, areaId)) throw new ForbiddenException('Solo el líder del área asigna los horarios');
  }

  async areaView(u: AuthUser, areaId: string, q: RangeQuery) {
    const area = await this.loadArea(areaId);
    const admin = isSuper(u) || (!area.isShared && area.companies.some((c) => canManageCompany(u, c.companyId)));
    if (!admin && !isLeaderOf(u, areaId)) throw new ForbiddenException('No puedes ver los horarios de esta área');
    const { from, to } = this.range(q);
    const [templates, members, entries] = await Promise.all([
      this.prisma.shiftTemplate.findMany({ where: { areaId, active: true }, orderBy: [{ isRest: 'asc' }, { startTime: 'asc' }] }),
      this.prisma.areaMember.findMany({
        where: { areaId, user: { active: true } },
        include: { user: { select: USER_PUBLIC } },
        orderBy: [{ role: 'asc' }, { user: { name: 'asc' } }],
      }),
      this.prisma.scheduleEntry.findMany({
        where: { areaId, date: { gte: dateOnly(from), lte: dateOnly(to) } },
        include: { template: { select: { name: true, color: true } } },
      }),
    ]);
    const leaves = await this.prisma.leaveRequest.findMany({
      where: {
        userId: { in: members.map((m) => m.userId) },
        status: { in: ['PENDING', 'APPROVED'] },
        startDate: { lte: dateOnly(to) },
        endDate: { gte: dateOnly(from) },
      },
      select: { id: true, userId: true, type: true, status: true, startDate: true, endDate: true },
    });
    return {
      from,
      to,
      area: { id: area.id, name: area.name, scheduleMode: area.scheduleMode },
      canEdit: isLeaderOf(u, areaId),
      templates,
      members: members.map((m) => ({ role: m.role, ...m.user })),
      entries: entries.map((e) => this.shapeEntry(e)),
      leaves: leaves.map((l) => ({ ...l, startDate: fmtDay(l.startDate), endDate: fmtDay(l.endDate) })),
    };
  }

  async setMode(u: AuthUser, areaId: string, mode: ScheduleMode) {
    await this.loadArea(areaId);
    this.assertLeader(u, areaId);
    return this.prisma.area.update({ where: { id: areaId }, data: { scheduleMode: mode }, select: { id: true, scheduleMode: true } });
  }

  private validateTemplate(t: TemplateDto, partial: boolean) {
    if (!partial && !t.name) throw new BadRequestException('El turno necesita un nombre');
    if (!t.isRest && !partial && (!t.startTime || !t.endTime)) throw new BadRequestException('Indica la hora de inicio y fin del turno');
    if (t.startTime && t.endTime && t.startTime === t.endTime) throw new BadRequestException('La hora de inicio y fin no pueden ser iguales');
  }

  async createTemplate(u: AuthUser, areaId: string, dto: TemplateDto) {
    await this.loadArea(areaId);
    this.assertLeader(u, areaId);
    this.validateTemplate(dto, false);
    return this.prisma.shiftTemplate.create({
      data: {
        areaId,
        name: dto.name!.trim(),
        startTime: dto.isRest ? '00:00' : dto.startTime!,
        endTime: dto.isRest ? '00:00' : dto.endTime!,
        color: dto.color || (dto.isRest ? '#9998b3' : '#6457f5'),
        isRest: !!dto.isRest,
      },
    });
  }

  async updateTemplate(u: AuthUser, id: string, dto: TemplateDto) {
    const t = await this.prisma.shiftTemplate.findUnique({ where: { id } });
    if (!t) throw new NotFoundException('Turno no encontrado');
    this.assertLeader(u, t.areaId);
    this.validateTemplate(dto, true);
    const { isRest: _ignored, ...rest } = dto; // un turno no cambia de tipo: crea otro
    return this.prisma.shiftTemplate.update({ where: { id }, data: { ...rest, ...(dto.name ? { name: dto.name.trim() } : {}) } });
  }

  async bulk(u: AuthUser, areaId: string, dto: BulkDto) {
    await this.loadArea(areaId);
    this.assertLeader(u, areaId);
    if (!dto.entries.length) return { saved: 0, cleared: 0, skipped: [] as { userId: string; date: string; reason: string }[] };

    const members = new Set((await this.prisma.areaMember.findMany({ where: { areaId }, select: { userId: true } })).map((m) => m.userId));
    const templates = new Map((await this.prisma.shiftTemplate.findMany({ where: { areaId } })).map((t) => [t.id, t]));
    const userIds = [...new Set(dto.entries.map((e) => e.userId))];
    const dates = dto.entries.map((e) => e.date).sort();
    const existing = await this.prisma.scheduleEntry.findMany({
      where: { userId: { in: userIds }, date: { gte: dateOnly(dates[0]), lte: dateOnly(dates[dates.length - 1]) } },
      select: { userId: true, date: true, areaId: true },
    });
    const owner = new Map(existing.map((e) => [`${e.userId}|${fmtDay(e.date)}`, e.areaId]));

    const skipped: { userId: string; date: string; reason: string }[] = [];
    const ops: any[] = [];
    let saved = 0;
    let cleared = 0;
    const touched = new Set<string>();

    for (const e of dto.entries) {
      if (!members.has(e.userId)) {
        skipped.push({ userId: e.userId, date: e.date, reason: 'No pertenece al área' });
        continue;
      }
      const key = `${e.userId}|${e.date}`;
      const otherArea = owner.get(key) && owner.get(key) !== areaId;
      if (otherArea) {
        skipped.push({ userId: e.userId, date: e.date, reason: 'Ya tiene horario asignado por otra área' });
        continue;
      }
      if (e.clear) {
        ops.push(this.prisma.scheduleEntry.deleteMany({ where: { userId: e.userId, areaId, date: dateOnly(e.date) } }));
        cleared++;
        touched.add(e.userId);
        continue;
      }
      let startTime = e.startTime ?? null;
      let endTime = e.endTime ?? null;
      let isRest = !!e.isRest;
      let templateId: string | null = null;
      if (e.templateId) {
        const t = templates.get(e.templateId);
        if (!t || !t.active) {
          skipped.push({ userId: e.userId, date: e.date, reason: 'El turno elegido no existe' });
          continue;
        }
        templateId = t.id;
        isRest = t.isRest;
        startTime = t.isRest ? null : t.startTime;
        endTime = t.isRest ? null : t.endTime;
      } else if (!isRest && (!startTime || !endTime)) {
        skipped.push({ userId: e.userId, date: e.date, reason: 'Falta la hora de inicio o fin' });
        continue;
      }
      if (isRest) {
        startTime = null;
        endTime = null;
      }
      const data = { areaId, templateId, startTime, endTime, isRest, note: e.note?.trim() || null, createdById: u.id };
      ops.push(
        this.prisma.scheduleEntry.upsert({
          where: { userId_date: { userId: e.userId, date: dateOnly(e.date) } },
          update: data,
          create: { userId: e.userId, date: dateOnly(e.date), ...data },
        }),
      );
      saved++;
      touched.add(e.userId);
    }

    for (let i = 0; i < ops.length; i += 200) await this.prisma.$transaction(ops.slice(i, i + 200));

    const others = [...touched].filter((id) => id !== u.id);
    if (others.length) {
      const area = await this.loadArea(areaId);
      await this.notice.send({
        userIds: others,
        type: 'SCHEDULE_UPDATED',
        title: 'Tu horario fue actualizado',
        body: `${u.name} actualizó tu horario en ${area.name}.`,
        path: '/app/horarios',
      });
    }
    return { saved, cleared, skipped };
  }
}

@RequireModule('schedules')
@Controller('schedules')
export class SchedulesController {
  constructor(private svc: SchedulesService) {}

  @Get('me')
  mine(@CurrentUser() u: AuthUser, @Query() q: RangeQuery) {
    return this.svc.mine(u, q);
  }

  @Get('areas/:areaId')
  area(@CurrentUser() u: AuthUser, @Param('areaId') areaId: string, @Query() q: RangeQuery) {
    return this.svc.areaView(u, areaId, q);
  }

  @Patch('areas/:areaId/mode')
  setMode(@CurrentUser() u: AuthUser, @Param('areaId') areaId: string, @Body() dto: ModeDto) {
    return this.svc.setMode(u, areaId, dto.mode);
  }

  @Post('areas/:areaId/templates')
  createTemplate(@CurrentUser() u: AuthUser, @Param('areaId') areaId: string, @Body() dto: TemplateDto) {
    return this.svc.createTemplate(u, areaId, dto);
  }

  @Patch('templates/:id')
  updateTemplate(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: TemplateDto) {
    return this.svc.updateTemplate(u, id, dto);
  }

  @Put('areas/:areaId/entries')
  bulk(@CurrentUser() u: AuthUser, @Param('areaId') areaId: string, @Body() dto: BulkDto) {
    return this.svc.bulk(u, areaId, dto);
  }
}

@Module({ controllers: [SchedulesController], providers: [SchedulesService], exports: [SchedulesService] })
export class SchedulesModule {}
