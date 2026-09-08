import { ExecutionContext, createParamDecorator } from '@nestjs/common';
import type { AuthUser, MaybeAuthenticatedRequest } from './auth.types';

/** Injects the verified principal (or undefined on optionally-authed routes). */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthUser | undefined => {
    return context.switchToHttp().getRequest<MaybeAuthenticatedRequest>().user;
  },
);
