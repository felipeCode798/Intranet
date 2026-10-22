import { Global, Injectable, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmailTemplate, MailService, renderEmail } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';

export interface NoticeInput {
  userIds: (string | null | undefined)[];
  /** Código del evento (queda en Notification.type y MailLog.event) */
  type: string;
  title: string;
  body: string;
  /** Ruta del panel, p. ej. /app/tareas */
  path: string;
  /** Si se omite no se envía correo */
  email?: Pick<EmailTemplate, 'intro' | 'rows' | 'message' | 'tone' | 'ctaLabel'> & { heading?: string; subject?: string };
}

/** Notificación interna (campana) + correo para los módulos que no son solicitudes */
@Injectable()
export class NoticeService {
  private readonly frontendUrl: string;

  constructor(
    private prisma: PrismaService,
    private mail: MailService,
    config: ConfigService,
  ) {
    this.frontendUrl = (config.get<string>('FRONTEND_URL', 'http://localhost:5173') || '').split(',')[0].replace(/\/$/, '');
  }

  async send(input: NoticeInput) {
    const ids = [...new Set(input.userIds.filter((x): x is string => !!x))];
    if (!ids.length) return;
    const users = await this.prisma.user.findMany({
      where: { id: { in: ids }, active: true },
      select: { id: true, email: true, company: { select: { name: true, primaryColor: true } } },
    });
    if (!users.length) return;

    await this.prisma.notification.createMany({
      data: users.map((u) => ({ userId: u.id, type: input.type, title: input.title, body: input.body.slice(0, 500), link: input.path })),
    });

    if (!input.email) return;
    const e = input.email;
    // Un correo por empresa para respetar su color y nombre
    const byCompany = new Map<string, typeof users>();
    for (const u of users) byCompany.set(u.company?.name || '', [...(byCompany.get(u.company?.name || '') || []), u]);
    for (const group of byCompany.values()) {
      const c = group[0].company;
      void this.mail.send({
        to: group.map((u) => u.email),
        subject: e.subject || input.title,
        event: input.type,
        html: renderEmail({
          color: c?.primaryColor,
          companyName: c?.name,
          heading: e.heading || input.title,
          intro: e.intro,
          rows: e.rows,
          message: e.message,
          tone: e.tone,
          ctaLabel: e.ctaLabel || 'Abrir en la intranet',
          ctaUrl: `${this.frontendUrl}${input.path}`,
        }),
      });
    }
  }

  /** Líderes del área sin contar a `exceptUserId`; si no hay, administradores de la empresa y, al final, superadministradores */
  async approversFor(areaId: string | null, companyId: string | null, exceptUserId: string): Promise<string[]> {
    const pick = (rows: { id: string }[]) => rows.map((r) => r.id).filter((id) => id !== exceptUserId);
    if (areaId) {
      const leaders = await this.prisma.areaMember.findMany({ where: { areaId, role: 'LEADER', user: { active: true } }, select: { userId: true } });
      const ids = leaders.map((l) => l.userId).filter((id) => id !== exceptUserId);
      if (ids.length) return ids;
    }
    if (companyId) {
      const admins = pick(await this.prisma.user.findMany({ where: { companyId, role: 'COMPANY_ADMIN', active: true }, select: { id: true } }));
      if (admins.length) return admins;
    }
    return pick(await this.prisma.user.findMany({ where: { role: 'SUPER_ADMIN', active: true }, select: { id: true } }));
  }
}

@Global()
@Module({ providers: [NoticeService], exports: [NoticeService] })
export class NoticeModule {}
