import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';

jest.mock('argon2', () => ({
  hash: jest.fn(),
  verify: jest.fn(),
}));

describe('AuthService login portals', () => {
  const findUser = jest.fn();
  const prisma = {
    user: { findUnique: findUser },
  } as unknown as PrismaService;
  const verifyPassword = jest.mocked(argon2.verify);
  const signToken = jest.fn().mockReturnValue('access-token');
  const jwt = {
    sign: signToken,
  } as unknown as JwtService;
  const service = new AuthService(prisma, jwt);

  const account = {
    id: 'user-id',
    email: 'admin@example.com',
    passwordHash: 'password-hash',
    role: 'SUPERADMINISTRADOR',
    isAnonymous: false,
    status: 'ACTIVO',
    firstName: 'Admin',
    lastName: 'Principal',
    entityName: null,
    phone: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    findUser.mockResolvedValue(account);
    verifyPassword.mockResolvedValue(true);
  });

  afterEach(() => {
    findUser.mockReset();
    verifyPassword.mockReset();
    signToken.mockClear();
  });

  it('allows a superadministrator through the isolated portal', async () => {
    await expect(
      service.login({
        email: account.email,
        password: 'password',
        portal: 'superadmin',
      }),
    ).resolves.toMatchObject({
      user: { id: account.id, role: 'SUPERADMINISTRADOR' },
      accessToken: 'access-token',
    });
  });

  it('rejects a superadministrator from the employee portal', async () => {
    await expect(
      service.login({
        email: account.email,
        password: 'password',
        portal: 'gestion',
      }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('requires a superadministrator to select the isolated portal', async () => {
    await expect(
      service.login({ email: account.email, password: 'password' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects employees from the superadministrator portal', async () => {
    findUser.mockResolvedValue({ ...account, role: 'FUNCIONARIO' });

    await expect(
      service.login({
        email: account.email,
        password: 'password',
        portal: 'superadmin',
      }),
    ).rejects.toThrow(UnauthorizedException);
  });
});
