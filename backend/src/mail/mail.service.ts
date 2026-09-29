import { Global, Injectable, Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { PrismaService } from '../prisma/prisma.service';

export interface MailOptions {
  to: string[];
  subject: string;
  html: string;
  event: string;
  requestId?: string;
}

export interface EmailTemplate {
  color?: string;
  companyName?: string;
  heading: string;
  intro: string;
  rows?: [string, string][];
  message?: { label: string; text: string };
  ctaLabel?: string;
  ctaUrl?: string;
  tone?: 'info' | 'warning' | 'danger' | 'success';
}

const esc = (s: string) =>
  String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** Plantilla HTML de correo compatible con clientes de correo (tablas + estilos en línea) */
export function renderEmail(t: EmailTemplate) {
  const color = t.color || '#5b4ff5';
  const toneColor = { info: color, warning: '#d97706', danger: '#dc2626', success: '#059669' }[t.tone || 'info'];
  const rows = (t.rows || [])
    .map(
      ([k, v]) =>
        `<tr><td style="padding:8px 0;color:#7a849b;font-size:13px;width:160px;vertical-align:top">${esc(k)}</td><td style="padding:8px 0;color:#0f1a36;font-size:13px;font-weight:600">${esc(v)}</td></tr>`,
    )
    .join('');
  const msg = t.message
    ? `<div style="margin-top:18px;padding:14px 16px;border-radius:12px;background:#f3f5fa;border-left:4px solid ${toneColor}"><div style="font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#7a849b;font-weight:700;margin-bottom:4px">${esc(t.message.label)}</div><div style="font-size:14px;color:#0f1a36;white-space:pre-wrap">${esc(t.message.text)}</div></div>`
    : '';
  const cta = t.ctaUrl
    ? `<div style="margin-top:24px"><a href="${esc(t.ctaUrl)}" style="display:inline-block;background:${color};color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:12px 22px;border-radius:12px">${esc(t.ctaLabel || 'Ver solicitud')}</a></div>`
    : '';
  return `<!doctype html><html><body style="margin:0;background:#eef0f7;font-family:Segoe UI,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef0f7;padding:28px 12px"><tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border-radius:18px;overflow:hidden">
<tr><td style="background:${color};padding:22px 28px;color:#fff">
<div style="font-size:12px;letter-spacing:.14em;text-transform:uppercase;opacity:.8">${esc(t.companyName || 'Grupo Playtech')} · Intranet</div>
<div style="font-size:21px;font-weight:700;margin-top:6px">${esc(t.heading)}</div></td></tr>
<tr><td style="padding:26px 28px">
<p style="margin:0 0 14px;color:#44506b;font-size:14px;line-height:1.6">${esc(t.intro)}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #e4e8f1">${rows}</table>
${msg}${cta}
</td></tr>
<tr><td style="padding:16px 28px;background:#f7f8fc;color:#9aa3b8;font-size:11px">Este es un mensaje automático del sistema de solicitudes de Grupo Playtech. No respondas a este correo.</td></tr>
</table></td></tr></table></body></html>`;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: nodemailer.Transporter | null;
  private readonly from: string;

  constructor(
    private prisma: PrismaService,
    config: ConfigService,
  ) {
    const host = config.get<string>('SMTP_HOST');
    this.from = config.get<string>('MAIL_FROM', 'Intranet <no-reply@grupoplaytech.com>');
    const user = config.get<string>('SMTP_USER');
    this.transporter = host
      ? nodemailer.createTransport({
          host,
          port: Number(config.get('SMTP_PORT', 1025)),
          secure: String(config.get('SMTP_SECURE', 'false')) === 'true',
          auth: user ? { user, pass: config.get<string>('SMTP_PASS') } : undefined,
        })
      : null;
    if (!host) this.logger.warn('SMTP_HOST no configurado: los correos se registrarán como SKIPPED');
  }

  /** Envía el correo y lo deja registrado en MailLog (nunca lanza error) */
  async send(opts: MailOptions) {
    const to = [...new Set(opts.to.filter(Boolean).map((e) => e.toLowerCase()))];
    if (!to.length) return;
    let status = 'SENT';
    let error: string | undefined;
    if (!this.transporter) status = 'SKIPPED';
    else {
      try {
        await this.transporter.sendMail({ from: this.from, to, subject: opts.subject, html: opts.html });
      } catch (e: any) {
        status = 'FAILED';
        error = String(e?.message || e);
        this.logger.error(`No se pudo enviar "${opts.subject}" a ${to.join(', ')}: ${error}`);
      }
    }
    await this.prisma.mailLog
      .create({ data: { requestId: opts.requestId, to: to.join(', '), subject: opts.subject, event: opts.event, status, error } })
      .catch((e) => this.logger.error(e));
  }
}

@Global()
@Module({ providers: [MailService], exports: [MailService] })
export class MailModule {}
