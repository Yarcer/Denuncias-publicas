import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  Prisma,
  ReportPriority,
  ReportStatus,
  ReportType,
  Role,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReportDto, UpdateReportDto } from './dto/report.dto';
import { AssignReportDto, ManageReportDto } from './dto/manage-report.dto';
import { determineReportPriority } from './report-priority';
import { IpAbuseProtectionService } from '../common/services/ip-abuse-protection.service';

type UploadedImage = {
  buffer: Buffer;
  mimetype: string;
  size: number;
};
type AuthenticatedUser = { sub: string; role: string };
const managementRoles = ['FUNCIONARIO', 'FUNCIONARIO_ADMINISTRADOR'];
const terminalStatuses: ReportStatus[] = [
  ReportStatus.RESUELTO,
  ReportStatus.RECHAZADO,
  ReportStatus.CERRADO,
];
const archivedReportRetentionMs = 90 * 24 * 60 * 60 * 1000;
const reportCreationLimit = 5;
const reportCreationWindowMs = 60 * 60 * 1000;
const sharedReportOrganizations: {
  type: ReportType;
  names: readonly string[];
}[] = [
  { type: ReportType.URBANO, names: ['Municipalidad Demo', 'Intendencia'] },
  { type: ReportType.POLICIAL, names: ['policia demo', 'Policía Municipal'] },
];
const reportOrganizationOverrides = [
  {
    type: ReportType.URBANO,
    categoryName: 'Convivencia',
    organizationName: 'Policía Municipal',
    sharedOrganizationNames: ['Municipalidad Demo'],
  },
  {
    type: ReportType.URBANO,
    categoryName: 'Saneamiento',
    organizationName: 'OSE',
    sharedOrganizationNames: [],
  },
];

function normalizeOrganizationName(name: string) {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLocaleLowerCase('es-UY');
}

@Injectable()
export class DenunciasService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional()
    private readonly ipAbuseProtection?: IpAbuseProtectionService,
  ) {}

  private readonly organizations: Record<CreateReportDto['type'], string> = {
    URBANO: 'Municipalidad Demo',
    BOMBEROS: 'bombero demo',
    POLICIAL: 'policia demo',
  };

  async findAll(user: AuthenticatedUser, status?: string) {
    if (
      user.role === Role.SUPERADMINISTRADOR ||
      (user.role !== Role.CIUDADANO && !managementRoles.includes(user.role))
    ) {
      throw new ForbiddenException(
        'No tienes permisos para consultar denuncias',
      );
    }

    const actor = managementRoles.includes(user.role)
      ? await this.getManagementEntity(user)
      : null;
    const sharedOrganizationWhere = actor
      ? this.sharedOrganizationFilters(actor.entityName)
      : [];
    const where: Prisma.ReportWhereInput = {
      ...(user.role === 'CIUDADANO' ? { reporterId: user.sub } : {}),
      ...(actor
        ? {
            OR: [
              { entityName: actor.entityName },
              { entityName: null },
              ...sharedOrganizationWhere,
              ...this.reportOrganizationFilters(actor.entityName),
            ],
          }
        : {}),
      ...(status ? { status: status as never } : {}),
    };
    const items = await this.prisma.report.findMany({
      where,
      include: { category: true },
      orderBy: { createdAt: 'desc' },
    });

    const visibleItems =
      user.role === 'CIUDADANO'
        ? items.map((item) => this.withoutPriority(item))
        : items;

    return {
      items: visibleItems,
      count: items.length,
      filters: { status: status ?? 'all' },
    };
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
    await this.assertCanAccess(report, user);
    return user.role === 'CIUDADANO' && report
      ? this.withoutPriority(report)
      : report;
  }

  async managementQueue(user: AuthenticatedUser, status?: string) {
    this.assertManagementRole(user);

    const actor = await this.prisma.user.findUnique({
      where: { id: user.sub },
      select: { entityName: true },
    });
    if (!actor?.entityName) {
      throw new BadRequestException(
        'Tu cuenta no tiene un ente público configurado',
      );
    }

    const statusWhere: Prisma.ReportWhereInput =
      status === 'archived'
        ? {
            archivedAt: {
              not: null,
              gte: new Date(Date.now() - archivedReportRetentionMs),
            },
          }
        : status
          ? { status: status as ReportStatus, archivedAt: null }
          : {
              status: { notIn: terminalStatuses },
              archivedAt: null,
            };
    const where: Prisma.ReportWhereInput = {
      ...statusWhere,
      OR: [
        { entityName: actor.entityName },
        { entityName: null },
        ...this.sharedOrganizationFilters(actor.entityName),
        ...this.reportOrganizationFilters(actor.entityName),
      ],
    };

    const items = await this.prisma.report.findMany({
      where,
      include: {
        category: true,
        evidence: true,
        reporter: {
          select: {
            email: true,
            firstName: true,
            lastName: true,
            isAnonymous: true,
          },
        },
        assignee: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
    });

    return {
      items,
      count: items.length,
      filters: { status: status ?? 'active' },
    };
  }

  async managementHistory(user: AuthenticatedUser) {
    this.assertManagementRole(user);
    const actor = await this.getManagementEntity(user);
    const reportVisibilityFilters = [
      { entityName: actor.entityName },
      { entityName: null },
      ...this.sharedOrganizationFilters(actor.entityName),
      ...this.reportOrganizationFilters(actor.entityName),
    ];
    const items = await this.prisma.reportHistory.findMany({
      where: {
        report: {
          is: { OR: reportVisibilityFilters },
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

    const responsibleIds = [...new Set(items.map((item) => item.changedBy))];
    const responsibleUsers = responsibleIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: responsibleIds } },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            entityName: true,
          },
        })
      : [];
    const usersById = new Map(
      responsibleUsers.map((responsible) => [responsible.id, responsible]),
    );

    return {
      items: items.map(({ changedBy, ...item }) => ({
        ...item,
        responsible: usersById.get(changedBy) ?? null,
      })),
      count: items.length,
    };
  }

  async assignableUsers(user: AuthenticatedUser) {
    this.assertManagementRole(user);
    const actor = managementRoles.includes(user.role)
      ? await this.prisma.user.findUnique({
          where: { id: user.sub },
          select: { entityName: true },
        })
      : null;

    if (managementRoles.includes(user.role) && (!actor || !actor.entityName)) {
      throw new BadRequestException(
        'Tu cuenta no tiene un ente público configurado',
      );
    }

    const where = {
      role: 'FUNCIONARIO' as const,
      status: 'ACTIVO' as const,
      ...(actor ? { entityName: actor.entityName } : {}),
    };

    const items = await this.prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        entityName: true,
      },
      orderBy: [{ entityName: 'asc' }, { firstName: 'asc' }],
    });

    return { items, count: items.length };
  }

  async create(
    reporterId: string,
    dto: CreateReportDto,
    ipAddress: string | undefined,
  ) {
    const ipAbuseProtection = this.ipAbuseProtection;
    if (!ipAbuseProtection) {
      throw new ServiceUnavailableException(
        'La protección de reportes por IP no está configurada',
      );
    }

    const ipHash = ipAbuseProtection.hashIpAddress(ipAddress);

    return this.prisma.$transaction(async (transaction) => {
      await ipAbuseProtection.acquireIpLock(
        transaction,
        'report-creation',
        ipHash,
      );
      const recentReports = await transaction.report.count({
        where: {
          reporterIpHash: ipHash,
          createdAt: { gte: new Date(Date.now() - reportCreationWindowMs) },
        },
      });

      if (recentReports >= reportCreationLimit) {
        throw new HttpException(
          'Se alcanzó el límite de reportes para esta conexión. Inténtalo más tarde.',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      const reporter = await transaction.user.findUnique({
        where: { id: reporterId },
        select: { isAnonymous: true, role: true },
      });
      const category = await transaction.category.findUnique({
        where: { id: dto.categoryId },
        select: { name: true },
      });
      const organizationOverride = reportOrganizationOverrides.find(
        (route) =>
          route.type === dto.type &&
          normalizeOrganizationName(route.categoryName) ===
            normalizeOrganizationName(category?.name ?? ''),
      );
      const entityName =
        organizationOverride?.organizationName ?? this.organizations[dto.type];
      const configuredOrganization = await transaction.user.findFirst({
        where: {
          entityName,
          status: 'ACTIVO',
          role: {
            in: [Role.FUNCIONARIO, Role.FUNCIONARIO_ADMINISTRADOR],
          },
        },
        select: { id: true },
      });
      const priority = determineReportPriority(
        dto.title,
        dto.description,
        reporter?.isAnonymous ?? false,
      );

      const report = await transaction.report.create({
        data: {
          title: dto.title,
          description: dto.description,
          type: dto.type,
          priority,
          entityName: configuredOrganization ? entityName : null,
          latitude: dto.latitude,
          longitude: dto.longitude,
          address: dto.address,
          reference: dto.reference,
          reporterIpHash: ipHash,
          reporter: { connect: { id: reporterId } },
          category: { connect: { id: dto.categoryId } },
        },
        include: { category: true },
      });

      return reporter?.role === 'SUPERADMINISTRADOR'
        ? report
        : this.withoutPriority(report);
    });
  }

  async uploadEvidence(
    id: string,
    user: AuthenticatedUser,
    file?: UploadedImage,
  ) {
    const report = await this.prisma.report.findUnique({
      where: { id },
      include: { category: true },
    });
    await this.assertCanAccess(report, user);

    if (
      !file?.buffer ||
      !['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)
    ) {
      throw new BadRequestException('Adjuntá una imagen JPG, PNG o WebP');
    }
    if (file.size > 5 * 1024 * 1024) {
      throw new BadRequestException('La imagen no puede superar los 5 MB');
    }

    const extension =
      file.mimetype === 'image/jpeg'
        ? 'jpg'
        : file.mimetype === 'image/png'
          ? 'png'
          : 'webp';
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

    await this.assertCanAccess(report, user);

    const evidence = await this.prisma.evidence.findFirst({
      where: { id: evidenceId, reportId },
    });

    if (!evidence) {
      throw new NotFoundException('Imagen no encontrada');
    }

    const filepath = join(process.cwd(), 'uploads', 'reports', evidence.url);

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
      include: { category: true },
    });

    if (!report) {
      throw new NotFoundException('Denuncia no encontrada');
    }
    const actor = await this.getManagementEntity(user);
    this.assertReportOrganization(report, actor.entityName);

    if (report.status !== ReportStatus.RECHAZADO) {
      throw new BadRequestException(
        'Solo se pueden archivar denuncias denegadas',
      );
    }

    if (report.archivedAt) {
      throw new BadRequestException('Esta denuncia ya está archivada');
    }

    const archivedReport = await this.prisma.report.update({
      where: { id },
      data: { archivedAt: new Date() },
    });

    return archivedReport;
  }

  async take(id: string, user: AuthenticatedUser) {
    this.assertManagementRole(user);
    const report = await this.prisma.report.findUnique({
      where: { id },
      include: { category: true },
    });
    if (!report) throw new NotFoundException('Denuncia no encontrada');
    const actor = await this.getManagementEntity(user);
    this.assertReportOrganization(report, actor.entityName);
    if (
      managementRoles.includes(user.role) &&
      report.assigneeId &&
      report.assigneeId !== user.sub
    ) {
      throw new ForbiddenException('Esta denuncia ya fue tomada por otro ente');
    }
    if (terminalStatuses.includes(report.status)) {
      throw new ForbiddenException('Esta denuncia ya está cerrada');
    }

    return this.prisma.$transaction(async (transaction) => {
      const updated = await transaction.report.update({
        where: { id },
        data: {
          assigneeId: user.sub,
          entityName: this.isOrganizationOverride(report, actor.entityName)
            ? (this.getOrganizationOverride(report)?.organizationName ??
              report.entityName ??
              actor.entityName)
            : (report.entityName ?? actor.entityName),
          status: ReportStatus.ASIGNADO,
        },
        include: {
          category: true,
          reporter: {
            select: { id: true, email: true, firstName: true, lastName: true },
          },
          assignee: {
            select: { id: true, email: true, firstName: true, lastName: true },
          },
        },
      });
      if (report.status !== ReportStatus.ASIGNADO) {
        await transaction.reportHistory.create({
          data: {
            reportId: id,
            fromStatus: report.status,
            toStatus: ReportStatus.ASIGNADO,
            changedBy: user.sub,
          },
        });
      }
      return updated;
    });
  }

  async assign(id: string, user: AuthenticatedUser, dto: AssignReportDto) {
    this.assertManagementRole(user);
    const report = await this.prisma.report.findUnique({
      where: { id },
      include: { category: true },
    });
    if (!report) throw new NotFoundException('Denuncia no encontrada');
    const actor = await this.getManagementEntity(user);
    this.assertReportOrganization(report, actor.entityName);
    if (terminalStatuses.includes(report.status)) {
      throw new ForbiddenException('Esta denuncia ya está cerrada');
    }

    const assignee = await this.prisma.user.findFirst({
      where: {
        id: dto.assigneeId,
        role: 'FUNCIONARIO',
        status: 'ACTIVO',
        entityName: actor.entityName,
      },
      select: { id: true, email: true, firstName: true, lastName: true },
    });
    if (!assignee) {
      throw new BadRequestException(
        'El funcionario no pertenece a tu ente o no está activo',
      );
    }
    const nextStatus =
      report.status === ReportStatus.PENDIENTE
        ? ReportStatus.ASIGNADO
        : report.status;

    return this.prisma.$transaction(async (transaction) => {
      const updated = await transaction.report.update({
        where: { id },
        data: {
          assigneeId: assignee.id,
          entityName: this.isOrganizationOverride(report, actor.entityName)
            ? (this.getOrganizationOverride(report)?.organizationName ??
              report.entityName ??
              actor.entityName)
            : (report.entityName ?? actor.entityName),
          status: nextStatus,
        },
        include: {
          category: true,
          assignee: {
            select: { id: true, email: true, firstName: true, lastName: true },
          },
        },
      });
      if (report.status !== nextStatus) {
        await transaction.reportHistory.create({
          data: {
            reportId: id,
            fromStatus: report.status,
            toStatus: nextStatus,
            changedBy: user.sub,
            comment: `Asignada internamente a ${assignee.firstName || assignee.email}`,
          },
        });
      }
      return updated;
    });
  }

  async changeStatus(
    id: string,
    user: AuthenticatedUser,
    dto: ManageReportDto,
  ) {
    this.assertManagementRole(user);
    const report = await this.prisma.report.findUnique({
      where: { id },
      include: { category: true },
    });
    if (!report) throw new NotFoundException('Denuncia no encontrada');
    const actor = await this.getManagementEntity(user);
    this.assertReportOrganization(report, actor.entityName);
    if (managementRoles.includes(user.role) && report.assigneeId !== user.sub) {
      throw new ForbiddenException('Primero debes tomar esta denuncia');
    }
    const canReopenResolved =
      report.status === ReportStatus.RESUELTO &&
      (dto.status === ReportStatus.PENDIENTE ||
        dto.status === ReportStatus.EN_PROCESO);
    if (terminalStatuses.includes(report.status) && !canReopenResolved) {
      throw new ForbiddenException('Esta denuncia ya está cerrada');
    }

    return this.prisma.$transaction(async (transaction) => {
      const updated = await transaction.report.update({
        where: { id },
        data: {
          status: dto.status,
          resolvedAt: dto.status === ReportStatus.RESUELTO ? new Date() : null,
          archivedAt:
            dto.status === ReportStatus.RESUELTO ||
            dto.status === ReportStatus.RECHAZADO
              ? (report.archivedAt ?? new Date())
              : null,
        },
        include: {
          category: true,
          reporter: {
            select: { id: true, email: true, firstName: true, lastName: true },
          },
          assignee: {
            select: { id: true, email: true, firstName: true, lastName: true },
          },
        },
      });
      if (report.status !== dto.status) {
        await transaction.reportHistory.create({
          data: {
            reportId: id,
            fromStatus: report.status,
            toStatus: dto.status,
            changedBy: user.sub,
          },
        });
      }
      return updated;
    });
  }

  async statistics(user: AuthenticatedUser, from?: string, to?: string) {
    if (user.role !== 'SUPERADMINISTRADOR') {
      throw new ForbiddenException(
        'Solo el superadministrador puede consultar las estadísticas',
      );
    }

    const fromDate = from ? this.parseDate(from, 'from') : undefined;
    const toDate = to ? this.parseDate(to, 'to') : undefined;
    if (fromDate && toDate && fromDate > toDate) {
      throw new BadRequestException(
        'La fecha inicial no puede ser posterior a la fecha final',
      );
    }
    const toExclusive = toDate
      ? new Date(toDate.getTime() + 24 * 60 * 60 * 1000)
      : undefined;
    const where: Prisma.ReportWhereInput = {
      ...(fromDate || toExclusive
        ? {
            createdAt: {
              ...(fromDate ? { gte: fromDate } : {}),
              ...(toExclusive ? { lt: toExclusive } : {}),
            },
          }
        : {}),
    };
    const dateFilters = [
      ...(fromDate ? [Prisma.sql`"createdAt" >= ${fromDate}`] : []),
      ...(toExclusive ? [Prisma.sql`"createdAt" < ${toExclusive}`] : []),
    ];
    const monthlyWhere = dateFilters.length
      ? Prisma.sql`WHERE ${Prisma.join(dateFilters, ' AND ')}`
      : Prisma.empty;

    const [total, byStatus, byType, byPriority, monthly] = await Promise.all([
      this.prisma.report.count({ where }),
      this.prisma.report.groupBy({
        by: ['status'],
        where,
        _count: { _all: true },
      }),
      this.prisma.report.groupBy({
        by: ['type'],
        where,
        _count: { _all: true },
      }),
      this.prisma.report.groupBy({
        by: ['priority'],
        where,
        _count: { _all: true },
      }),
      this.prisma.$queryRaw<Array<{ month: string; count: number }>>(
        Prisma.sql`
        SELECT TO_CHAR(DATE_TRUNC('month', "createdAt"), 'YYYY-MM') AS month,
          COUNT(*)::int AS count
        FROM "Report"
        ${monthlyWhere}
        GROUP BY DATE_TRUNC('month', "createdAt")
        ORDER BY month
      `,
      ),
    ]);

    return {
      total,
      byStatus: byStatus.map(({ status, _count }) => ({
        status,
        count: _count._all,
      })),
      byType: byType.map(({ type, _count }) => ({
        type,
        count: _count._all,
      })),
      byPriority: byPriority.map(({ priority, _count }) => ({
        priority,
        count: _count._all,
      })),
      byMonth: monthly,
      filters: { from: from ?? null, to: to ?? null },
    };
  }

  async update(id: string, user: AuthenticatedUser, dto: UpdateReportDto) {
    const report = await this.prisma.report.findUnique({ where: { id } });
    await this.assertCanAccess(report, user);

    if (dto.status || dto.assigneeId) {
      throw new ForbiddenException(
        'Usa el flujo de gestión para cambiar estado o asignación',
      );
    }

    const updatedReport = await this.prisma.report.update({
      where: { id },
      data: dto,
    });

    return user.role === 'SUPERADMINISTRADOR'
      ? updatedReport
      : this.withoutPriority(updatedReport);
  }

  async remove(id: string, user: AuthenticatedUser) {
    const report = await this.prisma.report.findUnique({ where: { id } });
    await this.assertCanAccess(report, user);
    await this.prisma.report.delete({ where: { id } });
    return { id, deleted: true };
  }

  private async assertCanAccess(
    report: {
      reporterId: string;
      entityName: string | null;
      type: ReportType;
      title: string;
      category?: { name: string };
    } | null,
    user: AuthenticatedUser,
  ) {
    if (!report) {
      throw new NotFoundException('Denuncia no encontrada');
    }

    if (user.role === 'SUPERADMINISTRADOR') {
      throw new ForbiddenException(
        'El superadministrador no tiene acceso a denuncias',
      );
    }

    if (user.role === 'CIUDADANO' && report.reporterId !== user.sub) {
      throw new ForbiddenException('No tienes acceso a esta denuncia');
    }
    if (managementRoles.includes(user.role)) {
      const actor = await this.getManagementEntity(user);
      this.assertReportOrganization(report, actor.entityName);
    }
  }

  private assertManagementRole(user: AuthenticatedUser) {
    if (!managementRoles.includes(user.role)) {
      throw new ForbiddenException(
        'No tienes permisos para gestionar denuncias',
      );
    }
  }

  private async getManagementEntity(
    user: AuthenticatedUser,
  ): Promise<{ entityName: string }> {
    const actor = await this.prisma.user.findUnique({
      where: { id: user.sub },
      select: { entityName: true },
    });
    if (!actor?.entityName) {
      throw new BadRequestException(
        'Tu cuenta no tiene un ente público configurado',
      );
    }
    return { entityName: actor.entityName };
  }

  private assertReportOrganization(
    report: {
      entityName: string | null;
      type: ReportType;
      title: string;
      category?: { name: string };
    },
    actorEntityName: string,
  ) {
    if (
      !report.entityName ||
      normalizeOrganizationName(report.entityName) ===
        normalizeOrganizationName(actorEntityName)
    ) {
      return;
    }

    if (this.isOrganizationOverride(report, actorEntityName)) {
      return;
    }

    const sharedRoute = sharedReportOrganizations.find(
      ({ type, names }) =>
        type === report.type &&
        names.some(
          (name) =>
            normalizeOrganizationName(name) ===
            normalizeOrganizationName(report.entityName ?? ''),
        ) &&
        names.some(
          (name) =>
            normalizeOrganizationName(name) ===
            normalizeOrganizationName(actorEntityName),
        ),
    );

    if (!sharedRoute) {
      throw new ForbiddenException(
        'Esta denuncia está asignada a otro organismo',
      );
    }
  }

  private sharedOrganizationFilters(actorEntityName: string) {
    const normalizedActor = normalizeOrganizationName(actorEntityName);
    return sharedReportOrganizations.flatMap(({ type, names }) => {
      if (
        !names.some(
          (name) => normalizeOrganizationName(name) === normalizedActor,
        )
      ) {
        return [];
      }

      return names
        .filter((name) => normalizeOrganizationName(name) !== normalizedActor)
        .map((entityName) => ({ entityName, type }));
    });
  }

  private reportOrganizationFilters(actorEntityName: string) {
    const normalizedActor = normalizeOrganizationName(actorEntityName);
    return reportOrganizationOverrides
      .filter((route) =>
        [route.organizationName, ...route.sharedOrganizationNames].some(
          (name) => normalizeOrganizationName(name) === normalizedActor,
        ),
      )
      .flatMap((route) =>
        [route.organizationName, ...route.sharedOrganizationNames]
          .filter((name) => normalizeOrganizationName(name) !== normalizedActor)
          .map((entityName) => ({
            entityName,
            type: route.type,
            category: { is: { name: route.categoryName } },
          })),
      );
  }

  private isOrganizationOverride(
    report: {
      entityName: string | null;
      type: ReportType;
      title: string;
      category?: { name: string };
    },
    actorEntityName: string,
  ) {
    const route = this.getOrganizationOverride(report);
    if (!route) {
      return false;
    }

    const organizations = [
      route.organizationName,
      ...route.sharedOrganizationNames,
    ];
    return (
      organizations.some(
        (name) =>
          normalizeOrganizationName(name) ===
          normalizeOrganizationName(actorEntityName),
      ) &&
      organizations.some(
        (name) =>
          normalizeOrganizationName(name) ===
          normalizeOrganizationName(report.entityName ?? ''),
      )
    );
  }

  private getOrganizationOverride(report: {
    type: ReportType;
    category?: { name: string };
  }) {
    return reportOrganizationOverrides.find(
      (route) =>
        route.type === report.type &&
        normalizeOrganizationName(route.categoryName) ===
          normalizeOrganizationName(report.category?.name ?? ''),
    );
  }

  private parseDate(value: string, field: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      throw new BadRequestException(
        `La fecha ${field} debe tener formato AAAA-MM-DD`,
      );
    }
    const date = new Date(`${value}T00:00:00.000Z`);
    if (
      Number.isNaN(date.getTime()) ||
      date.toISOString().slice(0, 10) !== value
    ) {
      throw new BadRequestException(`La fecha ${field} no es válida`);
    }
    return date;
  }

  private withoutPriority<T extends { priority: ReportPriority }>(
    report: T,
  ): Omit<T, 'priority'> {
    const { priority, ...visibleReport } = report;
    void priority;
    return visibleReport;
  }
}
