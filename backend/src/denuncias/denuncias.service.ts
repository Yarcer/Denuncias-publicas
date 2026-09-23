import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ReportStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReportDto, UpdateReportDto } from './dto/report.dto';
import { ManageReportDto } from './dto/manage-report.dto';

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
  constructor(private readonly prisma: PrismaService) {}

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
      include: { category: true, evidence: true, comments: true, history: true },
    });
    this.assertCanAccess(report, user);
    return report;
  }

  async managementQueue(user: AuthenticatedUser, status?: string) {
    this.assertManagementRole(user);
    const items = await this.prisma.report.findMany({
      where: status ? { status: status as ReportStatus } : { status: { notIn: terminalStatuses } },
      include: {
  category: true,
  evidence: true,
  reporter: {
    select: { email: true, firstName: true, lastName: true },
  },
  assignee: true,
},
      orderBy: { createdAt: 'asc' },
    });
    return { items, count: items.length, filters: { status: status ?? 'active' } };
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
        include: { category: true, reporter: true, assignee: true },
      });
      await transaction.reportHistory.create({
        data: { reportId: id, fromStatus: report.status, toStatus: ReportStatus.ASIGNADO, changedBy: user.sub },
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
        include: { category: true, reporter: true, assignee: true },
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
