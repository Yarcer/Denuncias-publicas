import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Role, UserStatus } from '@prisma/client';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateAdministrativeUserDto,
  UpdateAdministrativeUserDto,
  UpdateAdministrativeUserStatusDto,
} from './dto/administrative-user.dto';

type AuthenticatedUser = { sub: string; role: string };

const administrativeRoles: Role[] = [Role.ENTE_PUBLICO, Role.ADMINISTRADOR];
const administrativeUserSelection = {
  id: true,
  email: true,
  role: true,
  status: true,
  firstName: true,
  lastName: true,
  entityName: true,
  jurisdiction: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class UsuariosService {
  constructor(private readonly prisma: PrismaService) {}

  async findAdministrativeUsers(actor: AuthenticatedUser) {
    this.assertAdministrator(actor);
    const items = await this.prisma.user.findMany({
      where: { role: { in: administrativeRoles }, isAnonymous: false },
      select: administrativeUserSelection,
      orderBy: [{ role: 'asc' }, { email: 'asc' }],
    });

    return { items, count: items.length };
  }

  async createAdministrativeUser(actor: AuthenticatedUser, dto: CreateAdministrativeUserDto) {
    this.assertAdministrator(actor);
    this.assertAdministrativeRole(dto.role);
    this.assertOrganization(dto.role, dto.entityName);

    try {
      return await this.prisma.user.create({
        data: {
          email: dto.email.trim().toLowerCase(),
          passwordHash: await argon2.hash(dto.password),
          role: dto.role,
          firstName: dto.firstName?.trim() || null,
          lastName: dto.lastName?.trim() || null,
          entityName: dto.entityName?.trim() || null,
          jurisdiction: dto.jurisdiction?.trim() || null,
          status: UserStatus.ACTIVO,
        },
        select: administrativeUserSelection,
      });
    } catch (error) {
      this.rethrowUniqueEmail(error);
    }
  }

  async updateAdministrativeUser(
    actor: AuthenticatedUser,
    id: string,
    dto: UpdateAdministrativeUserDto,
  ) {
    this.assertAdministrator(actor);
    const current = await this.findManagedUser(id);
    const role = dto.role ?? current.role;
    const entityName = dto.entityName === undefined ? current.entityName : dto.entityName;

    this.assertAdministrativeRole(role);
    this.assertOrganization(role, entityName ?? undefined);

    if (id === actor.sub && role !== Role.ADMINISTRADOR) {
      throw new BadRequestException('No puedes quitarte tu propio rol de administrador');
    }

    const data = {
      ...(dto.email !== undefined ? { email: dto.email.trim().toLowerCase() } : {}),
      ...(dto.role !== undefined ? { role: dto.role } : {}),
      ...(dto.firstName !== undefined ? { firstName: dto.firstName.trim() || null } : {}),
      ...(dto.lastName !== undefined ? { lastName: dto.lastName.trim() || null } : {}),
      ...(dto.entityName !== undefined ? { entityName: dto.entityName.trim() || null } : {}),
      ...(dto.jurisdiction !== undefined ? { jurisdiction: dto.jurisdiction.trim() || null } : {}),
      ...(dto.password ? { passwordHash: await argon2.hash(dto.password) } : {}),
    };

    try {
      return await this.prisma.user.update({
        where: { id },
        data,
        select: administrativeUserSelection,
      });
    } catch (error) {
      this.rethrowUniqueEmail(error);
    }
  }

  async updateAdministrativeUserStatus(
    actor: AuthenticatedUser,
    id: string,
    dto: UpdateAdministrativeUserStatusDto,
  ) {
    this.assertAdministrator(actor);
    await this.findManagedUser(id);

    if (id === actor.sub && dto.status !== UserStatus.ACTIVO) {
      throw new BadRequestException('No puedes deshabilitar tu propia cuenta');
    }

    return this.prisma.user.update({
      where: { id },
      data: { status: dto.status },
      select: administrativeUserSelection,
    });
  }

  private async findManagedUser(id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, role: { in: administrativeRoles }, isAnonymous: false },
      select: administrativeUserSelection,
    });

    if (!user) {
      throw new NotFoundException('Usuario administrativo no encontrado');
    }

    return user;
  }

  private assertAdministrator(actor: AuthenticatedUser) {
    if (actor.role !== Role.ADMINISTRADOR) {
      throw new ForbiddenException('Solo un superadministrador puede gestionar usuarios');
    }
  }

  private assertAdministrativeRole(role: Role) {
    if (!administrativeRoles.includes(role)) {
      throw new BadRequestException('El rol debe ser Ente público o Administrador');
    }
  }

  private assertOrganization(role: Role, entityName?: string | null) {
    if (role === Role.ENTE_PUBLICO && !entityName?.trim()) {
      throw new BadRequestException('El organismo es obligatorio para usuarios de ente público');
    }
  }

  private rethrowUniqueEmail(error: unknown): never {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'P2002'
    ) {
      throw new ConflictException('Ya existe un usuario con ese correo electrónico');
    }
    throw error;
  }
}
