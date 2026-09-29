import { Controller, ForbiddenException, Get, Header, Injectable, Module, Query, Res } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Response } from 'express';
import { AuthUser, isLeaderOf, isSuper } from '../common/auth-user';
import { formatCode, PRIORITY_LABEL, STATUS_LABEL } from '../common/business-days';
import { CurrentUser } from '../common/decorators';
import { PrismaService } from '../prisma/prisma.service';
import { OPEN } from '../requests/requests.service';

interface ReportQuery {
  companyId?: string;
  areaId?: string;
  from?: string;
  to?: string;
}

const HOUR = 3600000;
/** "2026-04-01" se interpreta como fecha local (no UTC), para que los meses del reporte coincidan con el filtro */
const localDate = (s: string) => (/^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(`${s}T00:00:00`) : new Date(s));

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Alcance según permisos:
   *  - Superadministrador: todo el holding.
   *  - Administrador de empresa: solicitudes de su empresa (+ áreas que lidere).
   *  - Líder: sus áreas; en áreas compartidas puede filtrar por empresa.
   */
  private scope(u: AuthUser): Prisma.RequestWhereInput {
    if (isSuper(u)) return {};
    const or: Prisma.RequestWhereInput[] = [];
    if (u.role === 'COMPANY_ADMIN' && u.companyId) or.push({ companyId: u.companyId });
    if (u.leaderAreaIds.length) or.push({ areaId: { in: u.leaderAreaIds } });
    if (!or.length) throw new ForbiddenException('Los reportes están disponibles para líderes y administradores');
    return { OR: or };
  }

  private where(u: AuthUser, q: ReportQuery): Prisma.RequestWhereInput {
    const and: Prisma.RequestWhereInput[] = [this.scope(u)];
    if (q.companyId) and.push({ companyId: q.companyId });
    if (q.areaId) and.push({ areaId: q.areaId });
    if (q.from || q.to) {
      const createdAt: Prisma.DateTimeFilter = {};
      if (q.from) createdAt.gte = localDate(q.from);
      if (q.to) createdAt.lte = new Date(localDate(q.to).getTime() + 86399999);
      and.push({ createdAt });
    }
    return { AND: and };
  }

  /** Opciones de filtro disponibles para el usuario */
  async filters(u: AuthUser) {
    const scope = this.scope(u);
    const [areaIds, companyIds] = await Promise.all([
      this.prisma.request.findMany({ where: scope, distinct: ['areaId'], select: { areaId: true } }),
      this.prisma.request.findMany({ where: scope, distinct: ['companyId'], select: { companyId: true } }),
    ]);
    const extraAreas = isSuper(u) ? [] : u.leaderAreaIds;
    const [areas, companies] = await Promise.all([
      this.prisma.area.findMany({
        where: isSuper(u) ? { active: true } : { id: { in: [...new Set([...areaIds.map((a) => a.areaId), ...extraAreas])] } },
        select: { id: true, name: true, isShared: true, companies: { select: { companyId: true } } },
        orderBy: { name: 'asc' },
      }),
      this.prisma.company.findMany({
        where: isSuper(u) ? {} : { id: { in: [...new Set([...companyIds.map((c) => c.companyId), ...(u.companyId ? [u.companyId] : [])])] } },
        select: { id: true, name: true, primaryColor: true },
        orderBy: { name: 'asc' },
      }),
    ]);
    return { areas: areas.map((a) => ({ ...a, companyIds: a.companies.map((c) => c.companyId), companies: undefined })), companies };
  }

  private rows(u: AuthUser, q: ReportQuery) {
    if (q.areaId && !isSuper(u) && !isLeaderOf(u, q.areaId) && u.role !== 'COMPANY_ADMIN')
      throw new ForbiddenException('No eres líder de esta área');
    return this.prisma.request.findMany({
      where: this.where(u, q),
      select: {
        id: true,
        seq: true,
        subject: true,
        status: true,
        priority: true,
        createdAt: true,
        dueAt: true,
        assignedAt: true,
        acceptedAt: true,
        resolvedAt: true,
        areaId: true,
        companyId: true,
        assigneeId: true,
        area: { select: { name: true, isShared: true } },
        company: { select: { name: true, primaryColor: true } },
        assignee: { select: { name: true } },
        requester: { select: { name: true } },
        form: { select: { name: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async summary(u: AuthUser, q: ReportQuery) {
    const rows = await this.rows(u, q);
    const now = Date.now();
    const isOpen = (s: string) => (OPEN as string[]).includes(s);
    const isOverdue = (r: (typeof rows)[number]) => isOpen(r.status) && r.dueAt.getTime() < now;
    const onTime = (r: (typeof rows)[number]) => !!r.resolvedAt && r.resolvedAt <= r.dueAt;
    const resolved = rows.filter((r) => r.status === 'RESOLVED');
    const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

    const kpis = {
      total: rows.length,
      open: rows.filter((r) => isOpen(r.status)).length,
      resolved: resolved.length,
      cancelled: rows.filter((r) => r.status === 'CANCELLED').length,
      overdue: rows.filter(isOverdue).length,
      resolvedOnTime: resolved.filter(onTime).length,
      onTimeRate: resolved.length ? Math.round((resolved.filter(onTime).length / resolved.length) * 1000) / 10 : 0,
      avgResolutionHours: Math.round(avg(resolved.map((r) => (r.resolvedAt!.getTime() - r.createdAt.getTime()) / HOUR)) * 10) / 10,
      avgAcceptHours:
        Math.round(avg(rows.filter((r) => r.acceptedAt && r.assignedAt).map((r) => (r.acceptedAt!.getTime() - r.assignedAt!.getTime()) / HOUR)) * 10) / 10,
      escalated: 0,
    };
    kpis.escalated = await this.prisma.escalation.count({ where: { request: this.where(u, q) } });

    const byStatus = Object.keys(STATUS_LABEL).map((status) => ({
      status,
      label: STATUS_LABEL[status],
      count: rows.filter((r) => r.status === status).length,
    }));

    // Serie mensual: radicadas, respondidas a tiempo y fuera de plazo
    const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const months = new Map<string, { month: string; created: number; resolvedOnTime: number; resolvedLate: number }>();
    const start = q.from ? localDate(q.from) : new Date(new Date().getFullYear(), new Date().getMonth() - 5, 1);
    const end = q.to ? localDate(q.to) : new Date();
    for (let d = new Date(start.getFullYear(), start.getMonth(), 1); d <= end; d.setMonth(d.getMonth() + 1))
      months.set(monthKey(d), { month: monthKey(d), created: 0, resolvedOnTime: 0, resolvedLate: 0 });
    for (const r of rows) {
      months.get(monthKey(r.createdAt)) && months.get(monthKey(r.createdAt))!.created++;
      if (r.resolvedAt) {
        const m = months.get(monthKey(r.resolvedAt));
        if (m) onTime(r) ? m.resolvedOnTime++ : m.resolvedLate++;
      }
    }

    const group = <K extends string>(keyOf: (r: (typeof rows)[number]) => K | null, labelOf: (r: (typeof rows)[number]) => string, extra?: (r: (typeof rows)[number]) => object) => {
      const map = new Map<string, any>();
      for (const r of rows) {
        const k = keyOf(r);
        if (!k) continue;
        const e = map.get(k) || { id: k, name: labelOf(r), ...(extra ? extra(r) : {}), total: 0, open: 0, resolved: 0, onTime: 0, late: 0, overdue: 0, hours: [] as number[] };
        e.total++;
        if (isOpen(r.status)) e.open++;
        if (isOverdue(r)) e.overdue++;
        if (r.status === 'RESOLVED') {
          e.resolved++;
          onTime(r) ? e.onTime++ : e.late++;
          e.hours.push((r.resolvedAt!.getTime() - r.createdAt.getTime()) / HOUR);
        }
        map.set(k, e);
      }
      return [...map.values()]
        .map(({ hours, ...e }) => ({
          ...e,
          avgResolutionHours: Math.round(avg(hours) * 10) / 10,
          compliance: e.resolved ? Math.round((e.onTime / e.resolved) * 100) : null,
        }))
        .sort((a, b) => b.total - a.total);
    };

    const byArea = group((r) => r.areaId, (r) => r.area.name, (r) => ({ isShared: r.area.isShared }));
    const byCompany = group((r) => r.companyId, (r) => r.company.name, (r) => ({ color: r.company.primaryColor }));
    const byAssignee = group((r) => r.assigneeId, (r) => r.assignee?.name || '—');
    const byForm = group((r) => r.form.name, (r) => r.form.name).slice(0, 8);
    const byPriority = Object.keys(PRIORITY_LABEL).map((p) => ({
      priority: p,
      label: PRIORITY_LABEL[p],
      count: rows.filter((r) => r.priority === p).length,
    }));

    const overdueList = rows
      .filter(isOverdue)
      .sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime())
      .slice(0, 25)
      .map((r) => ({
        id: r.id,
        code: formatCode(r.seq),
        subject: r.subject,
        area: r.area.name,
        company: r.company.name,
        assignee: r.assignee?.name || null,
        status: r.status,
        dueAt: r.dueAt,
        daysLate: Math.ceil((now - r.dueAt.getTime()) / 86400000),
      }));

    return { kpis, byStatus, byMonth: [...months.values()], byArea, byCompany, byAssignee, byForm, byPriority, overdueList };
  }

  async csv(u: AuthUser, q: ReportQuery) {
    const rows = await this.rows(u, q);
    const cell = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const fmt = (d: Date | null) => (d ? d.toISOString().replace('T', ' ').slice(0, 16) : '');
    const header = ['Código', 'Radicada', 'Empresa', 'Área', 'Tipo', 'Asunto', 'Estado', 'Prioridad', 'Solicitante', 'Responsable', 'Vence', 'Respondida', 'Cumplimiento'];
    const lines = rows.map((r) =>
      [
        formatCode(r.seq),
        fmt(r.createdAt),
        r.company.name,
        r.area.name,
        r.form.name,
        r.subject,
        STATUS_LABEL[r.status],
        PRIORITY_LABEL[r.priority],
        r.requester.name,
        r.assignee?.name,
        fmt(r.dueAt),
        fmt(r.resolvedAt),
        r.resolvedAt ? (r.resolvedAt <= r.dueAt ? 'A tiempo' : 'Fuera de plazo') : r.dueAt.getTime() < Date.now() && (OPEN as string[]).includes(r.status) ? 'Vencida' : '',
      ]
        .map(cell)
        .join(';'),
    );
    return '﻿' + [header.map(cell).join(';'), ...lines].join('\r\n');
  }
}

@Controller('reports')
export class ReportsController {
  constructor(private svc: ReportsService) {}

  @Get('filters')
  filters(@CurrentUser() u: AuthUser) {
    return this.svc.filters(u);
  }

  @Get('summary')
  summary(@CurrentUser() u: AuthUser, @Query() q: ReportQuery) {
    return this.svc.summary(u, q);
  }

  @Get('export')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  async export(@CurrentUser() u: AuthUser, @Query() q: ReportQuery, @Res() res: Response) {
    res.setHeader('Content-Disposition', `attachment; filename="solicitudes-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(await this.svc.csv(u, q));
  }
}

@Module({ controllers: [ReportsController], providers: [ReportsService] })
export class ReportsModule {}
