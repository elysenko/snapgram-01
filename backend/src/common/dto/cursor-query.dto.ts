import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

/**
 * Shared `?cursor=&limit=` query contract.
 *
 * `limit` is bounded at both ends: 0 / negative / non-numeric values are 400s
 * rather than silently-empty pages, and the upper bound stops a single request
 * from dragging the whole table out of Postgres.
 */
export class CursorQueryDto {
  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'limit must be an integer' })
  @Min(1, { message: 'limit must be at least 1' })
  @Max(100, { message: 'limit must not exceed 100' })
  limit?: number;
}
