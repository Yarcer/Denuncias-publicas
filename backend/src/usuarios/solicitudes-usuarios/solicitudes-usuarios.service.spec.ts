import { AdministrativeRequestStatus, Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { SolicitudesUsuariosService } from './solicitudes-usuarios.service';

describe('SolicitudesUsuariosService', () => {
  type RequestUpdateInput = {
    where: { id: string; status: AdministrativeRequestStatus };
    data: {
      status: AdministrativeRequestStatus;
      reviewedById: string;
      reviewComment: string | null;
      reviewedAt: Date;
      passwordHash: string | null;
    };
  };

  const request = {
    id: 'request-id',
    email: 'staff@example.com',
    passwordHash: 'stored-hash',
    firstName: 'Funcionario',
    lastName: 'Demo',
    entityName: 'Municipalidad Demo',
    jurisdiction: 'Melo',
    status: AdministrativeRequestStatus.PENDIENTE,
  };

  it('creates an active funcionario in the requested entity when approved', async () => {
    const createUser = jest.fn().mockResolvedValue({});
    const updateRequest = jest
      .fn<Promise<{ count: number }>, [RequestUpdateInput]>()
      .mockResolvedValue({ count: 1 });
    const findReviewedRequest = jest.fn().mockResolvedValue({
      id: request.id,
      email: request.email,
      status: AdministrativeRequestStatus.APROBADA,
    });
    const transaction = {
      user: {
        create: createUser,
        findFirst: jest.fn().mockResolvedValue(null),
      },
      administrativeUserRequest: {
        findUnique: jest.fn().mockResolvedValue(request),
        updateMany: updateRequest,
        findUniqueOrThrow: findReviewedRequest,
      },
    };
    const prisma = {
      $transaction: jest.fn(
        (callback: (tx: typeof transaction) => Promise<unknown>) =>
          callback(transaction),
      ),
    } as unknown as PrismaService;
    const service = new SolicitudesUsuariosService(prisma);

    await service.revisarSolicitud('admin-id', request.id, {
      status: AdministrativeRequestStatus.APROBADA,
    });

    expect(createUser).toHaveBeenCalledWith({
      data: {
        email: request.email,
        passwordHash: request.passwordHash,
        firstName: request.firstName,
        lastName: request.lastName,
        role: Role.FUNCIONARIO,
        status: 'ACTIVO',
        entityName: request.entityName,
        jurisdiction: request.jurisdiction,
      },
    });
    expect(updateRequest.mock.calls[0]?.[0].data.status).toBe(
      AdministrativeRequestStatus.APROBADA,
    );
    expect(updateRequest.mock.calls[0]?.[0].data.reviewedById).toBe('admin-id');
    expect(updateRequest.mock.calls[0]?.[0].data.passwordHash).toBeNull();
  });

  it('does not create an account when a request is rejected', async () => {
    const createUser = jest.fn();
    const updateRequest = jest
      .fn<Promise<{ count: number }>, [RequestUpdateInput]>()
      .mockResolvedValue({ count: 1 });
    const transaction = {
      user: {
        create: createUser,
        findFirst: jest.fn().mockResolvedValue(null),
      },
      administrativeUserRequest: {
        findUnique: jest.fn().mockResolvedValue(request),
        updateMany: updateRequest,
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          ...request,
          status: AdministrativeRequestStatus.RECHAZADA,
        }),
      },
    };
    const prisma = {
      $transaction: jest.fn(
        (callback: (tx: typeof transaction) => Promise<unknown>) =>
          callback(transaction),
      ),
    } as unknown as PrismaService;
    const service = new SolicitudesUsuariosService(prisma);

    await service.revisarSolicitud('admin-id', request.id, {
      status: AdministrativeRequestStatus.RECHAZADA,
    });

    expect(createUser).not.toHaveBeenCalled();
    expect(updateRequest.mock.calls[0]?.[0].data.status).toBe(
      AdministrativeRequestStatus.RECHAZADA,
    );
    expect(updateRequest.mock.calls[0]?.[0].data.passwordHash).toBeNull();
  });
});
