import { BadRequestException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UsuariosService } from './usuarios.service';

describe('UsuariosService', () => {
  const actor = { sub: 'superadmin-id', role: Role.SUPERADMINISTRADOR };

  it('does not allow creating another superadministrator', async () => {
    const create = jest.fn();
    const service = new UsuariosService({
      user: { create },
    } as unknown as PrismaService);

    await expect(
      service.createAdministrativeUser(actor, {
        email: 'otro-admin@example.com',
        password: 'password-segura',
        role: Role.SUPERADMINISTRADOR,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(create).not.toHaveBeenCalled();
  });

  it('does not allow changing an employee to superadministrator', async () => {
    const update = jest.fn();
    const service = new UsuariosService({
      user: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'employee-id',
          role: Role.FUNCIONARIO,
          entityName: 'Policía Municipal',
        }),
        update,
      },
    } as unknown as PrismaService);

    await expect(
      service.updateAdministrativeUser(actor, 'employee-id', {
        role: Role.SUPERADMINISTRADOR,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(update).not.toHaveBeenCalled();
  });

  it('lists funcionario and funcionario administrador accounts only', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const service = new UsuariosService({
      user: { findMany },
    } as unknown as PrismaService);

    await service.findAdministrativeUsers(actor);

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          role: {
            in: [Role.FUNCIONARIO, Role.FUNCIONARIO_ADMINISTRADOR],
          },
          isAnonymous: false,
        },
      }),
    );
  });
});
