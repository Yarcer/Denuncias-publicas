import { ReportStatus } from '@prisma/client';
import { IsEnum, IsUUID } from 'class-validator';

export class ManageReportDto {
  @IsEnum(ReportStatus)
  status: ReportStatus;
}

export class AssignReportDto {
  @IsUUID()
  assigneeId: string;
}
