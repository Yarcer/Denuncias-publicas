import { Role, UserStatus } from '@prisma/client';
import {
  IsEmail,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

const administrativeStaffRoles = [
  Role.FUNCIONARIO,
  Role.FUNCIONARIO_ADMINISTRADOR,
];

export class CreateAdministrativeUserDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsIn(administrativeStaffRoles)
  role!: Role;

  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsString()
  entityName?: string;

  @IsOptional()
  @IsString()
  jurisdiction?: string;
}

export class UpdateAdministrativeUserDto {
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;

  @IsOptional()
  @IsIn(administrativeStaffRoles)
  role?: Role;

  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsString()
  entityName?: string;

  @IsOptional()
  @IsString()
  jurisdiction?: string;
}

export class UpdateAdministrativeUserStatusDto {
  @IsEnum(UserStatus)
  status!: UserStatus;
}
