import { Transform } from 'class-transformer';
import { IsEmail, IsString, MinLength } from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class LoginDto {
  /**
   * Matches the signup rule. Validation here must never be stricter than the
   * addresses the platform seed can mint, or those accounts could not log in.
   */
  @Transform(trim)
  @IsEmail({ require_tld: false }, { message: 'A valid email address is required' })
  email!: string;

  @IsString()
  @MinLength(1, { message: 'Password is required' })
  password!: string;
}
