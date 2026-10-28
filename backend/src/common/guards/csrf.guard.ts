import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { timingSafeEqual } from 'node:crypto';

const csrfExemptPaths = ['/auth/login', '/auth/register', '/auth/anonymous'];
const safeMethods = ['GET', 'HEAD', 'OPTIONS'];

@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request>();
    if (safeMethods.includes(request.method)) {
      return true;
    }

    const origin = request.get('origin');
    const allowedOrigin = this.configService.get<string>('cors.origin');
    const hasBearerToken = request.get('authorization')?.startsWith('Bearer ');
    const hasCookieSession = Boolean(this.readCookie(request, 'access_token'));
    const path = request.path.split('?')[0];
    const isCsrfExemptPath = csrfExemptPaths.some((csrfExemptPath) =>
      path.endsWith(csrfExemptPath),
    );

    if (origin !== allowedOrigin) {
      if (
        origin ||
        hasCookieSession ||
        (!hasBearerToken && !isCsrfExemptPath)
      ) {
        throw new ForbiddenException('Origen de solicitud no permitido');
      }
      return true;
    }

    if (isCsrfExemptPath) {
      return true;
    }

    const cookieToken = this.readCookie(request, 'csrf_token');
    const headerToken = request.get('x-csrf-token');
    if (!cookieToken || !headerToken) {
      throw new ForbiddenException('Token CSRF inválido');
    }

    const cookieBuffer = Buffer.from(cookieToken);
    const headerBuffer = Buffer.from(headerToken);
    if (
      cookieBuffer.length !== headerBuffer.length ||
      !timingSafeEqual(cookieBuffer, headerBuffer)
    ) {
      throw new ForbiddenException('Token CSRF inválido');
    }

    return true;
  }

  private readCookie(request: Request, name: string) {
    const prefix = `${name}=`;
    const cookie = request.headers.cookie
      ?.split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith(prefix));
    return cookie?.slice(prefix.length);
  }
}
