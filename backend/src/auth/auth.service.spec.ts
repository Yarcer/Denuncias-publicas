import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';
import type { LoginUserDto } from './dto/register-user.dto';
import * as argon2 from 'argon2';

const allowedPortalCases: Array<
  [role: string, portal: NonNullable<LoginUserDto['portal']>]
> = [
  ['CIUDADANO', 'ciudadano'],
  ['ENTE_PUBLICO', 'funcionario'],
  ['ADMINISTRADOR', 'administrador'],
  ['ENTE_PUBLICO', 'gestion'],
  ['ADMINISTRADOR', 'gestion'],
];

const mismatchedPortalCases: Array<
  [
    role: string,
    portal: Exclude<NonNullable<LoginUserDto['portal']>, 'gestion'>,
  ]
> = [
  ['CIUDADANO', 'funcionario'],
  ['CIUDADANO', 'administrador'],
  ['ENTE_PUBLICO', 'ciudadano'],
  ['ENTE_PUBLICO', 'administrador'],
  ['ADMINISTRADOR', 'ciudadano'],
  ['ADMINISTRADOR', 'funcionario'],
];

describe('AuthService portal access', () => {
  const password = 'secret-password';
  let authService: AuthService;
  let findUnique: jest.Mock;

  beforeEach(async () => {
    findUnique = jest.fn();
    const prisma = { user: { findUnique } } as unknown as PrismaService;
    const jwtService = {
      sign: jest.fn().mockResolvedValue('access-token'),
    } as unknown as JwtService;
    authService = new AuthService(prisma, jwtService);
  });

  async function setUserRole(role: string) {
    findUnique.mockResolvedValue({
      id: 'user-id',
      email: 'user@example.com',
      passwordHash: await argon2.hash(password),
      firstName: null,
      lastName: null,
      phone: null,
      role,
      status: 'ACTIVO',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  it.each(allowedPortalCases)(
    'allows role %s into portal %s',
    async (role, portal) => {
      await setUserRole(role);

      await expect(
        authService.login({
          email: 'user@example.com',
          password,
          portal,
        }),
      ).resolves.toMatchObject({ accessToken: 'access-token' });
    },
  );

  it.each(mismatchedPortalCases)(
    'rejects role %s from portal %s',
    async (role, portal) => {
      await setUserRole(role);

      await expect(
        authService.login({
          email: 'user@example.com',
          password,
          portal,
        }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    },
  );
});
