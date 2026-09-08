import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { WireRole } from '../common/wire';
import type { AuthenticatedRequest } from './auth.types';
import { ROLES_KEY } from './roles.decorator';

/**
 * Enforces @Roles(...). Runs after JwtAuthGuard, so an absent principal means
 * the route was misconfigured rather than that the caller is anonymous — it
 * still answers 401 in that case, and 403 for an authenticated caller whose
 * role is not permitted.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<WireRole[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;
    if (!user) {
      throw new UnauthorizedException();
    }
    if (!required.includes(user.role)) {
      // Deliberately message-only: the body must not leak what it guards.
      throw new ForbiddenException('You do not have access to this resource');
    }
    return true;
  }
}
