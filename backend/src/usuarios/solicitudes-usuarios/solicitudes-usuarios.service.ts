import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { AdministrativeRequestStatus, Role } from '@prisma/client';
import * as argon2 from 'argon2';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateSolicitudUsuarioDto,
  ReviewSolicitudUsuarioDto,
} from './create-solicitud-usuario.dto';

const requestSelection = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  entityName: true,
  jurisdiction: true,
  status: true,
  reviewComment: true,
  reviewedAt: true,
  createdAt: true,
  requestedBy: {
    select: {
      firstName: true,
      lastName: true,
      email: true,
    },
  },
} as const;

@Injectable()
export class SolicitudesUsuariosService {
  constructor(private readonly prisma: PrismaService) {}

  async crearSolicitud(usuarioId: string, dto: CreateSolicitudUsuarioDto) {
    // 1. Buscar al usuario que está haciendo la solicitud.
    const solicitante = await this.prisma.user.findUnique({
      where: { id: usuarioId },
    });

    if (!solicitante) {
      throw new UnauthorizedException('Usuario no encontrado');
    }

    // 2. Comprobar que tenga permiso y su cuenta esté activa.
    if (
      solicitante.role !== Role.FUNCIONARIO_ADMINISTRADOR ||
      solicitante.status !== 'ACTIVO'
    ) {
      throw new ForbiddenException(
        'No tienes permisos para solicitar funcionarios',
      );
    }

    // 3. Obtener el organismo de su cuenta.
    const organismo = solicitante.entityName?.trim();

    if (!organismo) {
      throw new BadRequestException('Tu cuenta no tiene un organismo asignado');
    }

    // 4. Normalizar y validar los datos recibidos.
    const email = dto.email.trim().toLowerCase();
    const firstName = dto.firstName.trim();
    const lastName = dto.lastName.trim();

    if (!email || !firstName || !lastName) {
      throw new BadRequestException(
        'El correo, nombre y apellido son obligatorios',
      );
    }

    // 5. Comprobar que no exista una cuenta con ese correo.
    const usuarioExistente = await this.prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
    });

    if (usuarioExistente) {
      throw new ConflictException(
        'Ya existe un usuario registrado con ese correo',
      );
    }

    // 6. Comprobar que no haya una solicitud pendiente.
    const solicitudExistente =
      await this.prisma.administrativeUserRequest.findFirst({
        where: {
          email: { equals: email, mode: 'insensitive' },
          status: AdministrativeRequestStatus.PENDIENTE,
        },
      });

    if (solicitudExistente) {
      throw new ConflictException(
        'Ya existe una solicitud pendiente para ese correo',
      );
    }

    // 7. Guardar la solicitud en PostgreSQL.
    try {
      return await this.prisma.administrativeUserRequest.create({
        data: {
          email,
          passwordHash: await argon2.hash(dto.password),
          firstName,
          lastName,
          entityName: organismo,
          jurisdiction: solicitante.jurisdiction,
          requestedById: solicitante.id,
          status: AdministrativeRequestStatus.PENDIENTE,
        },
        select: requestSelection,
      });
    } catch (error) {
      this.rethrowUniqueEmail(error);
    }
  }

  async listarSolicitudes(usuarioId: string, role: string) {
    const where =
      role === Role.SUPERADMINISTRADOR
        ? {}
        : role === Role.FUNCIONARIO_ADMINISTRADOR
          ? { requestedById: usuarioId }
          : null;

    if (!where) {
      throw new ForbiddenException('No tienes permisos para ver solicitudes');
    }

    const items = await this.prisma.administrativeUserRequest.findMany({
      where,
      select: requestSelection,
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    });

    return { items, count: items.length };
  }

  async revisarSolicitud(
    revisorId: string,
    id: string,
    dto: ReviewSolicitudUsuarioDto,
  ) {
    try {
      return await this.prisma.$transaction(async (transaction) => {
        const request = await transaction.administrativeUserRequest.findUnique({
          where: { id },
        });

        if (!request) {
          throw new NotFoundException('Solicitud no encontrada');
        }

        if (request.status !== AdministrativeRequestStatus.PENDIENTE) {
          throw new ConflictException('La solicitud ya fue revisada');
        }

        if (dto.status === AdministrativeRequestStatus.APROBADA) {
          const passwordHash = request.passwordHash;
          if (!passwordHash) {
            throw new BadRequestException(
              'La solicitud no tiene una contraseña inicial. Solicita nuevamente el alta.',
            );
          }

          const existingUser = await transaction.user.findFirst({
            where: {
              email: { equals: request.email, mode: 'insensitive' },
            },
            select: { id: true },
          });
          if (existingUser) {
            throw new ConflictException(
              'Ya existe un usuario registrado con ese correo electrónico',
            );
          }

          await transaction.user.create({
            data: {
              email: request.email,
              passwordHash,
              firstName: request.firstName,
              lastName: request.lastName,
              role: Role.FUNCIONARIO,
              status: 'ACTIVO',
              entityName: request.entityName,
              jurisdiction: request.jurisdiction,
            },
          });
        }

        const update = await transaction.administrativeUserRequest.updateMany({
          where: { id, status: AdministrativeRequestStatus.PENDIENTE },
          data: {
            status: dto.status,
            reviewedById: revisorId,
            reviewComment: dto.reviewComment?.trim() || null,
            reviewedAt: new Date(),
            passwordHash: null,
          },
        });

        if (update.count !== 1) {
          throw new ConflictException('La solicitud ya fue revisada');
        }

        return transaction.administrativeUserRequest.findUniqueOrThrow({
          where: { id },
          select: requestSelection,
        });
      });
    } catch (error) {
      this.rethrowUniqueEmail(error);
    }
  }

  private rethrowUniqueEmail(error: unknown): never {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'P2002'
    ) {
      throw new ConflictException(
        'Ya existe un usuario registrado con ese correo electrónico',
      );
    }

    throw error;
  }
}
