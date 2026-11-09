import {
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { LoginUserDto, RegisterUserDto } from './dto/register-user.dto';
import { IpAbuseProtectionService } from '../common/services/ip-abuse-protection.service';

const anonymousAccountLimit = 3;
const anonymousAccountWindowMs = 20 * 24 * 60 * 60 * 1000;
const cleanupBatchSize = 500;

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private readonly ipAbuseProtection: IpAbuseProtectionService,
  ) {}

  async register(dto: RegisterUserDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existingUser) {
      throw new ConflictException('El correo ya está registrado');
    }

    const passwordHash = await argon2.hash(dto.password);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        role: 'CIUDADANO',
      },
    });

    return {
      user: this.publicUser(user),
      accessToken: this.signToken(user.id, user.email, user.role),
    };
  }

  async login(dto: LoginUserDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    if (user.status !== 'ACTIVO') {
      throw new UnauthorizedException('La cuenta no está activa');
    }

    if (!user.passwordHash) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const isValid = await argon2.verify(user.passwordHash, dto.password);
    if (!isValid) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    if (
      (dto.portal === 'ciudadano' && user.role !== 'CIUDADANO') ||
      (dto.portal === 'gestion' &&
        user.role !== 'FUNCIONARIO' &&
        user.role !== 'FUNCIONARIO_ADMINISTRADOR' &&
        user.role !== 'SUPERADMINISTRADOR')
    ) {
      throw new UnauthorizedException(
        'La cuenta no tiene acceso a este portal',
      );
    }

    return {
      user: this.publicUser(user),
      accessToken: this.signToken(user.id, user.email, user.role),
    };
  }

  async anonymousLogin(ipAddress: string | undefined) {
    const ipHash = this.ipAbuseProtection.hashIpAddress(ipAddress);
    const anonymousId = randomUUID();

    try {
      const user = await this.prisma.$transaction(async (transaction) => {
        await this.ipAbuseProtection.acquireIpLock(
          transaction,
          'anonymous-account',
          ipHash,
        );
        const recentAccounts = await transaction.user.count({
          where: {
            isAnonymous: true,
            anonymousIpHash: ipHash,
            createdAt: { gte: new Date(Date.now() - anonymousAccountWindowMs) },
          },
        });

        if (recentAccounts >= anonymousAccountLimit) {
          throw new HttpException(
            'Se alcanzó el límite de sesiones anónimas para esta conexión. Inténtalo más tarde.',
            HttpStatus.TOO_MANY_REQUESTS,
          );
        }

        return transaction.user.create({
          data: {
            email: `anon-${anonymousId}@anonymous.local`,
            passwordHash: null,
            firstName: 'Visitante',
            isAnonymous: true,
            anonymousIpHash: ipHash,
            role: 'CIUDADANO',
          },
        });
      });
      return {
        user: this.publicUser(user),
        accessToken: this.signToken(user.id, user.email, user.role),
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new ServiceUnavailableException(
        'La base de datos no está disponible. Inicia PostgreSQL e inténtalo de nuevo.',
      );
    }
  }

  async cleanupExpiredAnonymousAccounts() {
    const cutoff = new Date(Date.now() - anonymousAccountWindowMs);
    const reportIpHashCutoff = new Date(Date.now() - 60 * 60 * 1000);
    let deletedAccounts = 0;

    while (true) {
      const expiredAccounts = await this.prisma.user.findMany({
        where: {
          isAnonymous: true,
          createdAt: { lt: cutoff },
          reports: { none: {} },
        },
        select: { id: true },
        orderBy: { createdAt: 'asc' },
        take: cleanupBatchSize,
      });

      if (expiredAccounts.length === 0) break;

      const deleted = await this.prisma.user.deleteMany({
        where: {
          id: { in: expiredAccounts.map(({ id }) => id) },
          reports: { none: {} },
        },
      });
      deletedAccounts += deleted.count;
      if (deleted.count === 0) break;
    }

    const clearedAccountHashes = await this.prisma.user.updateMany({
      where: {
        isAnonymous: true,
        anonymousIpHash: { not: null },
        createdAt: { lt: cutoff },
      },
      data: { anonymousIpHash: null },
    });
    const clearedReportHashes = await this.prisma.report.updateMany({
      where: {
        reporterIpHash: { not: null },
        createdAt: { lt: reportIpHashCutoff },
      },
      data: { reporterIpHash: null },
    });

    return {
      deletedAccounts,
      clearedAccountHashes: clearedAccountHashes.count,
      clearedReportHashes: clearedReportHashes.count,
    };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('Usuario no encontrado');
    }

    return this.publicUser(user);
  }

  private signToken(userId: string, email: string, role: string) {
    return this.jwtService.sign({
      sub: userId,
      email,
      role,
    });
  }

  private publicUser(user: {
    id: string;
    email: string;
    role: string;
    isAnonymous: boolean;
    status: string;
    firstName: string | null;
    lastName: string | null;
    entityName: string | null;
    phone: string | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      isAnonymous: user.isAnonymous,
      status: user.status,
      firstName: user.firstName,
      lastName: user.lastName,
      entityName: user.entityName,
      phone: user.phone,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
