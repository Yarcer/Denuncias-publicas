
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AdministrativeRequestStatus, Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateSolicitudUsuarioDto } from './create-solicitud-usuario.dto';

@Injectable()
export class SolicitudesUsuariosService {
  constructor(private readonly prisma: PrismaService) {}

  async crearSolicitud(
    usuarioId: string,
    dto: CreateSolicitudUsuarioDto,
  ) {
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
      throw new BadRequestException(
        'Tu cuenta no tiene un organismo asignado',
      );
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
    const usuarioExistente = await this.prisma.user.findUnique({
      where: { email },
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
    return this.prisma.administrativeUserRequest.create({
      data: {
        email,
        firstName,
        lastName,
        entityName: organismo,
        jurisdiction: solicitante.jurisdiction,
        requestedById: solicitante.id,
        status: AdministrativeRequestStatus.PENDIENTE,
      },
    });
  }
}
