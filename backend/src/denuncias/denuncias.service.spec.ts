import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ReportPriority, ReportStatus, ReportType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EvidenceStorageService } from './evidence-storage.service';
import { DenunciasService } from './denuncias.service';
import { CreateReportDto } from './dto/report.dto';

describe('DenunciasService automatic assignment', () => {
  const dto: CreateReportDto = {
    title: 'Bache',
    description: 'Hay un bache en la calle',
    type: ReportType.URBANO,
    latitude: -32.37,
    longitude: -54.17,
    categoryId: 'infraestructura',
  };

  function createService({
    category = {
      id: 'infraestructura',
      type: ReportType.URBANO,
      defaultPriority: ReportPriority.MEDIA,
      responsibleEntity: 'Municipalidad Demo',
    },
    assignee = { id: 'funcionario-id' },
  }: {
    category?: {
      id: string;
      type: ReportType;
      defaultPriority: ReportPriority;
      responsibleEntity: string | null;
    } | null;
    assignee?: { id: string } | null;
  } = {}) {
    const transaction = {
      report: {
        count: jest.fn().mockResolvedValue(0),
        create: jest
          .fn()
          .mockImplementation(({ data }) =>
            Promise.resolve({ id: 'report-id', ...data }),
          ),
      },
      category: {
        findFirst: jest.fn().mockResolvedValue(category),
      },
      user: {
        findFirst: jest.fn().mockResolvedValue(assignee),
      },
      reportHistory: {
        create: jest.fn().mockResolvedValue({}),
      },
    };
    const prisma = {
      $transaction: jest.fn((callback: (tx: typeof transaction) => unknown) =>
        callback(transaction),
      ),
    } as unknown as PrismaService;
    const evidenceStorage = {} as EvidenceStorageService;

    return {
      service: new DenunciasService(prisma, evidenceStorage),
      transaction,
    };
  }

  it('assigns to an active employee of the category organism', async () => {
    const { service, transaction } = createService();

    const result = await service.create('reporter-id', dto);

    expect(transaction.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          role: 'ENTE_PUBLICO',
          status: 'ACTIVO',
          entityName: 'Municipalidad Demo',
        },
      }),
    );
    expect(transaction.report.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          assigneeId: 'funcionario-id',
          status: ReportStatus.ASIGNADO,
          priority: ReportPriority.MEDIA,
        }),
      }),
    );
    expect(transaction.reportHistory.create).toHaveBeenCalled();
    expect(result).toMatchObject({ assigneeId: 'funcionario-id' });
  });

  it('leaves the report pending when the category has no organism', async () => {
    const { service, transaction } = createService({
      category: {
        id: 'infraestructura',
        type: ReportType.URBANO,
        defaultPriority: ReportPriority.MEDIA,
        responsibleEntity: null,
      },
    });

    await service.create('reporter-id', dto);

    expect(transaction.user.findFirst).not.toHaveBeenCalled();
    expect(transaction.report.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          assigneeId: null,
          status: ReportStatus.PENDIENTE,
        }),
      }),
    );
    expect(transaction.reportHistory.create).not.toHaveBeenCalled();
  });

  it('leaves the report pending when the organism has no active employee', async () => {
    const { service, transaction } = createService({ assignee: null });

    await service.create('reporter-id', dto);

    expect(transaction.report.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          assigneeId: null,
          status: ReportStatus.PENDIENTE,
        }),
      }),
    );
  });

  it('rejects an inactive or unknown category', async () => {
    const { service, transaction } = createService({ category: null });

    await expect(service.create('reporter-id', dto)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(transaction.report.create).not.toHaveBeenCalled();
  });

  it('rejects a report type that does not match its category', async () => {
    const { service, transaction } = createService({
      category: {
        id: 'infraestructura',
        type: ReportType.BOMBEROS,
        defaultPriority: ReportPriority.URGENTE,
        responsibleEntity: 'Bomberos',
      },
    });

    await expect(service.create('reporter-id', dto)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(transaction.report.create).not.toHaveBeenCalled();
  });

  it('uses the configured category priority instead of a client priority', async () => {
    const { service, transaction } = createService({
      category: {
        id: 'infraestructura',
        type: ReportType.URBANO,
        defaultPriority: ReportPriority.ALTA,
        responsibleEntity: null,
      },
    });

    await service.create('reporter-id', dto);

    expect(transaction.report.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ priority: ReportPriority.ALTA }),
      }),
    );
  });
});
