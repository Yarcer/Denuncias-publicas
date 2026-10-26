import { ForbiddenException } from '@nestjs/common';
import { ReportStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EvidenceStorageService } from './evidence-storage.service';
import { DenunciasService } from './denuncias.service';

describe('DenunciasService indicators', () => {
  function createService() {
    const prisma = {
      report: {
        count: jest
          .fn()
          .mockResolvedValueOnce(20)
          .mockResolvedValueOnce(4)
          .mockResolvedValueOnce(7),
        groupBy: jest
          .fn()
          .mockResolvedValueOnce([
            { categoryId: 'roads', _count: { _all: 12 } },
            { categoryId: 'waste', _count: { _all: 8 } },
          ])
          .mockResolvedValueOnce([
            { status: ReportStatus.PENDIENTE, _count: { _all: 4 } },
            { status: ReportStatus.RESUELTO, _count: { _all: 7 } },
          ])
          .mockResolvedValueOnce([
            { assigneeId: 'staff-1', _count: { _all: 5 } },
          ])
          .mockResolvedValueOnce([
            { categoryId: 'roads', _count: { _all: 3 } },
            { categoryId: 'waste', _count: { _all: 2 } },
          ]),
      },
      category: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'roads',
            name: 'Infraestructura',
            responsibleEntity: 'Municipio',
          },
          { id: 'waste', name: 'Limpieza', responsibleEntity: null },
        ]),
      },
      user: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ id: 'staff-1', entityName: 'Municipio' }]),
      },
      $queryRaw: jest
        .fn()
        .mockResolvedValue([
          { month: new Date('2026-10-01T00:00:00.000Z'), count: 6 },
        ]),
    } as unknown as PrismaService;

    return new DenunciasService(prisma, {} as EvidenceStorageService);
  }

  it('returns overall totals, distributions and a complete 12-month timeline', async () => {
    const service = createService();

    const result = await service.indicators({
      sub: 'admin-id',
      role: 'ADMINISTRADOR',
    });

    expect(result.totals).toEqual({ received: 20, pending: 4, resolved: 7 });
    expect(result.categories).toEqual([
      { id: 'roads', name: 'Infraestructura', count: 12 },
      { id: 'waste', name: 'Limpieza', count: 8 },
    ]);
    expect(result.organizations).toEqual([
      { name: 'Municipio', count: 8 },
      { name: 'Sin organismo asignado', count: 2 },
    ]);
    expect(result.statuses).toEqual(
      expect.arrayContaining([
        { status: 'PENDIENTE', label: 'Pendiente', count: 4 },
        { status: 'RESUELTO', label: 'Resuelto', count: 7 },
      ]),
    );
    expect(result.temporalEvolution).toHaveLength(12);
    expect(result.temporalEvolution.at(-1)).toEqual({
      month: expect.stringMatching(/^\d{4}-\d{2}$/),
      count: 6,
    });
  });

  it('does not allow public organisms to access global indicators', async () => {
    const service = createService();

    await expect(
      service.indicators({ sub: 'staff-id', role: 'ENTE_PUBLICO' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
