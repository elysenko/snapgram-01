import { ReportStatus } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';

export class ReportQueryDto {
  /** Defaults to the open queue; an unrecognised value is a 400, not a silent all-rows read. */
  @IsOptional()
  @IsEnum(ReportStatus, { message: 'status must be either "open" or "closed"' })
  status?: ReportStatus;
}
