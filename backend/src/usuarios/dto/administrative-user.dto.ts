import { Role } from '@prisma/client';
import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

const administrativeRoles = [
  Role.FUNCIONARIO,
  Role.FUNCIONARIO_ADMINISTRADOR,
  Role.SUPERADMINISTRADOR,
];
const administrativeOrganizations = [
  'Intendencia',
  'OSE',
  'Policía Municipal',
];

export class CreateAdministrativeUserDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsIn(administrativeRoles)
  role!: Role;

  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsIn(administrativeOrganizations)
  @IsString()
  entityName?: string;

  @IsOptional()
  @IsString()
  jurisdiction?: string;
}
