import type { SignOptions } from 'jsonwebtoken';

/**
 * Signing material for access tokens.
 *
 * JWT_SECRET is app-owned config the platform always provisions, so it is read
 * once at module load. The development fallback keeps `npm start` working on a
 * bare checkout; it is never reached in a deployed pod.
 */
export const JWT_SECRET: string =
  process.env.JWT_SECRET && process.env.JWT_SECRET.trim() !== ''
    ? process.env.JWT_SECRET
    : 'snapgram-development-secret-change-me';

/**
 * Cast once here: the value is a duration string from the environment, which
 * @types/jsonwebtoken models as the opaque `StringValue` template type.
 */
export const JWT_EXPIRES_IN = (process.env.JWT_EXPIRES_IN ??
  process.env.JWT_EXPIRATION ??
  process.env.JWT_EXP ??
  '7d') as SignOptions['expiresIn'];

export const BCRYPT_ROUNDS = 10;
