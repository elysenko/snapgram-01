import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export const MAX_CAPTION_LENGTH = 2200;

export class CreatePostDto {
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(MAX_CAPTION_LENGTH, {
    message: `Caption must be ${MAX_CAPTION_LENGTH} characters or fewer`,
  })
  caption?: string;
}
