import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { MAX_CAPTION_LENGTH } from './create-post.dto';

/**
 * Caption is the only mutable field. `likeCount`, `imageKey` and friends are
 * absent, so `whitelist: true` strips any attempt to set them.
 */
export class UpdatePostDto {
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(MAX_CAPTION_LENGTH, {
    message: `Caption must be ${MAX_CAPTION_LENGTH} characters or fewer`,
  })
  caption?: string;
}
