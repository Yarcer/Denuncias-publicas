import { ReportStatus } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class ManageReportDto {
  @IsEnum(ReportStatus)
  status: ReportStatus;
}