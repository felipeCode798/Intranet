import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { NotifierService } from './notifier.service';
import { OPEN, REQ_INCLUDE } from './requests.service';

/**
 * Alertas de ANS:
 *  - "Por vencer": una vez, cuando faltan menos de SLA_DUE_SOON_HOURS.
 *  - "Vencida": al vencer y luego cada SLA_OVERDUE_REPEAT_HOURS mientras siga abierta.
 * Van al responsable (o a los líderes si aún no está asignada) y siempre a los líderes del área.
 */
@Injectable()
export class SlaService {
  private readonly logger = new Logger(SlaService.name);
  private running = false;

  constructor(
    private prisma: PrismaService,
    private notifier: NotifierService,
    private config: ConfigService,
  ) {}

  @Cron(CronExpression.EVERY_10_MINUTES)
  async tick() {
    if (this.running) return;
    this.running = true;
    try {
      const res = await this.run();
      if (res.dueSoon || res.overdue) this.logger.log(`Alertas ANS: ${res.dueSoon} por vencer, ${res.overdue} vencidas`);
    } catch (e) {
      this.logger.error(e);
    } finally {
      this.running = false;
    }
  }

  async run() {
    const now = new Date();
    const soonHours = Number(this.config.get('SLA_DUE_SOON_HOURS', 24));
    const repeatHours = Number(this.config.get('SLA_OVERDUE_REPEAT_HOURS', 24));

    const dueSoon = await this.prisma.request.findMany({
      where: {
        status: { in: OPEN },
        dueSoonNotifiedAt: null,
        dueAt: { gt: now, lte: new Date(now.getTime() + soonHours * 3600000) },
      },
      include: REQ_INCLUDE,
    });
    for (const r of dueSoon) {
      await this.prisma.request.update({
        where: { id: r.id },
        data: {
          dueSoonNotifiedAt: now,
          events: { create: { type: 'DUE_SOON_ALERT', message: `La solicitud vence en menos de ${soonHours} horas.` } },
        },
      });
      const leaders = await this.notifier.leadersOf(r.areaId);
      await this.notifier.notify({
        request: r,
        event: 'DUE_SOON_ALERT',
        recipients: r.assignee ? [r.assignee as any, ...leaders] : leaders,
        title: 'Solicitud por vencer',
        intro: `Esta solicitud vence pronto. Gestiónala antes de la fecha límite para cumplir el ANS.`,
        tone: 'warning',
      });
    }

    const overdue = await this.prisma.request.findMany({
      where: {
        status: { in: OPEN },
        dueAt: { lte: now },
        OR: [{ overdueNotifiedAt: null }, { overdueNotifiedAt: { lte: new Date(now.getTime() - repeatHours * 3600000) } }],
      },
      include: REQ_INCLUDE,
    });
    for (const r of overdue) {
      const days = Math.max(1, Math.ceil((now.getTime() - r.dueAt.getTime()) / 86400000));
      const first = !r.overdueNotifiedAt;
      await this.prisma.request.update({
        where: { id: r.id },
        data: {
          overdueNotifiedAt: now,
          events: {
            create: { type: 'OVERDUE_ALERT', message: first ? 'La solicitud superó el plazo de respuesta.' : `Recordatorio: ${days} día(s) de atraso.` },
          },
        },
      });
      const leaders = await this.notifier.leadersOf(r.areaId);
      await this.notifier.notify({
        request: r,
        event: 'OVERDUE_ALERT',
        recipients: r.assignee ? [r.assignee as any, ...leaders] : leaders,
        title: first ? 'Solicitud vencida' : `Solicitud con ${days} día(s) de atraso`,
        intro: 'La solicitud superó el plazo de respuesta establecido y sigue abierta. Requiere atención inmediata.',
        tone: 'danger',
      });
    }
    return { dueSoon: dueSoon.length, overdue: overdue.length };
  }
}
