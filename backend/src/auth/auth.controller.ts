import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Throttle } from '@nestjs/throttler';
import { randomBytes } from 'node:crypto';
import type { CookieOptions, Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { LoginUserDto, RegisterUserDto } from './dto/register-user.dto';

type AuthenticatedRequest = Request & {
  user?: {
    sub?: string;
    email?: string;
    role?: string;
  };
};

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Post('register')
  async register(
    @Body() dto: RegisterUserDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.createSession(await this.authService.register(dto), response);
  }

  @Post('login')
  async login(
    @Body() dto: LoginUserDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.createSession(await this.authService.login(dto), response);
  }

  @Post('anonymous')
  @Throttle({ default: { limit: 3, ttl: 60 * 60 * 1000 } })
  async anonymousLogin(@Res({ passthrough: true }) response: Response) {
    return this.createSession(
      await this.authService.anonymousLogin(),
      response,
    );
  }

  @Get('me')
  @UseGuards(AuthGuard('jwt'))
  async me(
    @Req() req: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    if (!req.user || !req.user.sub) {
      throw new UnauthorizedException();
    }

    const existingCsrfToken = this.readCookie(req, 'csrf_token');
    const csrfToken =
      existingCsrfToken && /^[a-f0-9]{64}$/.test(existingCsrfToken)
        ? existingCsrfToken
        : this.setCsrfCookie(response);
    return {
      user: await this.authService.me(String(req.user.sub)),
      csrfToken,
    };
  }

  @Post('logout')
  @UseGuards(AuthGuard('jwt'))
  logout(@Res({ passthrough: true }) response: Response) {
    response.clearCookie('access_token', this.cookieOptions(true));
    response.clearCookie('csrf_token', this.cookieOptions(false));
    return { loggedOut: true };
  }

  private createSession(
    result: { user: object; accessToken: string },
    response: Response,
  ) {
    response.cookie(
      'access_token',
      result.accessToken,
      this.cookieOptions(true),
    );
    const csrfToken = this.setCsrfCookie(response);
    return { user: result.user, csrfToken };
  }

  private setCsrfCookie(response: Response) {
    const csrfToken = randomBytes(32).toString('hex');
    response.cookie('csrf_token', csrfToken, this.cookieOptions(false));
    return csrfToken;
  }

  private readCookie(request: Request, name: string) {
    const prefix = `${name}=`;
    const cookie = request.headers.cookie
      ?.split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith(prefix));
    return cookie?.slice(prefix.length);
  }

  private cookieOptions(httpOnly: boolean): CookieOptions {
    const isProduction =
      this.configService.get<string>('nodeEnv') === 'production';
    return {
      httpOnly,
      secure: isProduction,
      sameSite: isProduction ? 'none' : 'lax',
      path: '/api',
    };
  }
}
