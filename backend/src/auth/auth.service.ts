import { ConflictException, Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { LoginUserDto, RegisterUserDto } from './dto/register-user.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
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
      accessToken: await this.signToken(user.id, user.email, user.role),
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

    const isValid = await argon2.verify(user.passwordHash, dto.password);
    if (!isValid) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    return {
      user: this.publicUser(user),
      accessToken: await this.signToken(user.id, user.email, user.role),
    };
  }

  async anonymousLogin() {
    const anonymousId = randomUUID();
    let user;
    try {
      user = await this.prisma.user.create({
        data: {
          email: `anon-${anonymousId}@anonymous.local`,
          passwordHash: await argon2.hash(randomUUID()),
          firstName: 'Visitante',
          role: 'CIUDADANO',
        },
      });
    } catch {
      throw new ServiceUnavailableException(
        'La base de datos no está disponible. Inicia PostgreSQL e inténtalo de nuevo.',
      );
    }

    return {
      user: this.publicUser(user),
      accessToken: await this.signToken(user.id, user.email, user.role),
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

  private async signToken(userId: string, email: string, role: string) {
    return this.jwtService.sign({
      sub: userId,
      email,
      role,
    });
  }

  private publicUser(user: { id: string; email: string; role: string; status: string; firstName: string | null; lastName: string | null; phone: string | null; createdAt: Date; updatedAt: Date; }) {
    const { passwordHash, ...rest } = user as typeof user & { passwordHash?: string };
    return rest;
  }
}
