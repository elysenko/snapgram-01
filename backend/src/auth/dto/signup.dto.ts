import { Transform } from 'class-transformer';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class SignupDto {
  /**
   * `require_tld: false` accepts single-label domains (host with no dot).
   * The spec's demo accounts and the platform-minted logins use that form, and
   * the default rule would reject them outright.
   */
  @Transform(trim)
  @IsEmail({ require_tld: false }, { message: 'A valid email address is required' })
  email!: string;

  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  @MaxLength(200)
  password!: string;

  @Transform(trim)
  @IsString()
  @MinLength(1, { message: 'Display name is required' })
  @MaxLength(80)
  displayName!: string;
}
