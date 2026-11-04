import { ForbiddenException } from '@nestjs/common';
import { ReportStatus } from '@prisma/client';
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
  type ManagementQueueQuery = {
    where: {
      OR: Record<string, unknown>[];
      archivedAt?: { not: null; gte: Date };
    };
  };
  type StatusUpdateInput = {
    where: { id: string };
    data: {
      status: ReportStatus;
      resolvedAt: Date | null;
      archivedAt: Date | null;
    };
    include: Record<string, unknown>;
  };
  const createManagementQueueMock = () =>
    jest.fn<Promise<unknown[]>, [ManagementQueueQuery]>().mockResolvedValue([]);
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
    const findFirst = jest
      .fn<Promise<{ id: string }>, [{ where: { entityName: string } }]>()
      .mockResolvedValue({ id: 'police-user' });
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

    expect(findFirst.mock.calls[0]?.[0]).toMatchObject({
      where: { entityName: 'Policía Municipal' },
    });
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
    expect(result.items[0]).toMatchObject({ priority: 'URGENTE' });
  });

  it('only returns archived reports from the last 90 days', async () => {
    const findMany = createManagementQueueMock();
    const service = new DenunciasService({
      user: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ entityName: 'Municipalidad Demo' }),
      },
      report: { findMany },
    } as unknown as PrismaService);
    const requestStartedAt = Date.now();

    await service.managementQueue(
      { sub: 'staff-id', role: 'FUNCIONARIO' },
      'archived',
    );

    const archivedAt = findMany.mock.calls[0]?.[0].where.archivedAt;
    expect(archivedAt?.not).toBeNull();
    expect(archivedAt?.gte.getTime()).toBeGreaterThanOrEqual(
      requestStartedAt - 90 * 24 * 60 * 60 * 1000,
    );
    expect(archivedAt?.gte.getTime()).toBeLessThanOrEqual(
      Date.now() - 90 * 24 * 60 * 60 * 1000,
    );
  });

  it.each([ReportStatus.RESUELTO, ReportStatus.RECHAZADO])(
    'automatically archives reports when their status changes to %s',
    async (status) => {
      const report = {
        id: reportId,
        reporterId: 'citizen-id',
        entityName: 'Municipalidad Demo',
        type: 'URBANO',
        title: 'Luminaria apagada',
        status: ReportStatus.EN_PROCESO,
        archivedAt: null,
        assigneeId: 'staff-id',
        category: { name: 'Infraestructura' },
      };
      const transaction = {
        report: {
          update: jest
            .fn<Promise<Record<string, unknown>>, [StatusUpdateInput]>()
            .mockImplementation(({ data }) =>
              Promise.resolve({ ...report, ...data }),
            ),
        },
        reportHistory: { create: jest.fn().mockResolvedValue({}) },
      };
      const service = new DenunciasService({
        user: {
          findUnique: jest
            .fn()
            .mockResolvedValue({ entityName: 'Municipalidad Demo' }),
        },
        report: { findUnique: jest.fn().mockResolvedValue(report) },
        $transaction: jest.fn(
          (callback: (tx: typeof transaction) => Promise<unknown>) =>
            callback(transaction),
        ),
      } as unknown as PrismaService);

      await service.changeStatus(
        reportId,
        { sub: 'staff-id', role: 'FUNCIONARIO' },
        { status },
      );

      expect(
        transaction.report.update.mock.calls[0]?.[0].data.archivedAt,
      ).toBeInstanceOf(Date);
      expect(transaction.reportHistory.create).toHaveBeenCalled();
    },
  );

  it('removes the archive date when a resolved report is reopened', async () => {
    const report = {
      id: reportId,
      reporterId: 'citizen-id',
      entityName: 'Municipalidad Demo',
      type: 'URBANO',
      title: 'Luminaria apagada',
      status: ReportStatus.RESUELTO,
      archivedAt: new Date('2026-10-01T10:00:00.000Z'),
      assigneeId: 'staff-id',
      category: { name: 'Infraestructura' },
    };
    const transaction = {
      report: {
        update: jest
          .fn<Promise<Record<string, unknown>>, [StatusUpdateInput]>()
          .mockImplementation(({ data }) =>
            Promise.resolve({ ...report, ...data }),
          ),
      },
      reportHistory: { create: jest.fn().mockResolvedValue({}) },
    };
    const service = new DenunciasService({
      user: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ entityName: 'Municipalidad Demo' }),
      },
      report: { findUnique: jest.fn().mockResolvedValue(report) },
      $transaction: jest.fn(
        (callback: (tx: typeof transaction) => Promise<unknown>) =>
          callback(transaction),
      ),
    } as unknown as PrismaService);

    await service.changeStatus(
      reportId,
      { sub: 'staff-id', role: 'FUNCIONARIO' },
      { status: ReportStatus.EN_PROCESO },
    );

    expect(
      transaction.report.update.mock.calls[0]?.[0].data.archivedAt,
    ).toBeNull();
  });

  it('returns status history with responsible users, scoped to the current organization', async () => {
    const history = [
      {
        id: 'history-id',
        fromStatus: 'PENDIENTE',
        toStatus: 'ASIGNADO',
        changedBy: 'staff-id',
        createdAt: new Date('2026-11-01T10:00:00.000Z'),
        report: { id: reportId, title: 'Luminaria apagada' },
      },
    ];
    const findHistory = jest.fn().mockResolvedValue(history);
    const findUsers = jest.fn().mockResolvedValue([
      {
        id: 'staff-id',
        firstName: 'Ana',
        lastName: 'Pérez',
        email: 'ana@example.com',
        entityName: 'Municipalidad Demo',
      },
    ]);
    const service = new DenunciasService({
      user: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ entityName: 'Municipalidad Demo' }),
        findMany: findUsers,
      },
      reportHistory: { findMany: findHistory },
    } as unknown as PrismaService);

    const result = await service.managementHistory({
      sub: 'staff-id',
      role: 'FUNCIONARIO',
    });

    expect(findHistory).toHaveBeenCalledWith({
      where: {
        report: {
          is: {
            OR: [
              { entityName: 'Municipalidad Demo' },
              { entityName: null },
              { entityName: 'Intendencia', type: 'URBANO' },
              {
                entityName: 'Policía Municipal',
                type: 'URBANO',
                category: { is: { name: 'Convivencia' } },
              },
            ],
          },
        },
      },
      select: {
        id: true,
        fromStatus: true,
        toStatus: true,
        changedBy: true,
        createdAt: true,
        report: { select: { id: true, title: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    expect(findUsers).toHaveBeenCalledWith({
      where: { id: { in: ['staff-id'] } },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        entityName: true,
      },
    });
    expect(result).toMatchObject({
      count: 1,
      items: [
        {
          id: 'history-id',
          report: { id: reportId, title: 'Luminaria apagada' },
          responsible: { id: 'staff-id', email: 'ana@example.com' },
        },
      ],
    });
    expect(result.items[0]).not.toHaveProperty('changedBy');
  });

  it('does not expose management history to citizens', async () => {
    const findHistory = jest.fn();
    const service = new DenunciasService({
      reportHistory: { findMany: findHistory },
    } as unknown as PrismaService);

    await expect(
      service.managementHistory({ sub: 'citizen-id', role: 'CIUDADANO' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(findHistory).not.toHaveBeenCalled();
  });

  it.each([
    ['Intendencia', 'Municipalidad Demo', 'URBANO'],
    ['Policía Municipal', 'policia demo', 'POLICIAL'],
  ])(
    'includes %s in the shared %s report queue',
    async (entityName, sharedEntityName, type) => {
      const findMany = createManagementQueueMock();
      const service = new DenunciasService({
        user: { findUnique: jest.fn().mockResolvedValue({ entityName }) },
        report: { findMany },
      } as unknown as PrismaService);

      await service.managementQueue(
        { sub: 'staff-id', role: 'FUNCIONARIO' },
        undefined,
      );

      expect(findMany.mock.calls[0]?.[0].where.OR).toContainEqual({
        entityName: sharedEntityName,
        type,
      });
    },
  );

  it('includes existing Convivencia reports in Policía Municipal queues', async () => {
    const findMany = createManagementQueueMock();
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

    expect(findMany.mock.calls[0]?.[0].where.OR).toContainEqual({
      entityName: 'Municipalidad Demo',
      type: 'URBANO',
      category: { is: { name: 'Convivencia' } },
    });
  });

  it('includes Policía Municipal Convivencia reports in Municipalidad Demo queues', async () => {
    const findMany = createManagementQueueMock();
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

    expect(findMany.mock.calls[0]?.[0].where.OR).toContainEqual({
      entityName: 'Policía Municipal',
      type: 'URBANO',
      category: { is: { name: 'Convivencia' } },
    });
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
