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
  Query,
} from '@nestjs/common';
import { Prisma, Priority, TaskStatus } from '@prisma/client';
import { IsIn, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { AuthUser, isLeaderOf, isSuper } from '../common/auth-user';
import { CurrentUser } from '../common/decorators';
import { DATE_RE, dateOnly, fmtDay, fmtLongDate, todayBogota } from '../common/dates';
import { RequireModule } from '../common/modules';
import { NoticeService } from '../notice/notice.module';
import { PrismaService } from '../prisma/prisma.service';

const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
const PRIORITY_LABEL: Record<string, string> = { LOW: 'Baja', MEDIUM: 'Media', HIGH: 'Alta', URGENT: 'Urgente' };
const OPEN: TaskStatus[] = ['TODO', 'IN_PROGRESS'];

class CreateTaskDto {
  @IsString() @MinLength(3, { message: 'El título debe tener al menos 3 caracteres' }) @MaxLength(160) title: string;
  @IsOptional() @IsString() @MaxLength(4000) description?: string;
  @IsString() areaId: string;
  @IsString() assigneeId: string;
  @IsOptional() @IsIn(PRIORITIES) priority?: Priority;
  @IsOptional() @IsString() @Matches(DATE_RE, { message: 'Fecha límite inválida' }) dueDate?: string | null;
}

class UpdateTaskDto {
  @IsOptional() @IsString() @MinLength(3) @MaxLength(160) title?: string;
  @IsOptional() @IsString() @MaxLength(4000) description?: string;
  @IsOptional() @IsString() assigneeId?: string;
  @IsOptional() @IsIn(PRIORITIES) priority?: Priority;
  @IsOptional() @IsString() @Matches(DATE_RE, { message: 'Fecha límite inválida' }) dueDate?: string | null;
}

class StatusDto {
  @IsIn(['TODO', 'IN_PROGRESS', 'DONE', 'CANCELLED']) status: TaskStatus;
  @IsOptional() @IsString() @MaxLength(2000) note?: string;
}

class ListQuery {
  @IsOptional() @IsIn(['mine', 'team']) scope?: 'mine' | 'team';
  @IsOptional() @IsString() areaId?: string;
  @IsOptional() @IsString() status?: string;
}

const INCLUDE = {
  area: { select: { id: true, name: true, icon: true } },
  assignee: { select: { id: true, name: true, email: true, avatarUrl: true, jobTitle: true } },
  createdBy: { select: { id: true, name: true } },
} satisfies Prisma.TaskInclude;

type TaskRow = Prisma.TaskGetPayload<{ include: typeof INCLUDE }>;

@Injectable()
export class TasksService {
  constructor(
    private prisma: PrismaService,
    private notice: NoticeService,
  ) {}

  private shape(t: TaskRow, u: AuthUser) {
    const dueDate = t.dueDate ? fmtDay(t.dueDate) : null;
    const leader = isLeaderOf(u, t.areaId);
    const open = OPEN.includes(t.status);
    return {
      ...t,
      dueDate,
      isOverdue: !!dueDate && open && dueDate < todayBogota(),
      permissions: {
        canEdit: leader && open,
        canCancel: leader && open,
        canReopen: leader && !open,
        canWork: open && (t.assigneeId === u.id || leader),
      },
    };
  }

  async list(u: AuthUser, q: ListQuery) {
    const where: Prisma.TaskWhereInput = {};
    if (q.scope === 'team') {
      if (!isSuper(u) && !u.leaderAreaIds.length) throw new ForbiddenException('Solo los líderes ven las tareas del equipo');
      where.areaId = q.areaId ? q.areaId : isSuper(u) ? undefined : { in: u.leaderAreaIds };
      if (q.areaId && !isLeaderOf(u, q.areaId)) throw new ForbiddenException();
    } else {
      where.assigneeId = u.id;
      if (q.areaId) where.areaId = q.areaId;
    }
    if (q.status) where.status = { in: q.status.split(',').filter(Boolean) as TaskStatus[] };
    const rows = await this.prisma.task.findMany({
      where,
      include: INCLUDE,
      orderBy: [{ dueDate: { sort: 'asc', nulls: 'last' } }, { createdAt: 'desc' }],
      take: 500,
    });
    return rows.map((r) => this.shape(r, u));
  }

  /** Cantidades para el tablero: pendientes propias, vencidas y por revisar del equipo */
  async summary(u: AuthUser) {
    const today = dateOnly(todayBogota());
    const mine = { assigneeId: u.id };
    const led = isSuper(u) || u.leaderAreaIds.length > 0;
    const team = isSuper(u) ? {} : { areaId: { in: u.leaderAreaIds } };
    const c = (where: Prisma.TaskWhereInput) => this.prisma.task.count({ where });
    const [pending, overdue, teamOpen, teamOverdue] = await Promise.all([
      c({ ...mine, status: { in: OPEN } }),
      c({ ...mine, status: { in: OPEN }, dueDate: { lt: today } }),
      led ? c({ ...team, status: { in: OPEN } }) : 0,
      led ? c({ ...team, status: { in: OPEN }, dueDate: { lt: today } }) : 0,
    ]);
    return { pending, overdue, teamOpen, teamOverdue, isLeader: led };
  }

  private async assertAssignable(areaId: string, assigneeId: string) {
    const m = await this.prisma.areaMember.findUnique({
      where: { userId_areaId: { userId: assigneeId, areaId } },
      include: { user: { select: { active: true } }, area: { select: { active: true } } },
    });
    if (!m || !m.area.active) throw new BadRequestException('La persona elegida no pertenece a esa área');
    if (!m.user.active) throw new BadRequestException('La persona elegida está inactiva');
  }

  private notifyAssigned(t: TaskRow, by: AuthUser, reassigned: boolean) {
    return this.notice.send({
      userIds: [t.assigneeId],
      type: reassigned ? 'TASK_REASSIGNED' : 'TASK_ASSIGNED',
      title: reassigned ? 'Te reasignaron una tarea' : 'Nueva tarea asignada',
      body: `${t.title} — asignada por ${by.name}`,
      path: '/app/tareas',
      email: {
        intro: `${by.name} te asignó una tarea en el área ${t.area.name}.`,
        rows: [
          ['Tarea', t.title],
          ['Área', t.area.name],
          ['Prioridad', PRIORITY_LABEL[t.priority]],
          ['Fecha límite', t.dueDate ? fmtLongDate(fmtDay(t.dueDate)) : 'Sin fecha límite'],
        ],
        message: t.description ? { label: 'Descripción', text: t.description } : undefined,
        ctaLabel: 'Ver mis tareas',
      },
    });
  }

  async create(u: AuthUser, dto: CreateTaskDto) {
    if (!isLeaderOf(u, dto.areaId)) throw new ForbiddenException('Solo el líder del área puede crear tareas');
    await this.assertAssignable(dto.areaId, dto.assigneeId);
    const task = await this.prisma.task.create({
      data: {
        title: dto.title.trim(),
        description: dto.description?.trim() || null,
        areaId: dto.areaId,
        assigneeId: dto.assigneeId,
        createdById: u.id,
        priority: dto.priority || 'MEDIUM',
        dueDate: dto.dueDate ? dateOnly(dto.dueDate) : null,
      },
      include: INCLUDE,
    });
    if (task.assigneeId !== u.id) await this.notifyAssigned(task, u, false);
    return this.shape(task, u);
  }

  private async load(id: string) {
    const t = await this.prisma.task.findUnique({ where: { id }, include: INCLUDE });
    if (!t) throw new NotFoundException('Tarea no encontrada');
    return t;
  }

  async update(u: AuthUser, id: string, dto: UpdateTaskDto) {
    const t = await this.load(id);
    if (!isLeaderOf(u, t.areaId)) throw new ForbiddenException('Solo el líder del área puede editar la tarea');
    if (!OPEN.includes(t.status)) throw new BadRequestException('La tarea ya está cerrada; reábrela para editarla');
    const reassigned = !!dto.assigneeId && dto.assigneeId !== t.assigneeId;
    if (reassigned) await this.assertAssignable(t.areaId, dto.assigneeId!);
    const updated = await this.prisma.task.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
        ...(dto.description !== undefined ? { description: dto.description.trim() || null } : {}),
        ...(dto.priority ? { priority: dto.priority } : {}),
        ...(dto.dueDate !== undefined ? { dueDate: dto.dueDate ? dateOnly(dto.dueDate) : null } : {}),
        ...(reassigned ? { assigneeId: dto.assigneeId, status: 'TODO' as const, startedAt: null } : {}),
      },
      include: INCLUDE,
    });
    if (reassigned && updated.assigneeId !== u.id) await this.notifyAssigned(updated, u, true);
    return this.shape(updated, u);
  }

  async setStatus(u: AuthUser, id: string, dto: StatusDto) {
    const t = await this.load(id);
    const leader = isLeaderOf(u, t.areaId);
    const assignee = t.assigneeId === u.id;
    if (!leader && !assignee) throw new ForbiddenException('Esta tarea no es tuya');
    const open = OPEN.includes(t.status);
    if (dto.status === 'CANCELLED' && !leader) throw new ForbiddenException('Solo el líder puede cancelar una tarea');
    if (!open && !leader) throw new BadRequestException('La tarea ya está cerrada; pídele a tu líder que la reabra');
    if (dto.status === t.status) return this.shape(t, u);

    const now = new Date();
    const done = dto.status === 'DONE';
    const updated = await this.prisma.task.update({
      where: { id },
      data: {
        status: dto.status,
        startedAt: dto.status === 'TODO' ? null : (t.startedAt ?? now),
        completedAt: done ? now : null,
        completionNote: done ? dto.note?.trim() || null : dto.status === 'TODO' || dto.status === 'IN_PROGRESS' ? null : t.completionNote,
      },
      include: INCLUDE,
    });

    if (done && assignee && updated.createdById !== u.id) {
      await this.notice.send({
        userIds: [updated.createdById],
        type: 'TASK_DONE',
        title: 'Tarea completada',
        body: `${u.name} completó: ${updated.title}`,
        path: '/app/tareas',
        email: {
          intro: `${u.name} marcó como completada una tarea que le asignaste.`,
          rows: [
            ['Tarea', updated.title],
            ['Área', updated.area.name],
          ],
          message: updated.completionNote ? { label: 'Nota de cierre', text: updated.completionNote } : undefined,
          tone: 'success',
          ctaLabel: 'Ver tareas del equipo',
        },
      });
    } else if (leader && !assignee && (dto.status === 'CANCELLED' || (!open && OPEN.includes(dto.status)))) {
      const cancelled = dto.status === 'CANCELLED';
      await this.notice.send({
        userIds: [updated.assigneeId],
        type: cancelled ? 'TASK_CANCELLED' : 'TASK_REOPENED',
        title: cancelled ? 'Tarea cancelada' : 'Tarea reabierta',
        body: `${u.name}: ${updated.title}`,
        path: '/app/tareas',
      });
    }
    return this.shape(updated, u);
  }
}

@RequireModule('tasks')
@Controller('tasks')
export class TasksController {
  constructor(private svc: TasksService) {}

  @Get()
  list(@CurrentUser() u: AuthUser, @Query() q: ListQuery) {
    return this.svc.list(u, q);
  }

  @Get('summary')
  summary(@CurrentUser() u: AuthUser) {
    return this.svc.summary(u);
  }

  @Post()
  create(@CurrentUser() u: AuthUser, @Body() dto: CreateTaskDto) {
    return this.svc.create(u, dto);
  }

  @Patch(':id')
  update(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: UpdateTaskDto) {
    return this.svc.update(u, id, dto);
  }

  @Post(':id/status')
  setStatus(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: StatusDto) {
    return this.svc.setStatus(u, id, dto);
  }
}

@Module({ controllers: [TasksController], providers: [TasksService] })
export class TasksModule {}
