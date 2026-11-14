import { BadRequestException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UsuariosService } from './usuarios.service';

describe('UsuariosService', () => {
  const actor = { sub: 'superadmin-id', role: Role.SUPERADMINISTRADOR };

  it('creates another superadministrator with a hashed password and no organization', async () => {
    const create = jest.fn().mockResolvedValue({
      role: Role.SUPERADMINISTRADOR,
      status: 'ACTIVO',
      entityName: null,
    });
    const service = new UsuariosService({
      user: { create },
    } as unknown as PrismaService);

    await expect(
      service.createAdministrativeUser(actor, {
        email: '  OTRO-ADMIN@example.com ',
        password: 'password-segura',
        role: Role.SUPERADMINISTRADOR,
      }),
    ).resolves.toMatchObject({ role: Role.SUPERADMINISTRADOR });

    const createInput = create.mock.calls[0]?.[0];
    expect(createInput).toMatchObject({
      data: {
        email: 'otro-admin@example.com',
        role: Role.SUPERADMINISTRADOR,
        entityName: null,
        status: 'ACTIVO',
      },
      select: expect.not.objectContaining({ email: true, firstName: true }),
    });
    expect(createInput.data.passwordHash).toMatch(/^\$argon2/);
    expect(createInput.data.passwordHash).not.toBe('password-segura');
  });

  it('returns only grouped, non-identifying account details', async () => {
    const groupBy = jest.fn().mockResolvedValue([
      {
        role: Role.FUNCIONARIO,
        status: 'ACTIVO',
        entityName: 'OSE',
        _count: { _all: 2 },
      },
    ]);
    const service = new UsuariosService({
      user: { groupBy },
    } as unknown as PrismaService);

    await expect(service.findAdministrativeUsers(actor)).resolves.toEqual({
      items: [
        {
          role: Role.FUNCIONARIO,
          status: 'ACTIVO',
          entityName: 'OSE',
          count: 2,
        },
      ],
      count: 2,
    });
    expect(groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        by: ['role', 'status', 'entityName'],
        where: {
          role: {
            in: [Role.FUNCIONARIO, Role.FUNCIONARIO_ADMINISTRADOR],
          },
          isAnonymous: false,
        },
      }),
    );
  });

  it('rejects organizations outside the available options when creating staff accounts', async () => {
    const create = jest.fn();
    const service = new UsuariosService({
      user: { create },
    } as unknown as PrismaService);

    await expect(
      service.createAdministrativeUser(actor, {
        email: 'funcionario@example.com',
        password: 'password-segura',
        role: Role.FUNCIONARIO,
        entityName: 'Municipalidad Demo',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(create).not.toHaveBeenCalled();
  });
});
