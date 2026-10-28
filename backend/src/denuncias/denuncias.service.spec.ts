import { ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DenunciasService } from './denuncias.service';

describe('DenunciasService', () => {
  const reportId = '123e4567-e89b-12d3-a456-426614174000';
  type ReportCreateInput = {
    data: {
      entityName: string | null;
      priority: string;
      title: string;
      description: string;
      [key: string]: unknown;
    };
    include: { category: true };
  };
  const createReportMock = () =>
    jest
      .fn<Promise<Record<string, unknown>>, [ReportCreateInput]>()
      .mockImplementation(({ data }) =>
        Promise.resolve({ id: reportId, ...data }),
      );

  it.each([
    ['URBANO', 'Municipalidad Demo'],
    ['BOMBEROS', 'bombero demo'],
    ['POLICIAL', 'policia demo'],
  ] as const)('routes %s reports to %s', async (type, entityName) => {
    const reportCreate = createReportMock();
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          isAnonymous: false,
          role: 'CIUDADANO',
        }),
        findFirst: jest.fn().mockResolvedValue({ id: 'organization-user' }),
      },
      report: { create: reportCreate },
    };
    const service = new DenunciasService(prisma as unknown as PrismaService);

    await service.create('reporter-id', {
      title: 'Luminaria apagada',
      description: 'La calle está oscura.',
      type,
      latitude: -32.37,
      longitude: -54.17,
      categoryId: 'category-id',
    });

    const createInput = reportCreate.mock.calls[0]?.[0];
    expect(createInput?.data.entityName).toBe(entityName);
    expect(createInput?.data.priority).toBe('MEDIA');
  });

  it('assigns low priority to anonymous reports', async () => {
    const reportCreate = createReportMock();
    const service = new DenunciasService({
      user: {
        findUnique: jest.fn().mockResolvedValue({
          isAnonymous: true,
          role: 'CIUDADANO',
        }),
        findFirst: jest.fn().mockResolvedValue({ id: 'organization-user' }),
      },
      report: { create: reportCreate },
    } as unknown as PrismaService);

    await service.create('anonymous-id', {
      title: 'Incendio activo',
      description: 'Hay una persona herida.',
      type: 'BOMBEROS',
      latitude: -32.37,
      longitude: -54.17,
      categoryId: 'category-id',
    });

    const createInput = reportCreate.mock.calls[0]?.[0];
    expect(createInput?.data.priority).toBe('BAJA');
  });

  it('leaves reports unrouted when no active user configures the destination organization', async () => {
    const reportCreate = createReportMock();
    const service = new DenunciasService({
      user: {
        findUnique: jest.fn().mockResolvedValue({
          isAnonymous: false,
          role: 'CIUDADANO',
        }),
        findFirst: jest.fn().mockResolvedValue(null),
      },
      report: { create: reportCreate },
    } as unknown as PrismaService);

    await service.create('reporter-id', {
      title: 'Incendio',
      description: 'Un foco apagado.',
      type: 'BOMBEROS',
      latitude: -32.37,
      longitude: -54.17,
      categoryId: 'category-id',
    });

    expect(reportCreate.mock.calls[0]?.[0].data.entityName).toBeNull();
  });

  it('scopes management report lists to their organization and unassigned reports', async () => {
    const findMany = jest
      .fn()
      .mockResolvedValue([{ id: reportId, priority: 'URGENTE' }]);
    const service = new DenunciasService({
      user: {
        findUnique: jest.fn().mockResolvedValue({ entityName: 'bombero demo' }),
      },
      report: { findMany },
    } as unknown as PrismaService);

    const result = await service.findAll({
      sub: 'staff-id',
      role: 'FUNCIONARIO',
    });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [{ entityName: 'bombero demo' }, { entityName: null }],
        },
      }),
    );
    expect(result.items[0]?.priority).toBe('URGENTE');
  });

  it('does not expose reports routed to another organization by identifier', async () => {
    const service = new DenunciasService({
      user: {
        findUnique: jest.fn().mockResolvedValue({ entityName: 'bombero demo' }),
      },
      report: {
        findUnique: jest.fn().mockResolvedValue({
          id: reportId,
          reporterId: 'citizen-id',
          entityName: 'policia demo',
          priority: 'MEDIA',
        }),
      },
    } as unknown as PrismaService);

    await expect(
      service.findOne(reportId, { sub: 'staff-id', role: 'FUNCIONARIO' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('only serves statistics to superadministrators', async () => {
    const reportCount = jest.fn();
    const service = new DenunciasService({
      report: { count: reportCount },
    } as unknown as PrismaService);

    await expect(
      service.statistics({ sub: 'staff-id', role: 'FUNCIONARIO' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(reportCount).not.toHaveBeenCalled();
  });

  it('returns filtered statistics to superadministrators', async () => {
    const report = {
      count: jest.fn().mockResolvedValue(1),
      groupBy: jest
        .fn()
        .mockResolvedValueOnce([{ status: 'PENDIENTE', _count: { _all: 1 } }])
        .mockResolvedValueOnce([{ type: 'URBANO', _count: { _all: 1 } }])
        .mockResolvedValueOnce([{ priority: 'MEDIA', _count: { _all: 1 } }]),
    };
    const queryRaw = jest
      .fn()
      .mockResolvedValue([{ month: '2026-10', count: 1 }]);
    const service = new DenunciasService({
      report,
      $queryRaw: queryRaw,
    } as unknown as PrismaService);

    const result = await service.statistics(
      { sub: 'admin-id', role: 'SUPERADMINISTRADOR' },
      '2026-10-01',
      '2026-10-31',
    );

    expect(result).toMatchObject({
      total: 1,
      byMonth: [{ month: '2026-10', count: 1 }],
      filters: { from: '2026-10-01', to: '2026-10-31' },
    });
    expect(report.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          createdAt: {
            gte: new Date('2026-10-01T00:00:00.000Z'),
            lt: new Date('2026-11-01T00:00:00.000Z'),
          },
        },
      }),
    );
  });
});
