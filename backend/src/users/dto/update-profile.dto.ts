import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

/**
 * The only two profile fields a member may change about themselves.
 *
 * id / handle / email / role are absent on purpose: with the global
 * ValidationPipe's `whitelist: true`, anything else in the body is stripped
 * before it reaches the service, so a privilege-escalating payload silently
 * becomes a no-op instead of an update.
 */
export class UpdateProfileDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(1, { message: 'Display name cannot be empty' })
  @MaxLength(80)
  displayName?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(500, { message: 'Bio must be 500 characters or fewer' })
  bio?: string;
}
