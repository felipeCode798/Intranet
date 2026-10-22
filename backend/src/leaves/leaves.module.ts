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
  Post,
  Query,
} from '@nestjs/common';
import { LeaveStatus, LeaveType, Prisma } from '@prisma/client';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsOptional, IsString, Matches, MaxLength, MinLength, ValidateNested } from 'class-validator';
import { AuthUser, isLeaderOf, isSuper } from '../common/auth-user';
import { CurrentUser } from '../common/decorators';
import { DATE_RE, dateOnly, fmtDay, fmtLongDate, TIME_RE, todayBogota } from '../common/dates';
import { RequireModule } from '../common/modules';
import { NoticeService } from '../notice/notice.module';
import { PrismaService } from '../prisma/prisma.service';

const TYPES = ['PERSONAL', 'MEDICAL', 'STUDY', 'VACATION', 'ILLNESS', 'OTHER'];
export const LEAVE_TYPE_LABEL: Record<string, string> = {
  PERSONAL: 'Personal',
  MEDICAL: 'Médico (incapacidad)',
  STUDY: 'Estudio',
  VACATION: 'Vacaciones',
  ILLNESS: 'Enfermedad',
  OTHER: 'Otros',
};

class DocumentDto {
  @IsString() fileName: string;
  @IsString() url: string;
  @IsOptional() @IsString() mimeType?: string;
  @IsOptional() size?: number;
}

class CreateLeaveDto {
  @IsIn(TYPES) type: LeaveType;
  @Matches(DATE_RE, { message: 'Fecha de inicio inválida' }) startDate: string;
  @Matches(DATE_RE, { message: 'Fecha de fin inválida' }) endDate: string;
  /** Remunerado o no (todos menos incapacidad médica) */
  @IsOptional() @IsBoolean() paid?: boolean;
  /** ¿Regresa a la empresa ese día? */
  @IsOptional() @IsBoolean() willReturn?: boolean;
  @IsOptional() @Matches(TIME_RE, { message: 'Hora de salida inválida' }) departureTime?: string;
  @IsOptional() @Matches(TIME_RE, { message: 'Hora de regreso inválida' }) returnTime?: string;
  @IsString() @MinLength(5, { message: 'Describe el motivo del permiso' }) @MaxLength(2000) description: string;
  @IsOptional() @IsString() @MaxLength(2000) additionalReason?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(10) @ValidateNested({ each: true }) @Type(() => DocumentDto) documents?: DocumentDto[];
  /** Área cuyo líder lo aprueba (si la persona está en varias) */
  @IsOptional() @IsString() areaId?: string;
}

class DecisionDto {
  @IsOptional() @IsString() @MaxLength(1000) note?: string;
}

class ListQuery {
  @IsOptional() @IsIn(['mine', 'review', 'team']) scope?: 'mine' | 'review' | 'team';
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() areaId?: string;
}

const INCLUDE = {
  user: { select: { id: true, name: true, email: true, avatarUrl: true, jobTitle: true, companyId: true } },
  area: { select: { id: true, name: true } },
  decidedBy: { select: { id: true, name: true } },
} satisfies Prisma.LeaveRequestInclude;
type LeaveRow = Prisma.LeaveRequestGetPayload<{ include: typeof INCLUDE }>;

const code = (seq: number) => `PER-${String(seq).padStart(4, '0')}`;

@Injectable()
export class LeavesService {
  constructor(
    private prisma: PrismaService,
    private notice: NoticeService,
  ) {}

  /** ¿Puede esta persona aprobar/ver los permisos de `l`? */
  private canReview(u: AuthUser, l: Pick<LeaveRow, 'areaId' | 'userId'> & { user: { companyId: string | null } }) {
    if (l.userId === u.id) return false; // nadie aprueba su propio permiso
    if (isSuper(u)) return true;
    if (l.areaId && isLeaderOf(u, l.areaId)) return true;
    // El administrador de la intranet supervisa los permisos de su empresa
    return u.role === 'COMPANY_ADMIN' && !!u.companyId && u.companyId === l.user.companyId;
  }

  private shape(l: LeaveRow, u: AuthUser) {
    const reviewer = this.canReview(u, l);
    return {
      ...l,
      code: code(l.seq),
      startDate: fmtDay(l.startDate),
      endDate: fmtDay(l.endDate),
      permissions: {
        canDecide: reviewer && l.status === 'PENDING',
        canCancel: l.userId === u.id && ['PENDING', 'APPROVED'].includes(l.status) && fmtDay(l.endDate) >= todayBogota(),
      },
    };
  }

  async list(u: AuthUser, q: ListQuery) {
    const where: Prisma.LeaveRequestWhereInput = {};
    const scope = q.scope || 'mine';
    if (scope === 'mine') where.userId = u.id;
    else {
      // Superadministrador: todo. Líder: sus áreas. Administrador de intranet: su empresa.
      if (!isSuper(u)) {
        const scopes: Prisma.LeaveRequestWhereInput[] = [];
        if (u.leaderAreaIds.length) scopes.push({ areaId: { in: u.leaderAreaIds } });
        if (u.role === 'COMPANY_ADMIN' && u.companyId) scopes.push({ user: { companyId: u.companyId } });
        if (!scopes.length) throw new ForbiddenException('Solo los líderes y administradores ven los permisos del equipo');
        where.OR = scopes;
      }
      where.userId = { not: u.id };
      if (q.areaId) where.areaId = q.areaId;
      if (scope === 'review') where.status = 'PENDING';
    }
    if (q.status && scope !== 'review') where.status = { in: q.status.split(',').filter(Boolean) as LeaveStatus[] };
    const rows = await this.prisma.leaveRequest.findMany({ where, include: INCLUDE, orderBy: [{ createdAt: 'desc' }], take: 300 });
    return rows.map((r) => this.shape(r, u));
  }

  /** Cuántos permisos esperan decisión de esta persona (para la insignia del menú y el tablero) */
  async pendingCount(u: AuthUser) {
    if (!isSuper(u) && !u.leaderAreaIds.length && u.role !== 'COMPANY_ADMIN') return { pending: 0 };
    const rows = await this.list(u, { scope: 'review' });
    return { pending: rows.filter((r) => r.permissions.canDecide).length };
  }

  async create(u: AuthUser, dto: CreateLeaveDto) {
    const start = dto.startDate;
    const end = dto.endDate;
    if (end < start) throw new BadRequestException('La fecha fin no puede ser anterior a la fecha de inicio');
    const medical = dto.type === 'MEDICAL';
    const docs = dto.documents || [];

    if (medical && !docs.length) throw new BadRequestException('Adjunta los documentos de la incapacidad');
    if (!medical) {
      if (dto.paid === undefined || dto.paid === null) throw new BadRequestException('Indica si el permiso es remunerado o no');
      if (dto.willReturn === undefined || dto.willReturn === null) throw new BadRequestException('Indica si regresarás a la empresa');
      if (dto.willReturn) {
        if (!dto.departureTime || !dto.returnTime) throw new BadRequestException('Indica la hora de salida y la hora de regreso');
        if (start === end && dto.returnTime <= dto.departureTime) throw new BadRequestException('La hora de regreso debe ser posterior a la de salida');
      }
    }

    // Quien aprueba: el líder del área elegida (o la primera que tenga)
    const memberships = await this.prisma.areaMember.findMany({ where: { userId: u.id, area: { active: true } }, select: { areaId: true } });
    let areaId: string | null = null;
    if (dto.areaId) {
      if (!memberships.some((m) => m.areaId === dto.areaId)) throw new BadRequestException('No perteneces a esa área');
      areaId = dto.areaId;
    } else areaId = memberships[0]?.areaId ?? null;

    const overlap = await this.prisma.leaveRequest.count({
      where: { userId: u.id, status: { in: ['PENDING', 'APPROVED'] }, startDate: { lte: dateOnly(end) }, endDate: { gte: dateOnly(start) } },
    });
    if (overlap) throw new BadRequestException('Ya tienes un permiso pendiente o aprobado en esas fechas');

    const approvers = await this.notice.approversFor(areaId, u.companyId, u.id);
    if (!approvers.length) throw new BadRequestException('Tu área no tiene un líder que pueda aprobar el permiso. Contacta al administrador.');

    const leave = await this.prisma.leaveRequest.create({
      data: {
        userId: u.id,
        areaId,
        type: dto.type,
        startDate: dateOnly(start),
        endDate: dateOnly(end),
        paid: medical ? null : dto.paid,
        willReturn: medical ? null : dto.willReturn,
        departureTime: medical ? null : dto.departureTime || null,
        returnTime: medical || !dto.willReturn ? null : dto.returnTime || null,
        description: dto.description.trim(),
        additionalReason: dto.additionalReason?.trim() || null,
        documents: docs as unknown as Prisma.InputJsonValue,
      },
      include: INCLUDE,
    });

    await this.notice.send({
      userIds: approvers,
      type: 'LEAVE_REQUESTED',
      title: `Permiso por aprobar · ${code(leave.seq)}`,
      body: `${u.name} solicita ${LEAVE_TYPE_LABEL[leave.type].toLowerCase()} del ${start} al ${end}`,
      path: `/app/permisos?id=${leave.id}`,
      email: {
        subject: `[${code(leave.seq)}] ${u.name} solicita un permiso`,
        intro: `${u.name} registró una solicitud de permiso que necesita tu aprobación.`,
        rows: this.rows(leave),
        message: { label: 'Descripción', text: leave.description },
        tone: 'warning',
        ctaLabel: 'Revisar y decidir',
      },
    });
    return this.shape(leave, u);
  }

  private rows(l: LeaveRow): [string, string][] {
    const rows: [string, string][] = [
      ['Código', code(l.seq)],
      ['Solicitante', l.user.name],
      ['Tipo', LEAVE_TYPE_LABEL[l.type]],
      ['Desde', fmtLongDate(fmtDay(l.startDate))],
      ['Hasta', fmtLongDate(fmtDay(l.endDate))],
    ];
    if (l.type !== 'MEDICAL') {
      rows.push(['Remunerado', l.paid ? 'Sí' : 'No'], ['Regresa a la empresa', l.willReturn ? 'Sí' : 'No']);
      if (l.departureTime) rows.push(['Hora de salida', l.departureTime]);
      if (l.returnTime) rows.push(['Hora de regreso', l.returnTime]);
    } else rows.push(['Soportes', `${(l.documents as unknown[]).length} archivo(s) adjunto(s)`]);
    if (l.additionalReason) rows.push(['Razón adicional', l.additionalReason]);
    return rows;
  }

  private async load(id: string) {
    const l = await this.prisma.leaveRequest.findUnique({ where: { id }, include: INCLUDE });
    if (!l) throw new NotFoundException('Permiso no encontrado');
    return l;
  }

  async get(u: AuthUser, id: string) {
    const l = await this.load(id);
    if (l.userId !== u.id && !this.canReview(u, l)) throw new ForbiddenException();
    return this.shape(l, u);
  }

  private async decide(u: AuthUser, id: string, status: 'APPROVED' | 'REJECTED', note?: string) {
    const l = await this.load(id);
    if (!this.canReview(u, l)) throw new ForbiddenException('No puedes decidir sobre este permiso');
    if (l.status !== 'PENDING') throw new BadRequestException('Este permiso ya fue resuelto');
    if (status === 'REJECTED' && !note?.trim()) throw new BadRequestException('Indica el motivo del rechazo');

    // updateMany con estado PENDING evita que dos líderes decidan a la vez
    const res = await this.prisma.leaveRequest.updateMany({
      where: { id, status: 'PENDING' },
      data: { status, decidedById: u.id, decidedAt: new Date(), decisionNote: note?.trim() || null },
    });
    if (!res.count) throw new BadRequestException('Este permiso ya fue resuelto');
    const updated = await this.load(id);

    const approved = status === 'APPROVED';
    await this.notice.send({
      userIds: [l.userId],
      type: approved ? 'LEAVE_APPROVED' : 'LEAVE_REJECTED',
      title: `Permiso ${approved ? 'aprobado' : 'rechazado'} · ${code(l.seq)}`,
      body: `${u.name} ${approved ? 'aprobó' : 'rechazó'} tu solicitud de ${LEAVE_TYPE_LABEL[l.type].toLowerCase()}.`,
      path: `/app/permisos?id=${l.id}`,
      email: {
        subject: `[${code(l.seq)}] Tu permiso fue ${approved ? 'aprobado' : 'rechazado'}`,
        intro: `${u.name} ${approved ? 'aprobó' : 'rechazó'} tu solicitud de permiso.`,
        rows: this.rows(updated),
        message: note?.trim() ? { label: approved ? 'Comentario' : 'Motivo', text: note.trim() } : undefined,
        tone: approved ? 'success' : 'danger',
        ctaLabel: 'Ver mi permiso',
      },
    });
    return this.shape(updated, u);
  }

  approve(u: AuthUser, id: string, dto: DecisionDto) {
    return this.decide(u, id, 'APPROVED', dto.note);
  }

  reject(u: AuthUser, id: string, dto: DecisionDto) {
    return this.decide(u, id, 'REJECTED', dto.note);
  }

  async cancel(u: AuthUser, id: string) {
    const l = await this.load(id);
    if (l.userId !== u.id) throw new ForbiddenException();
    if (!['PENDING', 'APPROVED'].includes(l.status)) throw new BadRequestException('Este permiso ya no se puede cancelar');
    const updated = await this.prisma.leaveRequest.update({ where: { id }, data: { status: 'CANCELLED' }, include: INCLUDE });
    // Si ya estaba aprobado, el líder debe enterarse
    if (l.status === 'APPROVED') {
      const approvers = await this.notice.approversFor(l.areaId, u.companyId, u.id);
      await this.notice.send({
        userIds: approvers,
        type: 'LEAVE_CANCELLED',
        title: `Permiso cancelado · ${code(l.seq)}`,
        body: `${u.name} canceló su permiso ya aprobado del ${fmtDay(l.startDate)} al ${fmtDay(l.endDate)}.`,
        path: `/app/permisos?id=${l.id}`,
      });
    }
    return this.shape(updated, u);
  }
}

@RequireModule('leaves')
@Controller('leaves')
export class LeavesController {
  constructor(private svc: LeavesService) {}

  @Get()
  list(@CurrentUser() u: AuthUser, @Query() q: ListQuery) {
    return this.svc.list(u, q);
  }

  @Get('pending-count')
  pending(@CurrentUser() u: AuthUser) {
    return this.svc.pendingCount(u);
  }

  @Get(':id')
  get(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.svc.get(u, id);
  }

  @Post()
  create(@CurrentUser() u: AuthUser, @Body() dto: CreateLeaveDto) {
    return this.svc.create(u, dto);
  }

  @Post(':id/approve')
  approve(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: DecisionDto) {
    return this.svc.approve(u, id, dto);
  }

  @Post(':id/reject')
  reject(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: DecisionDto) {
    return this.svc.reject(u, id, dto);
  }

  @Post(':id/cancel')
  cancel(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.svc.cancel(u, id);
  }
}

@Module({ controllers: [LeavesController], providers: [LeavesService] })
export class LeavesModule {}
