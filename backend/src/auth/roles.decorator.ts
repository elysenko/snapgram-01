import { SetMetadata } from '@nestjs/common';
import type { WireRole } from '../common/wire';

export const ROLES_KEY = 'roles';

/** Restrict a route to the listed roles; enforced by RolesGuard. */
export const Roles = (...roles: WireRole[]) => SetMetadata(ROLES_KEY, roles);
