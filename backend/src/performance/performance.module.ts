import {
  BadRequestException,
  Body,
  Controller,
  Delete,
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
import { KpiDirection, KpiPeriod, Prisma } from '@prisma/client';
import { IsArray, IsBoolean, IsIn, IsInt, IsNumber, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';
import { AuthUser, canManageCompany, isLeaderOf, isSuper } from '../common/auth-user';
import { CurrentUser } from '../common/decorators';
import { addDays, DATE_RE, dateOnly, fmtDay, todayBogota } from '../common/dates';
import { RequireModule } from '../common/modules';
import { USER_PUBLIC } from '../common/user-select';
import { PrismaService } from '../prisma/prisma.service';

const DIRECTIONS = ['HIGHER_BETTER', 'LOWER_BETTER'];
const PERIODS = ['DAILY', 'WEEKLY', 'MONTHLY'];
const MAX_RANGE_DAYS = 400;

const name = (label: string) => ({ message: `${label}: mínimo 2 caracteres` });

class PositionDto {
  @IsOptional() @IsString() areaId?: string;
  @IsOptional() @IsString() @MinLength(2, name('Nombre')) @MaxLength(80) name?: string;
  @IsOptional() @IsString() @MaxLength(400) description?: string;
  @IsOptional() @IsBoolean() active?: boolean;
}

class RoleDto {
  @IsOptional() @IsString() positionId?: string;
  @IsOptional() @IsString() @MinLength(2, name('Nombre')) @MaxLength(80) name?: string;
  @IsOptional() @IsString() @MaxLength(400) description?: string;
  @IsOptional() @IsBoolean() active?: boolean;
}

class RoleTaskDto {
  @IsOptional() @IsString() roleId?: string;
  @IsOptional() @IsString() @MinLength(3, { message: 'La tarea: mínimo 3 caracteres' }) @MaxLength(200) title?: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsOptional() @IsBoolean() active?: boolean;
}

class KpiDto {
  @IsOptional() @IsString() roleId?: string;
  @IsOptional() @IsString() @MinLength(2, name('Nombre')) @MaxLength(120) name?: string;
  @IsOptional() @IsString() @MaxLength(1000) description?: string;
  @IsOptional() @IsString() @MaxLength(20) unit?: string;
  @IsOptional() @IsNumber() @Min(0) target?: number;
  @IsOptional() @IsIn(DIRECTIONS) direction?: KpiDirection;
  @IsOptional() @IsIn(PERIODS) period?: KpiPeriod;
  @IsOptional() @IsBoolean() active?: boolean;
}

class MembersDto {
  @IsArray() @IsString({ each: true }) userIds: string[];
}

class MeasureDto {
  @IsString() kpiId: string;
  @IsString() userId: string;
  /** Cualquier día del periodo; se normaliza al inicio del día, la semana o el mes según el KPI */
  @IsString() @Matches(DATE_RE, { message: 'Fecha inválida' }) date: string;
  @IsNumber() @Min(0) value: number;
  @IsOptional() @IsString() @MaxLength(1000) note?: string;
}

class TimeDto {
  @IsString() taskId: string;
  @IsString() companyId: string;
  @IsString() @Matches(DATE_RE, { message: 'Fecha inválida' }) date: string;
  @IsInt() @Min(1, { message: 'El tiempo debe ser de al menos 1 minuto' }) @Max(1440) minutes: number;
  @IsOptional() @IsString() @MaxLength(500) note?: string;
  /** Registrar a nombre de un colaborador (solo líderes y administradores) */
  @IsOptional() @IsString() userId?: string;
}

class RangeQuery {
  @IsOptional() @IsString() @Matches(DATE_RE) from?: string;
  @IsOptional() @IsString() @Matches(DATE_RE) to?: string;
  @IsOptional() @IsString() areaId?: string;
}

// ---------------------------------------------------------------- periodos y cumplimiento
const weekStart = (s: string) => addDays(s, -((dateOnly(s).getUTCDay() + 6) % 7));
const monthStart = (s: string) => `${s.slice(0, 7)}-01`;
const monthEnd = (s: string) => {
  const d = dateOnly(monthStart(s));
  return fmtDay(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)));
};

export const periodStart = (period: KpiPeriod, day: string) => (period === 'DAILY' ? day : period === 'WEEKLY' ? weekStart(day) : monthStart(day));
const periodEnd = (period: KpiPeriod, start: string) => (period === 'DAILY' ? start : period === 'WEEKLY' ? addDays(start, 6) : monthEnd(start));

export type KpiStatus = 'MET' | 'NEAR' | 'BELOW' | 'NONE';

/** Cumplimiento de un KPI: 1 = meta lograda. Con "más es mejor" es valor/meta; con "menos es mejor", meta/valor */
export function attainment(direction: KpiDirection, target: number, value: number): number {
  if (direction === 'HIGHER_BETTER') return target <= 0 ? 1 : value / target;
  if (value <= 0) return 1;
  return target / value;
}

export function summarize(kpi: { direction: KpiDirection; target: number }, values: number[]) {
  if (!values.length) return { count: 0, average: null as number | null, last: null as number | null, attainment: null as number | null, status: 'NONE' as KpiStatus };
  const average = values.reduce((a, b) => a + b, 0) / values.length;
  const att = attainment(kpi.direction, kpi.target, average);
  const status: KpiStatus = att >= 1 ? 'MET' : att >= 0.8 ? 'NEAR' : 'BELOW';
  return { count: values.length, average, last: values[values.length - 1], attainment: att, status };
}

/** Promedio de cumplimiento (topado en 100 % por KPI) */
const score = (atts: (number | null)[]) => {
  const xs = atts.filter((a): a is number => a !== null).map((a) => Math.min(a, 1));
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
};

const sum = (m: Record<string, number>, k: string, v: number) => {
  m[k] = (m[k] || 0) + v;
};

// ---------------------------------------------------------------- consultas
const AREA_BRIEF = {
  id: true,
  name: true,
  icon: true,
  isShared: true,
  companies: { select: { companyId: true, company: { select: { id: true, name: true, primaryColor: true } } } },
} satisfies Prisma.AreaSelect;

type AreaBrief = Prisma.AreaGetPayload<{ select: typeof AREA_BRIEF }>;

const companiesOf = (a: AreaBrief) => a.companies.map((c) => c.company);

const ACTIVE_CHAIN = { active: true, position: { active: true, area: { active: true } } } satisfies Prisma.JobRoleWhereInput;

@Injectable()
export class PerformanceService {
  constructor(private prisma: PrismaService) {}

  // ----- permisos -----
  private areaScope(u: AuthUser): Prisma.AreaWhereInput {
    if (isSuper(u)) return { active: true };
    if (u.role === 'COMPANY_ADMIN' && u.companyId) return { active: true, OR: [{ id: { in: u.areaIds } }, { companies: { some: { companyId: u.companyId } } }] };
    return { active: true, id: { in: u.areaIds } };
  }

  /** Quien lidera el área, el superadministrador y el administrador de la empresa (si el área no es compartida) */
  private canManage(u: AuthUser, a: Pick<AreaBrief, 'id' | 'isShared' | 'companies'>) {
    return isLeaderOf(u, a.id) || (!a.isShared && a.companies.some((c) => canManageCompany(u, c.companyId)));
  }

  private assertManage(u: AuthUser, a: Pick<AreaBrief, 'id' | 'isShared' | 'companies'>) {
    if (!this.canManage(u, a)) throw new ForbiddenException('Solo el líder del área o un administrador puede hacer esto');
  }

  private async canSeeArea(u: AuthUser, areaId: string) {
    return !!(await this.prisma.area.findFirst({ where: { id: areaId, ...this.areaScope(u) }, select: { id: true } }));
  }

  // ----- carga de entidades con su área -----
  private async areaOfPosition(id: string) {
    const p = await this.prisma.jobPosition.findUnique({ where: { id }, include: { area: { select: AREA_BRIEF } } });
    if (!p) throw new NotFoundException('Cargo no encontrado');
    return { entity: p, area: p.area };
  }

  private async areaOfRole(id: string) {
    const r = await this.prisma.jobRole.findUnique({ where: { id }, include: { position: { include: { area: { select: AREA_BRIEF } } } } });
    if (!r) throw new NotFoundException('Rol no encontrado');
    return { entity: r, area: r.position.area };
  }

  private async areaOfTask(id: string) {
    const t = await this.prisma.roleTask.findUnique({ where: { id }, include: { role: { include: { position: { include: { area: { select: AREA_BRIEF } } } } } } });
    if (!t) throw new NotFoundException('Tarea no encontrada');
    return { entity: t, area: t.role.position.area };
  }

  private async areaOfKpi(id: string) {
    const k = await this.prisma.kpi.findUnique({ where: { id }, include: { role: { include: { position: { include: { area: { select: AREA_BRIEF } } } } } } });
    if (!k) throw new NotFoundException('KPI no encontrado');
    return { entity: k, area: k.role.position.area };
  }

  private dup(e: unknown, msg: string): never {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw new BadRequestException(msg);
    throw e;
  }

  private clean<T extends Record<string, any>>(dto: T, keys: (keyof T)[]) {
    const out: Record<string, any> = {};
    for (const k of keys) {
      const v = dto[k];
      if (v === undefined) continue;
      out[k as string] = typeof v === 'string' ? v.trim() || (k === 'description' ? null : v.trim()) : v;
    }
    return out;
  }

  private parseRange(q: RangeQuery) {
    const today = todayBogota();
    const from = q.from ?? monthStart(today);
    const to = q.to ?? (q.from ? addDays(q.from, 30) : monthEnd(today));
    if (dateOnly(to) < dateOnly(from)) throw new BadRequestException('La fecha final es anterior a la inicial');
    if ((dateOnly(to).getTime() - dateOnly(from).getTime()) / 86400000 > MAX_RANGE_DAYS) throw new BadRequestException('El rango no puede superar un año');
    return { from, to };
  }

  // ---------------------------------------------------------------- catálogo
  async catalog(u: AuthUser) {
    const areas = await this.prisma.area.findMany({
      where: this.areaScope(u),
      orderBy: { name: 'asc' },
      select: {
        ...AREA_BRIEF,
        members: { select: { role: true, user: { select: USER_PUBLIC } }, orderBy: { role: 'asc' } },
        positions: {
          orderBy: { createdAt: 'asc' },
          include: {
            roles: {
              orderBy: { createdAt: 'asc' },
              include: {
                assignments: { select: { user: { select: USER_PUBLIC } }, orderBy: { createdAt: 'asc' } },
                kpis: { orderBy: { createdAt: 'asc' } },
                tasks: { orderBy: { createdAt: 'asc' } },
              },
            },
          },
        },
      },
    });
    return areas.map((a) => ({
      id: a.id,
      name: a.name,
      icon: a.icon,
      isShared: a.isShared,
      canManage: this.canManage(u, a),
      companies: companiesOf(a),
      members: a.members,
      positions: a.positions.map((p) => ({
        ...p,
        roles: p.roles.map((r) => ({ ...r, assignees: r.assignments.map((x) => x.user), assignments: undefined })),
      })),
    }));
  }

  // ---------------------------------------------------------------- cargos, roles, tareas y KPI
  async createPosition(u: AuthUser, dto: PositionDto) {
    if (!dto.areaId || !dto.name) throw new BadRequestException('Indica el área y el nombre del cargo');
    const area = await this.prisma.area.findUnique({ where: { id: dto.areaId }, select: AREA_BRIEF });
    if (!area) throw new NotFoundException('Área no encontrada');
    this.assertManage(u, area);
    return this.prisma.jobPosition
      .create({ data: { areaId: dto.areaId, ...this.clean(dto, ['name', 'description']), name: dto.name.trim() } })
      .catch((e) => this.dup(e, 'Ya existe un cargo con ese nombre en el área'));
  }

  async updatePosition(u: AuthUser, id: string, dto: PositionDto) {
    const { area } = await this.areaOfPosition(id);
    this.assertManage(u, area);
    return this.prisma.jobPosition.update({ where: { id }, data: this.clean(dto, ['name', 'description', 'active']) }).catch((e) => this.dup(e, 'Ya existe un cargo con ese nombre en el área'));
  }

  async deletePosition(u: AuthUser, id: string) {
    const { area } = await this.areaOfPosition(id);
    this.assertManage(u, area);
    await this.assertNoHistory({ task: { role: { positionId: id } } }, { role: { positionId: id } });
    await this.prisma.jobPosition.delete({ where: { id } });
    return { ok: true };
  }

  async createRole(u: AuthUser, dto: RoleDto) {
    if (!dto.positionId || !dto.name) throw new BadRequestException('Indica el cargo y el nombre del rol');
    const { area } = await this.areaOfPosition(dto.positionId);
    this.assertManage(u, area);
    return this.prisma.jobRole
      .create({ data: { positionId: dto.positionId, ...this.clean(dto, ['name', 'description']), name: dto.name.trim() } })
      .catch((e) => this.dup(e, 'Ya existe un rol con ese nombre en el cargo'));
  }

  async updateRole(u: AuthUser, id: string, dto: RoleDto) {
    const { area } = await this.areaOfRole(id);
    this.assertManage(u, area);
    return this.prisma.jobRole.update({ where: { id }, data: this.clean(dto, ['name', 'description', 'active']) }).catch((e) => this.dup(e, 'Ya existe un rol con ese nombre en el cargo'));
  }

  async deleteRole(u: AuthUser, id: string) {
    const { area } = await this.areaOfRole(id);
    this.assertManage(u, area);
    await this.assertNoHistory({ task: { roleId: id } }, { roleId: id });
    await this.prisma.jobRole.delete({ where: { id } });
    return { ok: true };
  }

  /** Reemplaza los colaboradores que desempeñan el rol; deben ser miembros activos del área */
  async setRoleMembers(u: AuthUser, id: string, dto: MembersDto) {
    const { area } = await this.areaOfRole(id);
    this.assertManage(u, area);
    const userIds = [...new Set(dto.userIds)];
    const members = await this.prisma.areaMember.findMany({ where: { areaId: area.id, userId: { in: userIds }, user: { active: true } }, select: { userId: true } });
    if (members.length !== userIds.length) throw new BadRequestException('Solo puedes asignar personas activas que pertenezcan al área');
    await this.prisma.$transaction([
      this.prisma.jobAssignment.deleteMany({ where: { roleId: id, userId: { notIn: userIds } } }),
      this.prisma.jobAssignment.createMany({ data: userIds.map((userId) => ({ roleId: id, userId })), skipDuplicates: true }),
    ]);
    return { ok: true };
  }

  async createTask(u: AuthUser, dto: RoleTaskDto) {
    if (!dto.roleId || !dto.title) throw new BadRequestException('Indica el rol y la tarea');
    const { area } = await this.areaOfRole(dto.roleId);
    this.assertManage(u, area);
    return this.prisma.roleTask.create({ data: { roleId: dto.roleId, ...this.clean(dto, ['title', 'description']), title: dto.title.trim() } });
  }

  async updateTask(u: AuthUser, id: string, dto: RoleTaskDto) {
    const { area } = await this.areaOfTask(id);
    this.assertManage(u, area);
    return this.prisma.roleTask.update({ where: { id }, data: this.clean(dto, ['title', 'description', 'active']) });
  }

  async deleteTask(u: AuthUser, id: string) {
    const { area } = await this.areaOfTask(id);
    this.assertManage(u, area);
    await this.assertNoHistory({ taskId: id });
    await this.prisma.roleTask.delete({ where: { id } });
    return { ok: true };
  }

  async createKpi(u: AuthUser, dto: KpiDto) {
    if (!dto.roleId || !dto.name || dto.target === undefined) throw new BadRequestException('Indica el rol, el nombre y la meta del KPI');
    const { area } = await this.areaOfRole(dto.roleId);
    this.assertManage(u, area);
    return this.prisma.kpi.create({
      data: {
        roleId: dto.roleId,
        ...this.clean(dto, ['name', 'description', 'unit', 'target', 'direction', 'period']),
        name: dto.name.trim(),
        target: dto.target,
      },
    });
  }

  async updateKpi(u: AuthUser, id: string, dto: KpiDto) {
    const { area } = await this.areaOfKpi(id);
    this.assertManage(u, area);
    return this.prisma.kpi.update({ where: { id }, data: this.clean(dto, ['name', 'description', 'unit', 'target', 'direction', 'period', 'active']) });
  }

  async deleteKpi(u: AuthUser, id: string) {
    const { area } = await this.areaOfKpi(id);
    this.assertManage(u, area);
    const n = await this.prisma.kpiMeasure.count({ where: { kpiId: id } });
    if (n) throw new BadRequestException('El KPI ya tiene mediciones; archívalo en lugar de eliminarlo para conservar el historial');
    await this.prisma.kpi.delete({ where: { id } });
    return { ok: true };
  }

  /** Eliminar borra en cascada: si hay tiempo registrado o mediciones, se pide archivar para no perder el historial */
  private async assertNoHistory(timeWhere: Prisma.TimeEntryWhereInput, kpiWhere?: Prisma.KpiWhereInput) {
    const [time, measures] = await Promise.all([
      this.prisma.timeEntry.count({ where: timeWhere }),
      kpiWhere ? this.prisma.kpiMeasure.count({ where: { kpi: kpiWhere } }) : 0,
    ]);
    if (time || measures) throw new BadRequestException('Ya tiene tiempo registrado o mediciones; archívalo (desmarca “Activo”) para conservar el historial');
  }

  // ---------------------------------------------------------------- mediciones de KPI
  async saveMeasure(u: AuthUser, dto: MeasureDto) {
    const { entity: kpi, area } = await this.areaOfKpi(dto.kpiId);
    this.assertManage(u, area);
    if (!kpi.active || !kpi.role.active || !kpi.role.position.active) throw new BadRequestException('El KPI está archivado');
    if (dto.date > todayBogota()) throw new BadRequestException('No puedes medir un periodo que aún no empieza');
    const assigned = await this.prisma.jobAssignment.findUnique({ where: { userId_roleId: { userId: dto.userId, roleId: kpi.roleId } } });
    if (!assigned) throw new BadRequestException('La persona no desempeña el rol de este KPI');
    const start = dateOnly(periodStart(kpi.period, dto.date));
    const data = { value: dto.value, note: dto.note?.trim() || null, recordedById: u.id };
    return this.prisma.kpiMeasure.upsert({
      where: { kpiId_userId_periodStart: { kpiId: kpi.id, userId: dto.userId, periodStart: start } },
      update: data,
      create: { kpiId: kpi.id, userId: dto.userId, periodStart: start, ...data },
    });
  }

  async deleteMeasure(u: AuthUser, id: string) {
    const m = await this.prisma.kpiMeasure.findUnique({ where: { id }, select: { kpiId: true } });
    if (!m) throw new NotFoundException('Medición no encontrada');
    const { area } = await this.areaOfKpi(m.kpiId);
    this.assertManage(u, area);
    await this.prisma.kpiMeasure.delete({ where: { id } });
    return { ok: true };
  }

  // ---------------------------------------------------------------- tiempo dedicado
  async logTime(u: AuthUser, dto: TimeDto) {
    const { entity: task, area } = await this.areaOfTask(dto.taskId);
    const userId = dto.userId || u.id;
    if (userId !== u.id) this.assertManage(u, area);
    if (!task.active || !task.role.active || !task.role.position.active) throw new BadRequestException('La tarea está archivada');
    const assigned = await this.prisma.jobAssignment.findUnique({ where: { userId_roleId: { userId, roleId: task.roleId } } });
    if (!assigned) throw new ForbiddenException(userId === u.id ? 'Esta tarea no pertenece a ninguno de tus roles' : 'La persona no desempeña el rol de esta tarea');
    if (!area.companies.some((c) => c.companyId === dto.companyId)) throw new BadRequestException('Esa empresa no es atendida por el área de la tarea');
    if (dto.date > todayBogota()) throw new BadRequestException('No puedes registrar tiempo en una fecha futura');

    const day = dateOnly(dto.date);
    const used = await this.prisma.timeEntry.aggregate({ where: { userId, date: day }, _sum: { minutes: true } });
    if ((used._sum.minutes || 0) + dto.minutes > 1440) throw new BadRequestException('Ese día ya suma más de 24 horas registradas');

    return this.prisma.timeEntry.create({
      data: { userId, taskId: dto.taskId, companyId: dto.companyId, date: day, minutes: dto.minutes, note: dto.note?.trim() || null, loggedById: u.id },
    });
  }

  async deleteTime(u: AuthUser, id: string) {
    const e = await this.prisma.timeEntry.findUnique({ where: { id }, select: { userId: true, taskId: true } });
    if (!e) throw new NotFoundException('Registro no encontrado');
    if (e.userId !== u.id) this.assertManage(u, (await this.areaOfTask(e.taskId)).area);
    await this.prisma.timeEntry.delete({ where: { id } });
    return { ok: true };
  }

  // ---------------------------------------------------------------- vista del colaborador
  async me(u: AuthUser, q: RangeQuery) {
    const { from, to } = this.parseRange(q);
    const assignments = await this.prisma.jobAssignment.findMany({
      where: { userId: u.id, role: ACTIVE_CHAIN },
      include: {
        role: {
          include: {
            position: { include: { area: { select: AREA_BRIEF } } },
            kpis: { where: { active: true }, orderBy: { createdAt: 'asc' } },
            tasks: { where: { active: true }, orderBy: { createdAt: 'asc' } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
    const taskIds = assignments.flatMap((a) => a.role.tasks.map((t) => t.id));
    const kpis = assignments.flatMap((a) => a.role.kpis);
    const [measures, entries] = await Promise.all([
      this.measuresIn(kpis, [u.id], from, to),
      this.prisma.timeEntry.findMany({
        where: { userId: u.id, taskId: { in: taskIds }, date: { gte: dateOnly(from), lte: dateOnly(to) } },
        include: { company: { select: { id: true, name: true, primaryColor: true } }, task: { select: { title: true } } },
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        take: 500,
      }),
    ]);

    const roles = assignments.map(({ role }) => {
      const area = role.position.area;
      const kpiResults = role.kpis.map((k) => {
        const own = measures.filter((m) => m.kpiId === k.id);
        return { ...k, measures: own, summary: summarize(k, own.map((m) => m.value)) };
      });
      return {
        id: role.id,
        name: role.name,
        position: { id: role.position.id, name: role.position.name },
        area: { id: area.id, name: area.name, icon: area.icon, companies: companiesOf(area) },
        kpis: kpiResults,
        score: score(kpiResults.map((k) => k.summary.attainment)),
        tasks: role.tasks.map((t) => {
          const byCompany: Record<string, number> = {};
          let minutes = 0;
          for (const e of entries) if (e.taskId === t.id) (sum(byCompany, e.companyId, e.minutes), (minutes += e.minutes));
          return { id: t.id, title: t.title, description: t.description, minutes, byCompany };
        }),
      };
    });

    return {
      from,
      to,
      roles,
      score: score(roles.flatMap((r) => r.kpis.map((k) => k.summary.attainment))),
      totalMinutes: entries.reduce((a, e) => a + e.minutes, 0),
      entries: entries.map((e) => ({ id: e.id, date: fmtDay(e.date), minutes: e.minutes, note: e.note, taskId: e.taskId, taskTitle: e.task.title, company: e.company, loggedByOther: e.loggedById !== e.userId })),
    };
  }

  /** Mediciones cuyo periodo se cruza con el rango (un KPI mensual del día 1 cuenta para un rango que empieza el 10) */
  private async measuresIn(kpis: { id: string; period: KpiPeriod }[], userIds: string[], from: string, to: string) {
    if (!kpis.length || !userIds.length) return [];
    const byKpi = new Map(kpis.map((k) => [k.id, k.period]));
    const rows = await this.prisma.kpiMeasure.findMany({
      where: { kpiId: { in: [...byKpi.keys()] }, userId: { in: userIds }, periodStart: { gte: dateOnly(addDays(from, -31)), lte: dateOnly(to) } },
      orderBy: { periodStart: 'asc' },
    });
    return rows
      .map((m) => ({ id: m.id, kpiId: m.kpiId, userId: m.userId, periodStart: fmtDay(m.periodStart), value: m.value, note: m.note }))
      .filter((m) => periodEnd(byKpi.get(m.kpiId)!, m.periodStart) >= from);
  }

  // ---------------------------------------------------------------- vista del líder
  async team(u: AuthUser, q: RangeQuery) {
    if (!q.areaId) throw new BadRequestException('Indica el área');
    const { from, to } = this.parseRange(q);
    const area = await this.prisma.area.findFirst({
      where: { id: q.areaId, ...this.areaScope(u) },
      select: {
        ...AREA_BRIEF,
        members: { select: { user: { select: { ...USER_PUBLIC, active: true } } } },
        positions: {
          where: { active: true },
          orderBy: { createdAt: 'asc' },
          include: {
            roles: {
              where: { active: true },
              orderBy: { createdAt: 'asc' },
              include: {
                assignments: { select: { userId: true } },
                kpis: { where: { active: true }, orderBy: { createdAt: 'asc' } },
                tasks: { where: { active: true }, orderBy: { createdAt: 'asc' } },
              },
            },
          },
        },
      },
    });
    if (!area) throw new NotFoundException('Área no encontrada');
    this.assertManage(u, area);

    const roles = area.positions.flatMap((p) => p.roles.map((r) => ({ ...r, positionName: p.name })));
    const kpis = roles.flatMap((r) => r.kpis);
    const taskIds = roles.flatMap((r) => r.tasks.map((t) => t.id));
    const userIds = [...new Set(roles.flatMap((r) => r.assignments.map((a) => a.userId)))];
    const [measures, entries] = await Promise.all([
      this.measuresIn(kpis, userIds, from, to),
      this.prisma.timeEntry.findMany({
        where: { taskId: { in: taskIds }, userId: { in: userIds }, date: { gte: dateOnly(from), lte: dateOnly(to) } },
        select: { userId: true, taskId: true, companyId: true, minutes: true },
      }),
    ]);

    const people = new Map(area.members.map((m) => [m.user.id, m.user]));
    const members = userIds
      .filter((id) => people.has(id))
      .map((id) => {
        const mine = roles.filter((r) => r.assignments.some((a) => a.userId === id));
        const byCompany: Record<string, number> = {};
        let totalMinutes = 0;
        const roleResults = mine.map((r) => {
          const kpiResults = r.kpis.map((k) => {
            const own = measures.filter((m) => m.kpiId === k.id && m.userId === id);
            return { ...k, measures: own, summary: summarize(k, own.map((m) => m.value)) };
          });
          const tasks = r.tasks.map((t) => {
            const tByCompany: Record<string, number> = {};
            let minutes = 0;
            for (const e of entries) if (e.userId === id && e.taskId === t.id) (sum(tByCompany, e.companyId, e.minutes), sum(byCompany, e.companyId, e.minutes), (minutes += e.minutes));
            totalMinutes += minutes;
            return { id: t.id, title: t.title, description: t.description, minutes, byCompany: tByCompany };
          });
          return { id: r.id, name: r.name, positionName: r.positionName, kpis: kpiResults, tasks, score: score(kpiResults.map((k) => k.summary.attainment)) };
        });
        return {
          user: people.get(id)!,
          roles: roleResults,
          totalMinutes,
          byCompany,
          score: score(roleResults.flatMap((r) => r.kpis.map((k) => k.summary.attainment))),
        };
      })
      .sort((a, b) => a.user.name.localeCompare(b.user.name, 'es'));

    const assigned = new Set(userIds);
    return {
      from,
      to,
      area: { id: area.id, name: area.name, icon: area.icon, companies: companiesOf(area) },
      members,
      unassigned: area.members.map((m) => m.user).filter((x) => x.active && !assigned.has(x.id)),
    };
  }

  /** Todas las áreas que el usuario puede gestionar, cada una con su equipo (la vista consolidada del superadministrador) */
  async overview(u: AuthUser, q: RangeQuery) {
    const { from, to } = this.parseRange(q);
    const areas = await this.prisma.area.findMany({ where: this.areaScope(u), orderBy: { name: 'asc' }, select: AREA_BRIEF });
    const teams = await Promise.all(areas.filter((a) => this.canManage(u, a)).map((a) => this.team(u, { from, to, areaId: a.id })));
    return { from, to, areas: teams };
  }

  /** Tarjeta del inicio: horas del mes y cuántos roles tiene */
  async summary(u: AuthUser) {
    const today = todayBogota();
    const [roles, time] = await Promise.all([
      this.prisma.jobAssignment.count({ where: { userId: u.id, role: ACTIVE_CHAIN } }),
      this.prisma.timeEntry.aggregate({ where: { userId: u.id, date: { gte: dateOnly(monthStart(today)), lte: dateOnly(today) } }, _sum: { minutes: true } }),
    ]);
    return { roles, monthMinutes: time._sum.minutes || 0 };
  }
}

@RequireModule('performance')
@Controller('performance')
export class PerformanceController {
  constructor(private svc: PerformanceService) {}

  @Get('catalog') catalog(@CurrentUser() u: AuthUser) {
    return this.svc.catalog(u);
  }
  @Get('summary') summary(@CurrentUser() u: AuthUser) {
    return this.svc.summary(u);
  }
  @Get('me') me(@CurrentUser() u: AuthUser, @Query() q: RangeQuery) {
    return this.svc.me(u, q);
  }
  @Get('overview') overview(@CurrentUser() u: AuthUser, @Query() q: RangeQuery) {
    return this.svc.overview(u, q);
  }
  @Get('team') team(@CurrentUser() u: AuthUser, @Query() q: RangeQuery) {
    return this.svc.team(u, q);
  }

  @Post('positions') createPosition(@CurrentUser() u: AuthUser, @Body() dto: PositionDto) {
    return this.svc.createPosition(u, dto);
  }
  @Patch('positions/:id') updatePosition(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: PositionDto) {
    return this.svc.updatePosition(u, id, dto);
  }
  @Delete('positions/:id') deletePosition(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.svc.deletePosition(u, id);
  }

  @Post('roles') createRole(@CurrentUser() u: AuthUser, @Body() dto: RoleDto) {
    return this.svc.createRole(u, dto);
  }
  @Patch('roles/:id') updateRole(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: RoleDto) {
    return this.svc.updateRole(u, id, dto);
  }
  @Delete('roles/:id') deleteRole(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.svc.deleteRole(u, id);
  }
  @Put('roles/:id/members') setRoleMembers(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: MembersDto) {
    return this.svc.setRoleMembers(u, id, dto);
  }

  @Post('tasks') createTask(@CurrentUser() u: AuthUser, @Body() dto: RoleTaskDto) {
    return this.svc.createTask(u, dto);
  }
  @Patch('tasks/:id') updateTask(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: RoleTaskDto) {
    return this.svc.updateTask(u, id, dto);
  }
  @Delete('tasks/:id') deleteTask(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.svc.deleteTask(u, id);
  }

  @Post('kpis') createKpi(@CurrentUser() u: AuthUser, @Body() dto: KpiDto) {
    return this.svc.createKpi(u, dto);
  }
  @Patch('kpis/:id') updateKpi(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: KpiDto) {
    return this.svc.updateKpi(u, id, dto);
  }
  @Delete('kpis/:id') deleteKpi(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.svc.deleteKpi(u, id);
  }

  @Post('measures') saveMeasure(@CurrentUser() u: AuthUser, @Body() dto: MeasureDto) {
    return this.svc.saveMeasure(u, dto);
  }
  @Delete('measures/:id') deleteMeasure(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.svc.deleteMeasure(u, id);
  }

  @Post('time') logTime(@CurrentUser() u: AuthUser, @Body() dto: TimeDto) {
    return this.svc.logTime(u, dto);
  }
  @Delete('time/:id') deleteTime(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.svc.deleteTime(u, id);
  }
}

@Module({ controllers: [PerformanceController], providers: [PerformanceService] })
export class PerformanceModule {}
