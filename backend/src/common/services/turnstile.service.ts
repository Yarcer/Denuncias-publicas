import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type TurnstileAction = 'register' | 'anonymous_login' | 'create_report';
const testSecretKey = '1x0000000000000000000000000000000AA';

type TurnstileVerification = {
  success: boolean;
  action?: string;
  hostname?: string;
};

@Injectable()
export class TurnstileService {
  constructor(private readonly configService: ConfigService) {}

  async verify(
    token: string | undefined,
    expectedAction: TurnstileAction,
    remoteIp?: string,
  ) {
    if (!token?.trim()) {
      throw new BadRequestException('Completá la verificación de seguridad.');
    }

    const secret = this.configService.get<string>('turnstile.secretKey');
    if (!secret) {
      throw new ServiceUnavailableException(
        'La verificación de seguridad no está configurada.',
      );
    }

    const body = new URLSearchParams({
      secret,
      response: token.trim(),
    });
    if (remoteIp) body.set('remoteip', remoteIp);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    let response: Response;
    try {
      response = await fetch(
        'https://challenges.cloudflare.com/turnstile/v0/siteverify',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body,
          signal: controller.signal,
        },
      );
    } catch {
      throw new ServiceUnavailableException(
        'No se pudo verificar la seguridad con Cloudflare. Intentá nuevamente.',
      );
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      throw new ServiceUnavailableException(
        'Cloudflare no está disponible para verificar la solicitud.',
      );
    }

    let result: TurnstileVerification;
    try {
      result = (await response.json()) as TurnstileVerification;
    } catch {
      throw new ServiceUnavailableException(
        'Cloudflare devolvió una respuesta de verificación inválida.',
      );
    }

    if (!result || typeof result.success !== 'boolean') {
      throw new ServiceUnavailableException(
        'Cloudflare devolvió una respuesta de verificación inválida.',
      );
    }

    if (!result.success) {
      throw new BadRequestException(
        'La verificación de seguridad venció o no es válida. Intentá nuevamente.',
      );
    }

    const isLocalTestKey =
      secret === testSecretKey &&
      this.configService.get<string>('nodeEnv') !== 'production';
    if (!isLocalTestKey && result.action !== expectedAction) {
      throw new BadRequestException(
        'La verificación de seguridad no corresponde a esta operación.',
      );
    }

    if (this.configService.get<string>('nodeEnv') === 'production') {
      const configuredOrigin =
        this.configService.get<string>('cors.origin') ?? '';
      let expectedHostname: string;
      try {
        expectedHostname = new URL(configuredOrigin).hostname;
      } catch {
        throw new ServiceUnavailableException(
          'El dominio de verificación de seguridad no está configurado correctamente.',
        );
      }

      if (result.hostname?.toLowerCase() !== expectedHostname.toLowerCase()) {
        throw new BadRequestException(
          'La verificación de seguridad se realizó desde un dominio no permitido.',
        );
      }
    }
  }
}
