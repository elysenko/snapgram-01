import { randomBytes } from 'node:crypto';
import { Logger } from '@nestjs/common';
import type { SignOptions } from 'jsonwebtoken';

/**
 * Signing material for access tokens.
 *
 * JWT_SECRET is app-owned config the platform always provisions, and it is read
 * once at module load because Passport needs it synchronously when the strategy
 * is constructed.
 *
 * There is deliberately no literal fallback. A checked-in default would be a
 * publicly-known signing key: anyone could mint `{sub, role: 'ADMIN'}` and walk
 * straight through RolesGuard on any deployment where the variable failed to
 * arrive. Instead an ephemeral random secret is generated for the process, which
 * fails safe — tokens still work for this process's lifetime, so the pod boots
 * and every read path serves, but nothing an attacker can predict is ever used,
 * and sessions do not survive a restart. The warning is the signal to fix the env.
 */
function resolveJwtSecret(): string {
  const fromEnv = process.env.JWT_SECRET;
  if (typeof fromEnv === 'string' && fromEnv.trim() !== '') {
    return fromEnv;
  }
  new Logger('AuthConstants').warn(
    'JWT_SECRET is not set — generated an ephemeral signing key for this process. ' +
      'Sessions will not survive a restart or span replicas. Set JWT_SECRET.',
  );
  return randomBytes(48).toString('hex');
}

export const JWT_SECRET: string = resolveJwtSecret();

/**
 * Cast once here: the value is a duration string from the environment, which
 * @types/jsonwebtoken models as the opaque `StringValue` template type.
 */
export const JWT_EXPIRES_IN = (process.env.JWT_EXPIRES_IN ??
  process.env.JWT_EXPIRATION ??
  process.env.JWT_EXP ??
  '7d') as SignOptions['expiresIn'];

export const BCRYPT_ROUNDS = 10;
