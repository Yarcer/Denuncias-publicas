import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ReportStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
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
  constructor(private readonly prisma: PrismaService) { }

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
    return this.prisma.report.create({
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
  }

  async uploadEvidence(id: string, user: AuthenticatedUser, file?: UploadedImage) {
    const report = await this.prisma.report.findUnique({ where: { id } });
    this.assertCanAccess(report, user);

    if (!file?.buffer || !['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
      throw new BadRequestException('Adjuntá una imagen JPG, PNG o WebP');
    }
    if (file.size > 5 * 1024 * 1024) {
      throw new BadRequestException('La imagen no puede superar los 5 MB');
    }

    const extension =
      file.mimetype === 'image/jpeg' ? 'jpg' :
        file.mimetype === 'image/png' ? 'png' : 'webp';
    const filename = `${randomUUID()}.${extension}`;
    const directory = join(process.cwd(), 'uploads', 'reports');
    const filepath = join(directory, filename);

    await mkdir(directory, { recursive: true });
    await writeFile(filepath, file.buffer);

    try {
      return await this.prisma.evidence.create({
        data: { reportId: id, url: filename, type: file.mimetype },
      });
    } catch (error) {
      await unlink(filepath);
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

    const filepath = join(
      process.cwd(),
      'uploads',
      'reports',
      evidence.url,
    );

    try {
      return {
        buffer: await readFile(filepath),
        type: evidence.type,
      };
    } catch {
      throw new NotFoundException('Archivo de imagen no encontrado');
    }
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
