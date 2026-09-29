import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { EventType, Prisma, RequestStatus } from '@prisma/client';
import { AuthUser, isLeaderOf, isSuper } from '../common/auth-user';
import { addBusinessDays, formatCode } from '../common/business-days';
import { USER_PUBLIC } from '../common/user-select';
import { FormField, validateData } from '../forms/form-field';
import { PrismaService } from '../prisma/prisma.service';
import { NotifierService, Recipient } from './notifier.service';
import {
  AssignDto,
  CommentDto,
  CreateRequestDto,
  EscalateDto,
  ListQuery,
  NoteDto,
  RespondDto,
  TransferDto,
} from './requests.dto';

export const OPEN: RequestStatus[] = ['PENDING_ASSIGNMENT', 'ASSIGNED', 'IN_PROGRESS', 'ESCALATION_REQUESTED'];
const WORKING: RequestStatus[] = ['ASSIGNED', 'IN_PROGRESS', 'ESCALATION_REQUESTED'];

const USER_MIN = { select: { id: true, name: true, email: true } } as const;

export const REQ_INCLUDE = {
  area: { select: { id: true, name: true, icon: true, isShared: true } },
  company: { select: { id: true, name: true, slug: true, primaryColor: true, logoUrl: true } },
  requester: { select: USER_PUBLIC },
  assignee: { select: USER_PUBLIC },
  form: { select: { id: true, name: true, icon: true } },
} satisfies Prisma.RequestInclude;

const DETAIL_INCLUDE = {
  ...REQ_INCLUDE,
  events: { orderBy: { createdAt: 'asc' }, include: { actor: { select: USER_PUBLIC } } },
  attachments: { orderBy: { createdAt: 'asc' }, include: { uploadedBy: USER_MIN } },
  escalations: {
    orderBy: { createdAt: 'desc' },
    include: { requestedBy: USER_MIN, targetUser: USER_MIN, targetArea: { select: { id: true, name: true } } },
  },
  mailLogs: { orderBy: { createdAt: 'asc' } },
} satisfies Prisma.RequestInclude;

type Req = Prisma.RequestGetPayload<{ include: typeof REQ_INCLUDE }>;

/** Agrega código legible e indicadores de ANS (tiempo consumido, vencida) */
export function toDto<T extends { seq: number; status: RequestStatus; createdAt: Date; dueAt: Date; resolvedAt: Date | null }>(r: T) {
  const now = Date.now();
  const open = OPEN.includes(r.status);
  const start = r.createdAt.getTime();
  const due = r.dueAt.getTime();
  const end = r.resolvedAt ? r.resolvedAt.getTime() : now;
  return {
    ...r,
    code: formatCode(r.seq),
    isOverdue: open && now > due,
    resolvedLate: !!r.resolvedAt && r.resolvedAt.getTime() > due,
    slaProgress: Math.max(0, (end - start) / Math.max(1, due - start)),
    remainingMs: due - now,
  };
}

const asRecipient = (u: { id: string; email: string; name: string } | null | undefined): Recipient | null =>
  u ? { id: u.id, email: u.email, name: u.name } : null;

@Injectable()
export class RequestsService {
  constructor(
    private prisma: PrismaService,
    private notifier: NotifierService,
  ) {}

  // ---------------------------------------------------------------- lectura
  async list(u: AuthUser, q: ListQuery) {
    const where: Prisma.RequestWhereInput = {};
    const scope = q.scope || 'mine';
    if (scope === 'mine') where.requesterId = u.id;
    else if (scope === 'assigned') where.assigneeId = u.id;
    else if (scope === 'area') {
      if (!isSuper(u)) where.areaId = { in: u.leaderAreaIds };
    } else if (scope === 'all') {
      if (!isSuper(u)) {
        if (u.role !== 'COMPANY_ADMIN' || !u.companyId) throw new ForbiddenException();
        where.companyId = u.companyId;
      }
    }
    if (q.areaId) {
      if (scope === 'area' && !isLeaderOf(u, q.areaId)) throw new ForbiddenException('No eres líder de esta área');
      where.areaId = q.areaId;
    }
    if (q.companyId) where.companyId = q.companyId;
    if (q.priority) where.priority = q.priority as any;
    if (q.status) where.status = { in: q.status.split(',') as RequestStatus[] };
    if (q.overdue === 'true') {
      where.status = { in: OPEN };
      where.dueAt = { lt: new Date() };
    }
    if (q.q?.trim()) {
      const n = parseInt(q.q.replace(/\D/g, ''), 10);
      where.OR = [
        { subject: { contains: q.q, mode: 'insensitive' } },
        { requester: { name: { contains: q.q, mode: 'insensitive' } } },
        ...(n ? [{ seq: n }] : []),
      ];
    }
    const page = Math.max(1, parseInt(q.page || '1', 10) || 1);
    const pageSize = Math.min(100, Math.max(5, parseInt(q.pageSize || '20', 10) || 20));
    const [items, total] = await this.prisma.$transaction([
      this.prisma.request.findMany({
        where,
        include: REQ_INCLUDE,
        orderBy: [{ createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.request.count({ where }),
    ]);
    return { items: items.map(toDto), total, page, pageSize };
  }

  /** Datos del tablero principal según el rol del usuario */
  async overview(u: AuthUser) {
    const now = new Date();
    const led = isSuper(u) || u.leaderAreaIds.length > 0;
    const areaWhere: Prisma.RequestWhereInput = isSuper(u) ? {} : { areaId: { in: u.leaderAreaIds } };
    const c = (where: Prisma.RequestWhereInput) => this.prisma.request.count({ where });

    const [pendingAssignment, escalations, toAccept, inProgress, overdueArea, overdueMine, myOpen] = await Promise.all([
      led ? c({ ...areaWhere, status: 'PENDING_ASSIGNMENT' }) : 0,
      led ? c({ ...areaWhere, status: 'ESCALATION_REQUESTED' }) : 0,
      c({ assigneeId: u.id, status: 'ASSIGNED' }),
      c({ assigneeId: u.id, status: 'IN_PROGRESS' }),
      led ? c({ ...areaWhere, status: { in: OPEN }, dueAt: { lt: now } }) : 0,
      c({ assigneeId: u.id, status: { in: OPEN }, dueAt: { lt: now } }),
      c({ requesterId: u.id, status: { in: OPEN } }),
    ]);

    const myTasks = await this.prisma.request.findMany({
      where: { assigneeId: u.id, status: { in: WORKING } },
      orderBy: { dueAt: 'asc' },
      take: 8,
      include: REQ_INCLUDE,
    });
    const areaQueue = led
      ? await this.prisma.request.findMany({
          where: { ...areaWhere, status: { in: ['PENDING_ASSIGNMENT', 'ESCALATION_REQUESTED'] } },
          orderBy: { dueAt: 'asc' },
          take: 6,
          include: REQ_INCLUDE,
        })
      : [];

    const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const to = new Date(now.getFullYear(), now.getMonth() + 3, 0);
    const calendar = await this.prisma.request.findMany({
      where: {
        status: { in: OPEN },
        dueAt: { gte: from, lte: to },
        OR: [{ assigneeId: u.id }, { requesterId: u.id }, ...(led ? [areaWhere] : [])],
      },
      select: { id: true, seq: true, subject: true, dueAt: true, status: true, priority: true, area: { select: { name: true } } },
      orderBy: { dueAt: 'asc' },
      take: 300,
    });

    // Cumplimiento de los últimos 90 días (anillos de progreso)
    const since = new Date(now.getTime() - 90 * 86400000);
    const resolved = await this.prisma.request.findMany({
      where: {
        status: 'RESOLVED',
        resolvedAt: { gte: since },
        ...(led ? areaWhere : { assigneeId: u.id }),
      },
      select: { areaId: true, dueAt: true, resolvedAt: true, area: { select: { name: true } } },
    });
    const byArea = new Map<string, { label: string; total: number; onTime: number }>();
    for (const r of resolved) {
      const key = led ? r.areaId : 'me';
      const e = byArea.get(key) || { label: led ? r.area.name : 'Mi cumplimiento', total: 0, onTime: 0 };
      e.total++;
      if (r.resolvedAt && r.resolvedAt <= r.dueAt) e.onTime++;
      byArea.set(key, e);
    }
    const compliance = [...byArea.values()]
      .sort((a, b) => b.total - a.total)
      .slice(0, 4)
      .map((e) => ({ ...e, pct: e.total ? Math.round((e.onTime / e.total) * 100) : 0 }));

    const nextDue = [...myTasks, ...areaQueue].sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime())[0];

    return {
      counts: { pendingAssignment, escalations, toAccept, inProgress, overdueArea, overdueMine, myOpen },
      isLeader: led,
      myTasks: myTasks.map(toDto),
      areaQueue: areaQueue.map(toDto),
      calendar: calendar.map((r) => ({ ...r, code: formatCode(r.seq), isOverdue: r.dueAt < now })),
      compliance,
      nextDue: nextDue ? toDto(nextDue) : null,
    };
  }

  async detail(u: AuthUser, id: string) {
    const r = await this.prisma.request.findUnique({ where: { id }, include: DETAIL_INCLUDE });
    if (!r) throw new NotFoundException('Solicitud no encontrada');
    if (!this.canView(u, r)) throw new ForbiddenException('No tienes acceso a esta solicitud');
    return { ...toDto(r), permissions: this.permissions(u, r) };
  }

  private canView(u: AuthUser, r: Prisma.RequestGetPayload<{ include: typeof DETAIL_INCLUDE }>) {
    return (
      isSuper(u) ||
      r.requesterId === u.id ||
      r.assigneeId === u.id ||
      isLeaderOf(u, r.areaId) ||
      (u.role === 'COMPANY_ADMIN' && u.companyId === r.companyId) ||
      r.events.some((e) => e.actorId === u.id || e.toUserId === u.id || e.fromUserId === u.id)
    );
  }

  private permissions(u: AuthUser, r: { status: RequestStatus; areaId: string; assigneeId: string | null; requesterId: string }) {
    const leader = isLeaderOf(u, r.areaId);
    const assignee = r.assigneeId === u.id;
    const open = OPEN.includes(r.status);
    return {
      isLeader: leader,
      isAssignee: assignee,
      isRequester: r.requesterId === u.id,
      canAssign: leader && r.status === 'PENDING_ASSIGNMENT',
      canAccept: assignee && r.status === 'ASSIGNED',
      canEscalate: assignee && (r.status === 'ASSIGNED' || r.status === 'IN_PROGRESS'),
      canRespond: assignee && r.status === 'IN_PROGRESS',
      canResolveEscalation: leader && r.status === 'ESCALATION_REQUESTED',
      canReassign: leader && WORKING.includes(r.status),
      canTransfer: leader && open,
      canComment: open,
      canCancel: r.requesterId === u.id && open,
    };
  }

  // ---------------------------------------------------------------- acciones
  private async load(id: string) {
    const r = await this.prisma.request.findUnique({ where: { id }, include: REQ_INCLUDE });
    if (!r) throw new NotFoundException('Solicitud no encontrada');
    return r;
  }

  private async isAreaMember(userId: string, areaId: string) {
    return !!(await this.prisma.areaMember.findFirst({ where: { userId, areaId, user: { active: true } } }));
  }

  private event(requestId: string, type: EventType, actorId: string | null, extra: Partial<Prisma.RequestEventUncheckedCreateInput> = {}) {
    return { requestId, type, actorId, ...extra };
  }

  async create(u: AuthUser, dto: CreateRequestDto) {
    const form = await this.prisma.requestForm.findUnique({
      where: { id: dto.formId },
      include: { area: { include: { companies: true } } },
    });
    if (!form || !form.active || !form.area.active) throw new NotFoundException('El formulario no está disponible');
    const companyId = u.companyId || dto.companyId;
    if (!companyId) throw new BadRequestException('Selecciona la empresa desde la que haces la solicitud');
    if (!form.area.companies.some((c) => c.companyId === companyId))
      throw new BadRequestException('Esta área no atiende solicitudes de tu empresa');

    const fields = form.fields as unknown as FormField[];
    const { clean, files } = validateData(fields, dto.data || {});
    const now = new Date();

    const r = await this.prisma.request.create({
      data: {
        subject: dto.subject.trim(),
        formId: form.id,
        formSnapshot: fields as any,
        data: clean as any,
        areaId: form.areaId,
        originAreaId: form.areaId,
        companyId,
        requesterId: u.id,
        priority: dto.priority || form.defaultPriority,
        slaDays: form.slaDays,
        dueAt: addBusinessDays(now, form.slaDays),
        attachments: {
          create: files.map((f) => ({ kind: 'REQUEST', fileName: f.fileName, url: f.url, mimeType: f.mimeType, size: f.size || 0, uploadedById: u.id })),
        },
        events: {
          create: {
            type: 'CREATED',
            actorId: u.id,
            toAreaId: form.areaId,
            message: `Solicitud radicada en ${form.area.name}. Plazo de respuesta: ${form.slaDays} día(s) hábil(es).`,
            meta: { toAreaName: form.area.name, formName: form.name },
          },
        },
      },
      include: REQ_INCLUDE,
    });

    const leaders = await this.notifier.leadersOf(r.areaId);
    await this.notifier.notify({
      request: r,
      event: 'CREATED',
      recipients: leaders,
      title: 'Nueva solicitud en tu área',
      intro: `${u.name} radicó una solicitud de "${form.name}" que requiere asignación.`,
    });
    await this.notifier.notify({
      request: r,
      event: 'CREATED',
      recipients: [asRecipient({ id: u.id, email: u.email, name: u.name })],
      title: 'Recibimos tu solicitud',
      intro: `Tu solicitud fue radicada en ${r.area.name}. Te avisaremos cada vez que avance.`,
      tone: 'success',
    });
    return toDto(r);
  }

  async assign(u: AuthUser, id: string, dto: AssignDto) {
    const r = await this.load(id);
    if (!isLeaderOf(u, r.areaId)) throw new ForbiddenException('Solo el líder del área puede asignar');
    if (r.status !== 'PENDING_ASSIGNMENT') throw new BadRequestException('La solicitud ya fue asignada');
    return this.setAssignee(u, r, dto.assigneeId, dto.note, 'ASSIGNED');
  }

  async reassign(u: AuthUser, id: string, dto: AssignDto) {
    const r = await this.load(id);
    if (!isLeaderOf(u, r.areaId)) throw new ForbiddenException('Solo el líder del área puede reasignar');
    if (!WORKING.includes(r.status)) throw new BadRequestException('La solicitud no se puede reasignar en su estado actual');
    if (r.assigneeId === dto.assigneeId && r.status !== 'ESCALATION_REQUESTED')
      throw new BadRequestException('La solicitud ya está asignada a esa persona');
    return this.setAssignee(u, r, dto.assigneeId, dto.note, 'REASSIGNED');
  }

  /** Asignación / reasignación. Si el líder se la asigna a sí mismo queda aceptada automáticamente. */
  private async setAssignee(u: AuthUser, r: Req, assigneeId: string, note: string | undefined, type: 'ASSIGNED' | 'REASSIGNED') {
    if (!(await this.isAreaMember(assigneeId, r.areaId))) throw new BadRequestException('La persona debe pertenecer al área');
    const assignee = await this.prisma.user.findUniqueOrThrow({ where: { id: assigneeId }, select: { id: true, name: true, email: true } });
    const self = assigneeId === u.id;
    const now = new Date();
    const previous = r.assignee;

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.escalation.updateMany({
        where: { requestId: r.id, status: 'PENDING' },
        data: { status: 'RESOLVED', resolution: 'REASSIGNED', resolutionNote: note, resolvedById: u.id, resolvedAt: now },
      });
      await tx.requestEvent.create({
        data: this.event(r.id, type, u.id, {
          fromUserId: previous?.id,
          toUserId: assignee.id,
          message: note || (self ? 'El líder tomó la solicitud' : undefined),
          meta: { fromUserName: previous?.name, toUserName: assignee.name },
        }),
      });
      if (self)
        await tx.requestEvent.create({ data: this.event(r.id, 'ACCEPTED', u.id, { message: 'Aceptada automáticamente (autoasignación)' }) });
      return tx.request.update({
        where: { id: r.id },
        data: {
          assigneeId: assignee.id,
          status: self ? 'IN_PROGRESS' : 'ASSIGNED',
          assignedAt: now,
          acceptedAt: self ? now : null,
        },
        include: REQ_INCLUDE,
      });
    });

    await this.notifier.notify({
      request: updated,
      event: type,
      recipients: [asRecipient(assignee)],
      excludeUserId: self ? undefined : u.id,
      title: type === 'ASSIGNED' ? 'Se te asignó una solicitud' : 'Se te reasignó una solicitud',
      intro: self
        ? 'Tomaste esta solicitud; ya está en gestión.'
        : `${u.name} te asignó esta solicitud. Ingresa para aceptarla o solicitar escalamiento.`,
      message: note ? { label: 'Nota del líder', text: note } : undefined,
    });
    if (previous && previous.id !== assignee.id)
      await this.notifier.notify({
        request: updated,
        event: type,
        recipients: [asRecipient(previous as any)],
        excludeUserId: u.id,
        title: 'La solicitud fue reasignada',
        intro: `${u.name} reasignó la solicitud a ${assignee.name}. Ya no está a tu cargo.`,
      });
    await this.notifier.notify({
      request: updated,
      event: type,
      recipients: [asRecipient(updated.requester as any)],
      excludeUserId: u.id,
      title: 'Tu solicitud tiene responsable',
      intro: `${assignee.name} será quien atienda tu solicitud.`,
    });
    return toDto(updated);
  }

  async accept(u: AuthUser, id: string) {
    const r = await this.load(id);
    if (r.assigneeId !== u.id) throw new ForbiddenException('La solicitud no está asignada a ti');
    if (r.status !== 'ASSIGNED') throw new BadRequestException('La solicitud no está pendiente de aceptación');
    const updated = await this.prisma.request.update({
      where: { id },
      data: { status: 'IN_PROGRESS', acceptedAt: new Date(), events: { create: { type: 'ACCEPTED', actorId: u.id } } },
      include: REQ_INCLUDE,
    });
    await this.notifier.notify({
      request: updated,
      event: 'ACCEPTED',
      recipients: [...(await this.notifier.leadersOf(r.areaId)), asRecipient(updated.requester as any)],
      excludeUserId: u.id,
      title: 'Solicitud aceptada',
      intro: `${u.name} aceptó la solicitud y ya está trabajando en ella.`,
    });
    return toDto(updated);
  }

  async escalate(u: AuthUser, id: string, dto: EscalateDto) {
    const r = await this.load(id);
    if (r.assigneeId !== u.id) throw new ForbiddenException('Solo el responsable puede solicitar escalamiento');
    if (r.status !== 'ASSIGNED' && r.status !== 'IN_PROGRESS') throw new BadRequestException('No se puede escalar en el estado actual');
    let targetName = '';
    if (dto.targetType === 'USER') {
      if (!dto.targetUserId) throw new BadRequestException('Selecciona la persona a la que propones escalar');
      const t = await this.prisma.user.findUnique({ where: { id: dto.targetUserId } });
      if (!t) throw new BadRequestException('Persona no encontrada');
      targetName = t.name;
    } else {
      if (!dto.targetAreaId) throw new BadRequestException('Selecciona el área a la que propones escalar');
      const a = await this.prisma.area.findUnique({ where: { id: dto.targetAreaId } });
      if (!a) throw new BadRequestException('Área no encontrada');
      targetName = a.name;
    }
    const updated = await this.prisma.request.update({
      where: { id },
      data: {
        status: 'ESCALATION_REQUESTED',
        escalations: {
          create: {
            requestedById: u.id,
            targetType: dto.targetType,
            targetUserId: dto.targetType === 'USER' ? dto.targetUserId : null,
            targetAreaId: dto.targetType === 'AREA' ? dto.targetAreaId : null,
            reason: dto.reason,
          },
        },
        events: {
          create: {
            type: 'ESCALATION_REQUESTED',
            actorId: u.id,
            toUserId: dto.targetType === 'USER' ? dto.targetUserId : null,
            toAreaId: dto.targetType === 'AREA' ? dto.targetAreaId : null,
            message: dto.reason,
            meta: { targetType: dto.targetType, targetName, previousStatus: r.status },
          },
        },
      },
      include: REQ_INCLUDE,
    });
    await this.notifier.notify({
      request: updated,
      event: 'ESCALATION_REQUESTED',
      recipients: await this.notifier.leadersOf(r.areaId),
      excludeUserId: u.id,
      title: 'Solicitud de escalamiento',
      intro: `${u.name} no puede atender la solicitud y propone escalarla a ${dto.targetType === 'USER' ? 'la persona' : 'el área'} "${targetName}". Debes reasignarla o trasladarla.`,
      message: { label: 'Motivo', text: dto.reason },
      tone: 'warning',
    });
    return toDto(updated);
  }

  async rejectEscalation(u: AuthUser, id: string, dto: NoteDto) {
    const r = await this.load(id);
    if (!isLeaderOf(u, r.areaId)) throw new ForbiddenException();
    if (r.status !== 'ESCALATION_REQUESTED') throw new BadRequestException('No hay un escalamiento pendiente');
    const now = new Date();
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.escalation.updateMany({
        where: { requestId: id, status: 'PENDING' },
        data: { status: 'RESOLVED', resolution: 'REJECTED', resolutionNote: dto.note, resolvedById: u.id, resolvedAt: now },
      });
      return tx.request.update({
        where: { id },
        data: {
          status: r.acceptedAt ? 'IN_PROGRESS' : 'ASSIGNED',
          events: { create: { type: 'ESCALATION_REJECTED', actorId: u.id, toUserId: r.assigneeId, message: dto.note, meta: { toUserName: r.assignee?.name } } },
        },
        include: REQ_INCLUDE,
      });
    });
    await this.notifier.notify({
      request: updated,
      event: 'ESCALATION_REJECTED',
      recipients: [asRecipient(updated.assignee as any)],
      excludeUserId: u.id,
      title: 'El escalamiento no fue aprobado',
      intro: `${u.name} revisó tu solicitud de escalamiento y la solicitud continúa a tu cargo.`,
      message: { label: 'Indicaciones del líder', text: dto.note },
      tone: 'warning',
    });
    return toDto(updated);
  }

  async transfer(u: AuthUser, id: string, dto: TransferDto) {
    const r = await this.load(id);
    if (!isLeaderOf(u, r.areaId)) throw new ForbiddenException('Solo el líder del área puede trasladar');
    if (!OPEN.includes(r.status)) throw new BadRequestException('La solicitud ya está cerrada');
    if (dto.areaId === r.areaId) throw new BadRequestException('Selecciona un área diferente');
    const target = await this.prisma.area.findUnique({ where: { id: dto.areaId }, include: { companies: true } });
    if (!target || !target.active) throw new BadRequestException('Área de destino no encontrada');
    if (!target.companies.some((c) => c.companyId === r.companyId))
      throw new BadRequestException(`${target.name} no atiende solicitudes de ${r.company.name}`);
    const now = new Date();
    const previous = r.assignee;
    const newDue = dto.extraDays ? addBusinessDays(r.dueAt, dto.extraDays) : r.dueAt;

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.escalation.updateMany({
        where: { requestId: id, status: 'PENDING' },
        data: { status: 'RESOLVED', resolution: 'TRANSFERRED', resolutionNote: dto.note, resolvedById: u.id, resolvedAt: now },
      });
      return tx.request.update({
        where: { id },
        data: {
          areaId: target.id,
          assigneeId: null,
          status: 'PENDING_ASSIGNMENT',
          assignedAt: null,
          acceptedAt: null,
          dueAt: newDue,
          ...(dto.extraDays ? { dueSoonNotifiedAt: null, overdueNotifiedAt: null } : {}),
          events: {
            create: {
              type: 'TRANSFERRED',
              actorId: u.id,
              fromAreaId: r.areaId,
              toAreaId: target.id,
              fromUserId: previous?.id,
              message: dto.note,
              meta: { fromAreaName: r.area.name, toAreaName: target.name, fromUserName: previous?.name, extraDays: dto.extraDays || 0 },
            },
          },
        },
        include: REQ_INCLUDE,
      });
    });

    await this.notifier.notify({
      request: updated,
      event: 'TRANSFERRED',
      recipients: await this.notifier.leadersOf(target.id),
      excludeUserId: u.id,
      title: 'Solicitud trasladada a tu área',
      intro: `${u.name} (${r.area.name}) trasladó esta solicitud a ${target.name}. Requiere asignación.`,
      message: { label: 'Motivo del traslado', text: dto.note },
    });
    await this.notifier.notify({
      request: updated,
      event: 'TRANSFERRED',
      recipients: [asRecipient(updated.requester as any), asRecipient(previous as any)],
      excludeUserId: u.id,
      title: 'La solicitud cambió de área',
      intro: `La solicitud pasó de ${r.area.name} a ${target.name}.`,
      message: { label: 'Motivo del traslado', text: dto.note },
    });
    return toDto(updated);
  }

  async respond(u: AuthUser, id: string, dto: RespondDto) {
    const r = await this.load(id);
    if (r.assigneeId !== u.id) throw new ForbiddenException('Solo el responsable puede responder');
    if (r.status !== 'IN_PROGRESS') throw new BadRequestException('Debes aceptar la solicitud antes de responderla');
    const now = new Date();
    const late = now > r.dueAt;
    const updated = await this.prisma.$transaction(async (tx) => {
      const ev = await tx.requestEvent.create({
        data: this.event(id, 'RESPONDED', u.id, {
          message: dto.responseText,
          meta: { late, attachments: dto.attachments?.length || 0 },
        }),
      });
      if (dto.attachments?.length)
        await tx.attachment.createMany({
          data: dto.attachments.map((a) => ({ ...a, size: a.size || 0, requestId: id, kind: 'RESPONSE', eventId: ev.id, uploadedById: u.id })),
        });
      return tx.request.update({
        where: { id },
        data: { status: 'RESOLVED', resolvedAt: now, responseText: dto.responseText },
        include: REQ_INCLUDE,
      });
    });
    await this.notifier.notify({
      request: updated,
      event: 'RESPONDED',
      recipients: [asRecipient(updated.requester as any), ...(await this.notifier.leadersOf(r.areaId))],
      excludeUserId: u.id,
      title: 'Solicitud respondida',
      intro: `${u.name} respondió la solicitud${late ? ' (fuera del plazo establecido)' : ' dentro del plazo'}.${dto.attachments?.length ? ` Incluye ${dto.attachments.length} adjunto(s).` : ''}`,
      message: { label: 'Respuesta', text: dto.responseText },
      tone: late ? 'warning' : 'success',
    });
    return toDto(updated);
  }

  async comment(u: AuthUser, id: string, dto: CommentDto) {
    const detail = await this.detail(u, id);
    if (!detail.permissions.canComment) throw new BadRequestException('La solicitud está cerrada');
    const ev = await this.prisma.$transaction(async (tx) => {
      const e = await tx.requestEvent.create({ data: this.event(id, 'COMMENTED', u.id, { message: dto.message }) });
      if (dto.attachments?.length)
        await tx.attachment.createMany({
          data: dto.attachments.map((a) => ({ ...a, size: a.size || 0, requestId: id, kind: 'COMMENT', eventId: e.id, uploadedById: u.id })),
        });
      return e;
    });
    const r = await this.load(id);
    await this.notifier.notify({
      request: r,
      event: 'COMMENTED',
      recipients: [asRecipient(r.requester as any), asRecipient(r.assignee as any), ...(await this.notifier.leadersOf(r.areaId))],
      excludeUserId: u.id,
      title: 'Nuevo comentario',
      intro: `${u.name} comentó en la solicitud.`,
      message: { label: 'Comentario', text: dto.message },
    });
    return ev;
  }

  async cancel(u: AuthUser, id: string, dto: NoteDto) {
    const r = await this.load(id);
    if (r.requesterId !== u.id && !isSuper(u)) throw new ForbiddenException('Solo el solicitante puede anular la solicitud');
    if (!OPEN.includes(r.status)) throw new BadRequestException('La solicitud ya está cerrada');
    const updated = await this.prisma.request.update({
      where: { id },
      data: { status: 'CANCELLED', events: { create: { type: 'CANCELLED', actorId: u.id, message: dto.note } } },
      include: REQ_INCLUDE,
    });
    await this.notifier.notify({
      request: updated,
      event: 'CANCELLED',
      recipients: [asRecipient(updated.assignee as any), ...(await this.notifier.leadersOf(r.areaId))],
      excludeUserId: u.id,
      title: 'Solicitud anulada',
      intro: `${u.name} anuló la solicitud.`,
      message: { label: 'Motivo', text: dto.note },
      tone: 'warning',
    });
    return toDto(updated);
  }
}
