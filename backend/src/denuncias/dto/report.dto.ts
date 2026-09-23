import { ReportPriority, ReportStatus, ReportType } from '@prisma/client';
import { IsEnum, IsLatitude, IsLongitude, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateReportDto {
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  @IsNotEmpty()
  description!: string;

  @IsEnum(ReportType)
  type!: ReportType;

  @IsEnum(ReportPriority)
  @IsOptional()
  priority?: ReportPriority;

  @IsLatitude()
  latitude!: number;

  @IsLongitude()
  longitude!: number;

  @IsString()
  @IsOptional()
  address?: string;

  @IsString()
  @IsOptional()
  reference?: string;

  @IsString()
  @IsNotEmpty()
  categoryId!: string;
}

export class UpdateReportDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(ReportPriority)
  @IsOptional()
  priority?: ReportPriority;

  @IsEnum(ReportStatus)
  @IsOptional()
  status?: ReportStatus;

  @IsUUID()
  @IsOptional()
  assigneeId?: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsString()
  @IsOptional()
  reference?: string;
}