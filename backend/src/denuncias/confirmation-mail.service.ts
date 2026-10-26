import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, type Transporter } from 'nodemailer';

export type ConfirmationEmailStatus =
  'sent' | 'failed' | 'not_configured' | 'skipped';

export function formatReportIdentifier(id: string) {
  const compactId = BigInt(`0x${id.replaceAll('-', '')}`)
    .toString(36)
    .toUpperCase()
    .padStart(25, '0');

  return `PR-${compactId}`;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return entities[character];
  });
}

@Injectable()
export class ConfirmationMailService {
  private readonly logger = new Logger(ConfirmationMailService.name);
  private readonly transporter: Transporter | null;
  private readonly from: string | undefined;

  constructor(configService: ConfigService) {
    const host = configService.get<string>('email.smtpHost');
    const port = configService.get<number>('email.smtpPort');
    const user = configService.get<string>('email.smtpUser');
    const password = configService.get<string>('email.smtpPassword');
    this.from = configService.get<string>('email.from');

    this.transporter =
      host && port && this.from
        ? createTransport({
            host,
            port,
            secure: port === 465,
            requireTLS: port !== 465,
            ...(user && password ? { auth: { user, pass: password } } : {}),
            connectionTimeout: 10_000,
            greetingTimeout: 10_000,
            socketTimeout: 15_000,
          })
        : null;
  }

  async sendReportConfirmation({
    email,
    reportId,
    title,
  }: {
    email: string;
    reportId: string;
    title: string;
  }): Promise<ConfirmationEmailStatus> {
    if (email.endsWith('@anonymous.local')) {
      return 'skipped';
    }
    if (!this.transporter || !this.from) {
      return 'not_configured';
    }

    const identifier = formatReportIdentifier(reportId);
    const safeTitle = escapeHtml(title);

    try {
      await this.transporter.sendMail({
        from: this.from,
        to: email,
        subject: `Denuncia registrada: ${identifier}`,
        text: [
          'Tu denuncia se registró correctamente.',
          `Identificador: ${identifier}`,
          `Asunto: ${title}`,
          'Guarda este identificador para consultar el estado de tu denuncia.',
        ].join('\n'),
        html: [
          '<p>Tu denuncia se registró correctamente.</p>',
          `<p><strong>Identificador:</strong> ${identifier}</p>`,
          `<p><strong>Asunto:</strong> ${safeTitle}</p>`,
          '<p>Guarda este identificador para consultar el estado de tu denuncia.</p>',
        ].join(''),
      });
      return 'sent';
    } catch (error) {
      this.logger.error(
        `No se pudo enviar la confirmación para la denuncia ${identifier}`,
        error instanceof Error ? error.stack : undefined,
      );
      return 'failed';
    }
  }
}
