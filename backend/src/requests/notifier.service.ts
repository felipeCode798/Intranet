import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { formatCode, PRIORITY_LABEL, STATUS_LABEL } from '../common/business-days';
import { EmailTemplate, MailService, renderEmail } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';

export interface Recipient {
  id: string;
  email: string;
  name: string;
}

export interface NotifyInput {
  request: any; // Request con area, company, form, requester y assignee
  event: string;
  recipients: (Recipient | null | undefined)[];
  excludeUserId?: string;
  title: string;
  intro: string;
  message?: { label: string; text: string };
  tone?: EmailTemplate['tone'];
}

const fmtDate = (d: Date | string) =>
  new Date(d).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Bogota' });

/** Envía notificaciones internas + correo para cada evento de una solicitud */
@Injectable()
export class NotifierService {
  private readonly frontendUrl: string;

  constructor(
    private prisma: PrismaService,
    private mail: MailService,
    config: ConfigService,
  ) {
    this.frontendUrl = (config.get<string>('FRONTEND_URL', 'http://localhost:5173') || '').split(',')[0].replace(/\/$/, '');
  }

  /** Líderes del área; si no tiene, los superadministradores */
  async leadersOf(areaId: string): Promise<Recipient[]> {
    const leaders = await this.prisma.areaMember.findMany({
      where: { areaId, role: 'LEADER', user: { active: true } },
      include: { user: { select: { id: true, email: true, name: true } } },
    });
    if (leaders.length) return leaders.map((l) => l.user);
    return this.prisma.user.findMany({ where: { role: 'SUPER_ADMIN', active: true }, select: { id: true, email: true, name: true } });
  }

  link(requestId: string) {
    return `${this.frontendUrl}/solicitudes/${requestId}`;
  }

  async notify(input: NotifyInput) {
    const r = input.request;
    const map = new Map<string, Recipient>();
    for (const rc of input.recipients) if (rc && rc.id !== input.excludeUserId) map.set(rc.id, rc);
    const recipients = [...map.values()];
    if (!recipients.length) return;
    const code = formatCode(r.seq);

    await this.prisma.notification.createMany({
      data: recipients.map((rc) => ({
        userId: rc.id,
        requestId: r.id,
        type: input.event,
        title: `${input.title} · ${code}`,
        body: `${r.subject} — ${input.intro}`.slice(0, 500),
      })),
    });

    const html = renderEmail({
      color: r.company?.primaryColor,
      companyName: r.company?.name,
      heading: input.title,
      intro: input.intro,
      tone: input.tone,
      message: input.message,
      rows: [
        ['Código', code],
        ['Asunto', r.subject],
        ['Tipo de solicitud', r.form?.name ?? '—'],
        ['Área', r.area?.name ?? '—'],
        ['Empresa', r.company?.name ?? '—'],
        ['Solicitante', r.requester?.name ?? '—'],
        ['Responsable', r.assignee?.name ?? 'Sin asignar'],
        ['Prioridad', PRIORITY_LABEL[r.priority] ?? r.priority],
        ['Estado', STATUS_LABEL[r.status] ?? r.status],
        ['Fecha límite', fmtDate(r.dueAt)],
      ],
      ctaLabel: 'Ver solicitud',
      ctaUrl: this.link(r.id),
    });

    // Fuera del flujo principal: un fallo de correo no debe romper la acción
    void this.mail.send({
      to: recipients.map((x) => x.email),
      subject: `[${code}] ${input.title} · ${r.subject}`,
      html,
      event: input.event,
      requestId: r.id,
    });
  }
}
