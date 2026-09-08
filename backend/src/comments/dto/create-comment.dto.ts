import { Transform } from 'class-transformer';
import { IsString, Length } from 'class-validator';

export const MAX_COMMENT_LENGTH = 500;

export class CreateCommentDto {
  /**
   * Trimmed before validation, so a whitespace-only comment fails the minimum
   * length rather than being stored as an empty bubble.
   */
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(1, MAX_COMMENT_LENGTH, {
    message: `Comment must be between 1 and ${MAX_COMMENT_LENGTH} characters`,
  })
  text!: string;
}
