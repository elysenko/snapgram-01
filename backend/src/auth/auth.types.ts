import type { Request } from 'express';
import type { WireRole } from '../common/wire';

/** Claims carried by every access token. */
export interface JwtPayload {
  sub: string;
  email: string;
  role: WireRole;
  handle: string;
}

/** The principal attached to `request.user` once a token is verified. */
export interface AuthUser {
  id: string;
  email: string;
  role: WireRole;
  handle: string;
}

/**
 * Request shape after JwtAuthGuard. Declared as an interface rather than a
 * global `declare module` augmentation so it cannot collide with another
 * module's Express augmentation.
 */
export interface AuthenticatedRequest extends Request {
  user: AuthUser;
}

/** Request shape after OptionalJwtGuard, where a principal may be absent. */
export interface MaybeAuthenticatedRequest extends Request {
  user?: AuthUser;
}
