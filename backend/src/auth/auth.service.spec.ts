import * as argon2 from 'argon2';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { IpAbuseProtectionService } from '../common/services/ip-abuse-protection.service';
import { AuthService } from './auth.service';

jest.mock('argon2', () => ({
  hash: jest.fn(),
  verify: jest.fn(),
}));

describe('AuthService anonymous sessions', () => {
  type AnonymousAccountCountArgs = {
    where: {
      isAnonymous: boolean;
      anonymousIpHash: string;
      createdAt: { gte: Date };
    };
  };
  type AnonymousAccountCreateArgs = {
    data: {
      email: string;
      passwordHash: null;
      firstName: string;
      isAnonymous: boolean;
      anonymousIpHash: string;
      role: 'CIUDADANO';
    };
  };
  const ipHash = 'hashed-client-ip';
  const userCreate = jest.fn<
    Promise<Record<string, unknown>>,
    [AnonymousAccountCreateArgs]
  >();
  const userCount = jest.fn<Promise<number>, [AnonymousAccountCountArgs]>();
  const userFindFirst = jest.fn<
    Promise<{ createdAt: Date } | null>,
    [Record<string, unknown>]
  >();
  const acquireIpLock = jest.fn().mockResolvedValue(undefined);
  const service = new AuthService(
    {
      $transaction: (callback: (transaction: unknown) => Promise<unknown>) =>
        callback({
          $queryRaw: jest.fn(),
          user: {
            count: userCount,
            create: userCreate,
            findFirst: userFindFirst,
          },
        }),
    } as unknown as PrismaService,
    {
      sign: jest.fn().mockReturnValue('signed-token'),
    } as unknown as JwtService,
    {
      hashIpAddress: jest.fn().mockReturnValue(ipHash),
      acquireIpLock,
    } as unknown as IpAbuseProtectionService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates an anonymous account with an IP hash under the per-IP limit', async () => {
    userCount.mockResolvedValue(2);
    userCreate.mockResolvedValue({
      id: 'anonymous-id',
      email: 'anon-anonymous-id@anonymous.local',
      role: 'CIUDADANO',
      isAnonymous: true,
      status: 'ACTIVO',
      firstName: 'Visitante',
      lastName: null,
      entityName: null,
      phone: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await expect(service.anonymousLogin('203.0.113.1')).resolves.toMatchObject({
      user: { id: 'anonymous-id', isAnonymous: true },
      accessToken: 'signed-token',
    });
    expect(acquireIpLock).toHaveBeenCalledWith(
      expect.anything(),
      'anonymous-account',
      ipHash,
    );
    expect(userCount.mock.calls[0]?.[0]).toMatchObject({
      where: { isAnonymous: true, anonymousIpHash: ipHash },
    });
    expect(userCreate.mock.calls[0]?.[0]).toMatchObject({
      data: {
        isAnonymous: true,
        anonymousIpHash: ipHash,
        passwordHash: null,
      },
    });
  });

  it('does not allow anonymous accounts without a password hash to log in', async () => {
    const loginService = new AuthService(
      {
        user: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'anonymous-id',
            email: 'anon@example.invalid',
            role: 'CIUDADANO',
            isAnonymous: true,
            status: 'ACTIVO',
            passwordHash: null,
          }),
        },
      } as unknown as PrismaService,
      {} as unknown as JwtService,
      {} as unknown as IpAbuseProtectionService,
    );

    await expect(
      loginService.login({
        email: 'anon@example.invalid',
        password: 'anything',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects a fourth account for the IP within the 20-day window', async () => {
    userCount.mockResolvedValue(3);
    userFindFirst.mockResolvedValue({
      createdAt: new Date(
        Date.now() - 19 * 24 * 60 * 60 * 1000 - 23 * 60 * 60 * 1000,
      ),
    });

    await expect(service.anonymousLogin('203.0.113.1')).rejects.toMatchObject({
      status: 429,
      response: {
        message: expect.stringContaining(
          'Podrás volver a intentarlo en 1 hora.',
        ),
      },
    });
    expect(userFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { createdAt: 'asc' },
        select: { createdAt: true },
      }),
    );
    expect(userCreate).not.toHaveBeenCalled();
  });

  it('deletes only expired anonymous accounts without reports', async () => {
    const userFindMany = jest
      .fn<Promise<{ id: string }[]>, [Record<string, unknown>]>()
      .mockResolvedValueOnce([{ id: 'expired-unused-account' }])
      .mockResolvedValueOnce([]);
    const userDeleteMany = jest
      .fn<Promise<{ count: number }>, [Record<string, unknown>]>()
      .mockResolvedValue({ count: 1 });
    const userUpdateMany = jest
      .fn<Promise<{ count: number }>, [Record<string, unknown>]>()
      .mockResolvedValue({ count: 2 });
    const reportUpdateMany = jest
      .fn<Promise<{ count: number }>, [Record<string, unknown>]>()
      .mockResolvedValue({ count: 3 });
    const cleanupService = new AuthService(
      {
        user: {
          findMany: userFindMany,
          deleteMany: userDeleteMany,
          updateMany: userUpdateMany,
        },
        report: { updateMany: reportUpdateMany },
      } as unknown as PrismaService,
      {} as JwtService,
      {} as IpAbuseProtectionService,
    );

    await expect(
      cleanupService.cleanupExpiredAnonymousAccounts(),
    ).resolves.toEqual({
      deletedAccounts: 1,
      clearedAccountHashes: 2,
      clearedReportHashes: 3,
    });
    expect(userFindMany.mock.calls[0]?.[0]).toMatchObject({
      where: {
        isAnonymous: true,
        reports: { none: {} },
      },
    });
    expect(userDeleteMany.mock.calls[0]?.[0]).toMatchObject({
      where: { reports: { none: {} } },
    });
    expect(reportUpdateMany.mock.calls[0]?.[0]).toMatchObject({
      where: { reporterIpHash: { not: null } },
      data: { reporterIpHash: null },
    });
  });

  describe('AuthService login', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it.each([
      'FUNCIONARIO',
      'FUNCIONARIO_ADMINISTRADOR',
      'SUPERADMINISTRADOR',
    ] as const)(
      'returns the generic invalid-credentials error for %s on the citizen portal',
      async (role) => {
        const verifyPassword = jest
          .spyOn(argon2, 'verify')
          .mockResolvedValue(true);
        const loginService = new AuthService(
          {
            user: {
              findUnique: jest.fn().mockResolvedValue({
                id: 'staff-id',
                email: 'staff@example.com',
                role,
                status: 'ACTIVO',
                passwordHash: 'stored-hash',
              }),
            },
          } as unknown as PrismaService,
          {} as JwtService,
          {} as IpAbuseProtectionService,
        );

        await expect(
          loginService.login({
            email: 'staff@example.com',
            password: 'valid-password',
            portal: 'ciudadano',
          }),
        ).rejects.toThrow('Credenciales inválidas');
        expect(verifyPassword).toHaveBeenCalledWith(
          'stored-hash',
          'valid-password',
        );
      },
    );

    it('keeps superadministrator credentials out of the employee portal', async () => {
      jest.spyOn(argon2, 'verify').mockResolvedValue(true);
      const loginService = new AuthService(
        {
          user: {
            findUnique: jest.fn().mockResolvedValue({
              id: 'admin-id',
              email: 'admin@example.com',
              role: 'SUPERADMINISTRADOR',
              status: 'ACTIVO',
              passwordHash: 'stored-hash',
              isAnonymous: false,
              firstName: 'Admin',
              lastName: null,
              entityName: null,
              phone: null,
              createdAt: new Date(),
              updatedAt: new Date(),
            }),
          },
        } as unknown as PrismaService,
        { sign: jest.fn().mockReturnValue('signed-token') } as unknown as JwtService,
        {} as IpAbuseProtectionService,
      );

      await expect(
        loginService.login({
          email: 'admin@example.com',
          password: 'valid-password',
          portal: 'gestion',
        }),
      ).rejects.toThrow('Credenciales inválidas');
      await expect(
        loginService.login({
          email: 'admin@example.com',
          password: 'valid-password',
          portal: 'superadmin',
        }),
      ).resolves.toMatchObject({
        user: { role: 'SUPERADMINISTRADOR' },
        accessToken: 'signed-token',
      });
    });
  });
});
