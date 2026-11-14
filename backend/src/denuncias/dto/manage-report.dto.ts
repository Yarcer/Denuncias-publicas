import { ReportStatus } from '@prisma/client';
import {
  IsDefined,
  IsEnum,
  IsUUID,
  ValidateIf,
} from 'class-validator';

export enum RejectionReason {
  DUPLICATE = 'DUPLICATE',
  INSUFFICIENT_INFORMATION = 'INSUFFICIENT_INFORMATION',
  ISSUE_NOT_FOUND = 'ISSUE_NOT_FOUND',
}

export class ManageReportDto {
  @IsEnum(ReportStatus)
  status!: ReportStatus;

  @ValidateIf((dto: ManageReportDto) => dto.status === ReportStatus.RECHAZADO)
  @IsDefined()
  @IsEnum(RejectionReason)
  rejectionReason?: RejectionReason;
  }

  export class AssignReportDto {
    @IsUUID()
    assigneeId!: string;
  }
