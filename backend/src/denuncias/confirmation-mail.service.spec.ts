import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, type SendMailOptions } from 'nodemailer';
import {
  ConfirmationMailService,
  formatReportIdentifier,
} from './confirmation-mail.service';

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(),
}));

describe('ConfirmationMailService', () => {
  const reportId = '123e4567-e89b-12d3-a456-426614174000';
  const sendMail = jest.fn<Promise<unknown>, [SendMailOptions]>();

  function createService(settings: Record<string, unknown> = {}) {
    const values: Record<string, unknown> = {
      'email.smtpHost': 'smtp.example.com',
      'email.smtpPort': 587,
      'email.smtpUser': 'mailer',
      'email.smtpPassword': 'secret',
      'email.from': 'reports@example.com',
      ...settings,
    };
    const configService = {
      get: jest.fn((key: string) => values[key]),
    } as unknown as ConfigService;
    return new ConfirmationMailService(configService);
  }

  beforeEach(() => {
    jest.clearAllMocks();
    sendMail.mockResolvedValue({});
    (createTransport as jest.Mock).mockReturnValue({ sendMail });
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('sends a confirmation with the public identifier and escaped title', async () => {
    const service = createService();

    const status = await service.sendReportConfirmation({
      email: 'citizen@example.com',
      reportId,
      title: '<script>alert("x")</script>',
    });

    expect(status).toBe('sent');
    expect(createTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        host: 'smtp.example.com',
        port: 587,
        secure: false,
        requireTLS: true,
      }),
    );
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'citizen@example.com',
        subject: `Denuncia registrada: ${formatReportIdentifier(reportId)}`,
      }),
    );
    expect(sendMail.mock.calls[0]?.[0].html).toEqual(
      expect.stringContaining('&lt;script&gt;'),
    );
  });

  it('reports delivery failure without throwing after the report was saved', async () => {
    sendMail.mockRejectedValue(new Error('SMTP unavailable'));
    const service = createService();

    await expect(
      service.sendReportConfirmation({
        email: 'citizen@example.com',
        reportId,
        title: 'Bache',
      }),
    ).resolves.toBe('failed');
  });

  it('reports when SMTP is not configured', async () => {
    const service = createService({
      'email.smtpHost': undefined,
      'email.smtpPort': undefined,
      'email.from': undefined,
    });

    await expect(
      service.sendReportConfirmation({
        email: 'citizen@example.com',
        reportId,
        title: 'Bache',
      }),
    ).resolves.toBe('not_configured');
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('does not send mail to anonymous local accounts', async () => {
    const service = createService();

    await expect(
      service.sendReportConfirmation({
        email: 'anon-id@anonymous.local',
        reportId,
        title: 'Bache',
      }),
    ).resolves.toBe('skipped');
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('uses the same public identifier format as the frontend', () => {
    expect(formatReportIdentifier(reportId)).toMatch(/^PR-[A-Z0-9]{25}$/);
  });
});
