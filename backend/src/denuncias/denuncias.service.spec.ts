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
      category: { findUnique: jest.fn().mockResolvedValue(null) },
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
      category: { findUnique: jest.fn().mockResolvedValue(null) },
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
      category: { findUnique: jest.fn().mockResolvedValue(null) },
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

  it('routes all Convivencia reports to Policía Municipal', async () => {
    const reportCreate = createReportMock();
    const findFirst = jest.fn().mockResolvedValue({ id: 'police-user' });
    const service = new DenunciasService({
      user: {
        findUnique: jest.fn().mockResolvedValue({
          isAnonymous: true,
          role: 'CIUDADANO',
        }),
        findFirst,
      },
      category: {
        findUnique: jest.fn().mockResolvedValue({ name: 'Convivencia' }),
      },
      report: { create: reportCreate },
    } as unknown as PrismaService);

    await service.create('anonymous-id', {
      title: 'Ruidos molestos',
      description: 'Hay ruidos molestos en la calle.',
      type: 'URBANO',
      latitude: -32.37,
      longitude: -54.17,
      categoryId: 'convivencia',
    });

    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ entityName: 'Policía Municipal' }),
      }),
    );
    expect(reportCreate.mock.calls[0]?.[0].data).toMatchObject({
      type: 'URBANO',
      entityName: 'Policía Municipal',
    });
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

  it.each([
    ['Intendencia', 'Municipalidad Demo', 'URBANO'],
    ['Policía Municipal', 'policia demo', 'POLICIAL'],
  ])(
    'includes %s in the shared %s report queue',
    async (entityName, sharedEntityName, type) => {
      const findMany = jest.fn().mockResolvedValue([]);
      const service = new DenunciasService({
        user: { findUnique: jest.fn().mockResolvedValue({ entityName }) },
        report: { findMany },
      } as unknown as PrismaService);

      await service.managementQueue(
        { sub: 'staff-id', role: 'FUNCIONARIO' },
        undefined,
      );

      expect(findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              { entityName: sharedEntityName, type },
            ]),
          }),
        }),
      );
    },
  );

  it('includes existing Convivencia reports in Policía Municipal queues', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const service = new DenunciasService({
      user: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ entityName: 'Policía Municipal' }),
      },
      report: { findMany },
    } as unknown as PrismaService);

    await service.managementQueue(
      { sub: 'police-user', role: 'FUNCIONARIO' },
      undefined,
    );

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            {
              entityName: 'Municipalidad Demo',
              type: 'URBANO',
              category: { is: { name: 'Convivencia' } },
            },
          ]),
        }),
      }),
    );
  });

  it('includes Policía Municipal Convivencia reports in Municipalidad Demo queues', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const service = new DenunciasService({
      user: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ entityName: 'Municipalidad Demo' }),
      },
      report: { findMany },
    } as unknown as PrismaService);

    await service.managementQueue(
      { sub: 'municipal-user', role: 'FUNCIONARIO' },
      undefined,
    );

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            {
              entityName: 'Policía Municipal',
              type: 'URBANO',
              category: { is: { name: 'Convivencia' } },
            },
          ]),
        }),
      }),
    );
  });

  it('allows Policía Municipal to open existing Convivencia reports', async () => {
    const report = {
      id: reportId,
      reporterId: 'citizen-id',
      entityName: 'Municipalidad Demo',
      type: 'URBANO',
      title: 'Ruidos molestos',
      category: { name: 'Convivencia' },
    };
    const service = new DenunciasService({
      user: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ entityName: 'Policía Municipal' }),
      },
      report: { findUnique: jest.fn().mockResolvedValue(report) },
    } as unknown as PrismaService);

    await expect(
      service.findOne(reportId, { sub: 'police-user', role: 'FUNCIONARIO' }),
    ).resolves.toMatchObject({ id: reportId });
  });

  it('allows Municipalidad Demo to open Convivencia reports routed to Policía Municipal', async () => {
    const report = {
      id: reportId,
      reporterId: 'citizen-id',
      entityName: 'Policía Municipal',
      type: 'URBANO',
      title: 'Ruidos molestos',
      category: { name: 'Convivencia' },
    };
    const service = new DenunciasService({
      user: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ entityName: 'Municipalidad Demo' }),
      },
      report: { findUnique: jest.fn().mockResolvedValue(report) },
    } as unknown as PrismaService);

    await expect(
      service.findOne(reportId, { sub: 'municipal-user', role: 'FUNCIONARIO' }),
    ).resolves.toMatchObject({ id: reportId });
  });

  it('allows an Intendencia user to open an urban report routed to Municipalidad Demo', async () => {
    const report = {
      id: reportId,
      reporterId: 'citizen-id',
      entityName: 'Municipalidad Demo',
      type: 'URBANO',
      title: 'Luminaria apagada',
      category: { name: 'Infraestructura' },
      priority: 'MEDIA',
    };
    const service = new DenunciasService({
      user: {
        findUnique: jest.fn().mockResolvedValue({ entityName: 'Intendencia' }),
      },
      report: { findUnique: jest.fn().mockResolvedValue(report) },
    } as unknown as PrismaService);

    await expect(
      service.findOne(reportId, { sub: 'staff-id', role: 'FUNCIONARIO' }),
    ).resolves.toMatchObject({ id: reportId });
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
          title: 'Incendio',
          type: 'BOMBEROS',
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
