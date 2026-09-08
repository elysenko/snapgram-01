import { Transform } from 'class-transformer';
import { IsString, Length } from 'class-validator';

export const MAX_REASON_LENGTH = 500;

export class CreateReportDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(1, MAX_REASON_LENGTH, {
    message: `Reason must be between 1 and ${MAX_REASON_LENGTH} characters`,
  })
  reason!: string;
}
