import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Prisma, ReportStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EvidenceStorageService } from './evidence-storage.service';
import { getImageMimeType } from './image-validation';
import { CreateReportDto, UpdateReportDto } from './dto/report.dto';
import { AssignReportDto, ManageReportDto } from './dto/manage-report.dto';

type UploadedImage = {
  buffer: Buffer;
  mimetype: string;
  size: number;
};
type AuthenticatedUser = { sub: string; role: string };
const managementRoles = ['ENTE_PUBLICO', 'ADMINISTRADOR'];
const terminalStatuses: ReportStatus[] = [ReportStatus.RESUELTO, ReportStatus.RECHAZADO, ReportStatus.CERRADO];

@Injectable()
export class DenunciasService {
  private readonly logger = new Logger(DenunciasService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly evidenceStorage: EvidenceStorageService,
  ) {}

  async findAll(user: AuthenticatedUser, status?: string) {
    const where = {
      ...(user.role === 'CIUDADANO' ? { reporterId: user.sub } : {}),
      ...(status ? { status: status as never } : {}),
    };
    const items = await this.prisma.report.findMany({
      where,
      include: { category: true },
      orderBy: { createdAt: 'desc' },
    });

    return { items, count: items.length, filters: { status: status ?? 'all' } };
  }

  async findOne(id: string, user: AuthenticatedUser) {
    const report = await this.prisma.report.findUnique({
      where: { id },
      include: {
        category: true,
        evidence: true,
        comments: {
          where: user.role === 'CIUDADANO' ? { isInternal: false } : {},
        },
        history: true,
      },
    });
    this.assertCanAccess(report, user);
    return report;
  }

  async managementQueue(user: AuthenticatedUser, status?: string) {
    this.assertManagementRole(user);

    const where =
      status === 'archived'
        ? { archivedAt: { not: null } }
        : status
          ? { status: status as ReportStatus, archivedAt: null }
          : {
            status: { notIn: terminalStatuses },
            archivedAt: null,
          };

    const items = await this.prisma.report.findMany({
      where,
      include: {
        category: true,
        evidence: true,
        reporter: {
          select: { email: true, firstName: true, lastName: true },
        },
        assignee: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return {
      items,
      count: items.length,
      filters: { status: status ?? 'active' },
    };
  }

  async assignableUsers(user: AuthenticatedUser) {
    this.assertManagementRole(user);
    const actor = user.role === 'ENTE_PUBLICO'
      ? await this.prisma.user.findUnique({
          where: { id: user.sub },
          select: { entityName: true },
        })
      : null;
    if (user.role === 'ENTE_PUBLICO' && (!actor || !actor.entityName)) {
      throw new BadRequestException('Tu cuenta no tiene un ente público configurado');
    }
    const where = {
      role: 'ENTE_PUBLICO' as const,
      status: 'ACTIVO' as const,
      ...(actor ? { entityName: actor.entityName } : {}),
    };
    const items = await this.prisma.user.findMany({
      where,
      select: { id: true, email: true, firstName: true, lastName: true, entityName: true },
      orderBy: [{ entityName: 'asc' }, { firstName: 'asc' }],
    });

    return { items, count: items.length };
  }

  async create(reporterId: string, dto: CreateReportDto) {
    const createdAfter = new Date(Date.now() - 24 * 60 * 60 * 1000);

    return this.prisma.$transaction(
      async (transaction) => {
        const recentReportCount = await transaction.report.count({
          where: { reporterId, createdAt: { gte: createdAfter } },
        });
        if (recentReportCount >= 10) {
          throw new HttpException(
            'Alcanzaste el máximo de 10 reportes en 24 horas.',
            HttpStatus.TOO_MANY_REQUESTS,
          );
        }

        return transaction.report.create({
          data: {
            title: dto.title,
            description: dto.description,
            type: dto.type,
            priority: dto.priority,
            latitude: dto.latitude,
            longitude: dto.longitude,
            address: dto.address,
            reference: dto.reference,
            reporter: { connect: { id: reporterId } },
            category: { connect: { id: dto.categoryId } },
          },
          include: { category: true },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async uploadEvidence(
    id: string,
    user: AuthenticatedUser,
    file?: UploadedImage,
  ) {
    const report = await this.prisma.report.findUnique({ where: { id } });
    this.assertCanAccess(report, user);

    if (!file?.buffer) {
      throw new BadRequestException('Adjuntá una imagen JPG, PNG o WebP');
    }
    const detectedMimeType = getImageMimeType(file.buffer);
    if (!detectedMimeType || detectedMimeType !== file.mimetype) {
      throw new BadRequestException('Adjuntá una imagen JPG, PNG o WebP');
    }
    if (file.size > 5 * 1024 * 1024) {
      throw new BadRequestException('La imagen no puede superar los 5 MB');
    }

    const extension =
      detectedMimeType === 'image/jpeg'
        ? 'jpg'
        : detectedMimeType === 'image/png'
          ? 'png'
          : 'webp';
    const filename = `${randomUUID()}.${extension}`;
    await this.evidenceStorage.put(filename, file.buffer, detectedMimeType);

    try {
      return await this.prisma.evidence.create({
        data: { reportId: id, url: filename, type: detectedMimeType },
      });
    } catch (error) {
      try {
        await this.evidenceStorage.delete(filename);
      } catch (cleanupError) {
        this.logger.error(
          `No se pudo limpiar la evidencia ${filename} después de fallar el registro`,
          cleanupError instanceof Error ? cleanupError.stack : undefined,
        );
      }
      throw error;
    }
  }

  async getEvidence(
    reportId: string,
    evidenceId: string,
    user: AuthenticatedUser,
  ) {
    const report = await this.prisma.report.findUnique({
      where: { id: reportId },
    });

    this.assertCanAccess(report, user);

    const evidence = await this.prisma.evidence.findFirst({
      where: { id: evidenceId, reportId },
    });

    if (!evidence) {
      throw new NotFoundException('Imagen no encontrada');
    }

    const buffer = await this.evidenceStorage.get(evidence.url);
    if (!buffer) {
      throw new NotFoundException('Archivo de imagen no encontrado');
    }

    return { buffer, type: evidence.type };
  }

  async archive(id: string, user: AuthenticatedUser) {
    this.assertManagementRole(user);

    const report = await this.prisma.report.findUnique({
      where: { id },
    });

    if (!report) {
      throw new NotFoundException('Denuncia no encontrada');
    }

    if (report.status !== ReportStatus.RECHAZADO) {
      throw new BadRequestException('Solo se pueden archivar denuncias denegadas');
    }

    if (report.archivedAt) {
      throw new BadRequestException('Esta denuncia ya está archivada');
    }

    return this.prisma.report.update({
      where: { id },
      data: { archivedAt: new Date() },
    });
  }

  async take(id: string, user: AuthenticatedUser) {
    this.assertManagementRole(user);
    const report = await this.prisma.report.findUnique({ where: { id } });
    if (!report) throw new NotFoundException('Denuncia no encontrada');
    if (user.role === 'ENTE_PUBLICO' && report.assigneeId && report.assigneeId !== user.sub) {
      throw new ForbiddenException('Esta denuncia ya fue tomada por otro ente');
    }
    if (terminalStatuses.includes(report.status)) {
      throw new ForbiddenException('Esta denuncia ya está cerrada');
    }

    return this.prisma.$transaction(async (transaction) => {
      const updated = await transaction.report.update({
        where: { id },
        data: { assigneeId: user.sub, status: ReportStatus.ASIGNADO },
        include: {
          category: true,
          reporter: { select: { id: true, email: true, firstName: true, lastName: true } },
          assignee: { select: { id: true, email: true, firstName: true, lastName: true } },
        },
      });
      await transaction.reportHistory.create({
        data: { reportId: id, fromStatus: report.status, toStatus: ReportStatus.ASIGNADO, changedBy: user.sub },
      });
      return updated;
    });
  }

  async assign(id: string, user: AuthenticatedUser, dto: AssignReportDto) {
    this.assertManagementRole(user);
    const report = await this.prisma.report.findUnique({ where: { id } });
    if (!report) throw new NotFoundException('Denuncia no encontrada');
    if (terminalStatuses.includes(report.status)) {
      throw new ForbiddenException('Esta denuncia ya está cerrada');
    }

    const actor = user.role === 'ENTE_PUBLICO'
      ? await this.prisma.user.findUnique({
          where: { id: user.sub },
          select: { entityName: true },
        })
      : null;
    if (user.role === 'ENTE_PUBLICO' && (!actor || !actor.entityName)) {
      throw new BadRequestException('Tu cuenta no tiene un ente público configurado');
    }
    const assignee = await this.prisma.user.findFirst({
      where: {
        id: dto.assigneeId,
        role: 'ENTE_PUBLICO',
        status: 'ACTIVO',
        ...(actor ? { entityName: actor.entityName } : {}),
      },
      select: { id: true, email: true, firstName: true, lastName: true },
    });
    if (!assignee) {
      throw new BadRequestException('El funcionario no pertenece a tu ente o no está activo');
    }
    const nextStatus = report.status === ReportStatus.PENDIENTE
      ? ReportStatus.ASIGNADO
      : report.status;

    return this.prisma.$transaction(async (transaction) => {
      const updated = await transaction.report.update({
        where: { id },
        data: { assigneeId: assignee.id, status: nextStatus },
        include: {
          category: true,
          assignee: {
            select: { id: true, email: true, firstName: true, lastName: true },
          },
        },
      });
      await transaction.reportHistory.create({
        data: {
          reportId: id,
          fromStatus: report.status,
          toStatus: nextStatus,
          changedBy: user.sub,
          comment: `Asignada internamente a ${assignee.firstName || assignee.email}`,
        },
      });
      return updated;
    });
  }

  async changeStatus(id: string, user: AuthenticatedUser, dto: ManageReportDto) {
    this.assertManagementRole(user);
    const report = await this.prisma.report.findUnique({ where: { id } });
    if (!report) throw new NotFoundException('Denuncia no encontrada');
    if (user.role === 'ENTE_PUBLICO' && report.assigneeId !== user.sub) {
      throw new ForbiddenException('Primero debes tomar esta denuncia');
    }
    if (terminalStatuses.includes(report.status)) {
      throw new ForbiddenException('Esta denuncia ya está cerrada');
    }

    return this.prisma.$transaction(async (transaction) => {
      const updated = await transaction.report.update({
        where: { id },
        data: { status: dto.status, resolvedAt: dto.status === ReportStatus.RESUELTO ? new Date() : null },
        include: {
          category: true,
          reporter: { select: { id: true, email: true, firstName: true, lastName: true } },
          assignee: { select: { id: true, email: true, firstName: true, lastName: true } },
        },
      });
      await transaction.reportHistory.create({
        data: { reportId: id, fromStatus: report.status, toStatus: dto.status, changedBy: user.sub },
      });
      return updated;
    });
  }

  async update(id: string, user: AuthenticatedUser, dto: UpdateReportDto) {
    const report = await this.prisma.report.findUnique({ where: { id } });
    this.assertCanAccess(report, user);

    if (dto.status || dto.assigneeId) {
      throw new ForbiddenException('Usa el flujo de gestión para cambiar estado o asignación');
    }

    return this.prisma.report.update({ where: { id }, data: dto });
  }

  async remove(id: string, user: AuthenticatedUser) {
    const report = await this.prisma.report.findUnique({ where: { id } });
    this.assertCanAccess(report, user);
    await this.prisma.report.delete({ where: { id } });
    return { id, deleted: true };
  }

  private assertCanAccess(report: { reporterId: string } | null, user: AuthenticatedUser) {
    if (!report) {
      throw new NotFoundException('Denuncia no encontrada');
    }
    if (user.role === 'CIUDADANO' && report.reporterId !== user.sub) {
      throw new ForbiddenException('No tienes acceso a esta denuncia');
    }
  }

  private assertManagementRole(user: AuthenticatedUser) {
    if (!managementRoles.includes(user.role)) {
      throw new ForbiddenException('No tienes permisos para gestionar denuncias');
    }
  }
}
