import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Role, UserStatus } from '@prisma/client';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAdministrativeUserDto } from './dto/administrative-user.dto';

type AuthenticatedUser = { sub: string; role: string };

const administrativeRoles: Role[] = [
  Role.FUNCIONARIO,
  Role.FUNCIONARIO_ADMINISTRADOR,
];
const administrativeOrganizations = [
  'Intendencia',
  'OSE',
  'Policía Municipal',
];
const administrativeUserSelection = {
  role: true,
  status: true,
  entityName: true,
} as const;

@Injectable()
export class UsuariosService {
  constructor(private readonly prisma: PrismaService) {}

  async findAdministrativeUsers(actor: AuthenticatedUser) {
    this.assertAdministrator(actor);
    const groups = await this.prisma.user.groupBy({
      by: ['role', 'status', 'entityName'],
      where: { role: { in: administrativeRoles }, isAnonymous: false },
      _count: { _all: true },
      orderBy: [{ role: 'asc' }, { entityName: 'asc' }, { status: 'asc' }],
    });

    const items = groups.map(({ role, status, entityName, _count }) => ({
      role,
      status,
      entityName,
      count: _count._all,
    }));

    return {
      items,
      count: items.reduce((total, item) => total + item.count, 0),
    };
  }

  async createAdministrativeUser(
    actor: AuthenticatedUser,
    dto: CreateAdministrativeUserDto,
  ) {
    this.assertAdministrator(actor);
    this.assertAdministrativeRole(dto.role);
    if (administrativeRoles.includes(dto.role)) {
      this.assertOrganization(dto.role, dto.entityName);
      this.assertAvailableOrganization(dto.entityName);
    }

    try {
      return await this.prisma.user.create({
        data: {
          email: dto.email.trim().toLowerCase(),
          passwordHash: await argon2.hash(dto.password),
          role: dto.role,
          firstName: dto.firstName?.trim() || null,
          lastName: dto.lastName?.trim() || null,
          entityName: administrativeRoles.includes(dto.role)
            ? dto.entityName?.trim() || null
            : null,
          jurisdiction: administrativeRoles.includes(dto.role)
            ? dto.jurisdiction?.trim() || null
            : null,
          status: UserStatus.ACTIVO,
        },
        select: administrativeUserSelection,
      });
    } catch (error) {
      this.rethrowUniqueEmail(error);
    }
  }

  private assertAdministrator(actor: AuthenticatedUser) {
    if (actor.role !== Role.SUPERADMINISTRADOR) {
      throw new ForbiddenException(
        'Solo un SUPERADMINISTRADOR puede gestionar usuarios',
      );
    }
  }

  private assertAdministrativeRole(role: Role) {
    if (
      !administrativeRoles.includes(role) &&
      role !== Role.SUPERADMINISTRADOR
    ) {
      throw new BadRequestException(
        'El rol no es válido para una cuenta administrativa',
      );
    }
  }

  private assertOrganization(role: Role, entityName?: string | null) {
    if (administrativeRoles.includes(role) && !entityName?.trim()) {
      throw new BadRequestException(
        'El organismo es obligatorio para usuarios administrativos',
      );
    }
  }

  private assertAvailableOrganization(entityName?: string | null) {
    if (
      !entityName ||
      !administrativeOrganizations.some(
        (organization) => organization === entityName.trim(),
      )
    ) {
      throw new BadRequestException(
        'El organismo debe ser Intendencia, OSE o Policía Municipal',
      );
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
        'Vuelva a intentarlo',
      );
    }
    throw error;
  }
}
