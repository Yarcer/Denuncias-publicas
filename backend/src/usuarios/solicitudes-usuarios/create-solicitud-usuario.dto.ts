import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { AdministrativeRequestStatus } from '@prisma/client';

export class CreateSolicitudUsuarioDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(100)
  password!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  firstName!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  lastName!: string;
}

export class ReviewSolicitudUsuarioDto {
  @IsIn([
    AdministrativeRequestStatus.APROBADA,
    AdministrativeRequestStatus.RECHAZADA,
  ])
  status!:
    | typeof AdministrativeRequestStatus.APROBADA
    | typeof AdministrativeRequestStatus.RECHAZADA;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reviewComment?: string;
}
