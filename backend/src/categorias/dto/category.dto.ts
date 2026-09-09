import { ReportType } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsString } from 'class-validator';

export class CreateCategoryDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEnum(ReportType)
  type: ReportType;

  @IsString()
  @IsNotEmpty()
  description?: string;
}

export class UpdateCategoryDto {
  @IsString()
  name?: string;

  @IsEnum(ReportType)
  type?: ReportType;

  @IsString()
  description?: string;
}
