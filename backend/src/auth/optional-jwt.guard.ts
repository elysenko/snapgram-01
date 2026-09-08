import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { AuthUser } from './auth.types';

/**
 * Attaches `request.user` when a valid token is present and lets the request
 * through untouched when it is not.
 *
 * Used by the public-but-personalised reads (explore, post detail, profiles):
 * anyone may read them, but a signed-in caller additionally gets
 * `viewerHasLiked` / `viewerFollows` computed for them.
 */
@Injectable()
export class OptionalJwtGuard extends AuthGuard('jwt') {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      await super.canActivate(context);
    } catch {
      // An absent or invalid token is not an error on a public route.
    }
    return true;
  }

  handleRequest<T = AuthUser>(_err: unknown, user: T | false): T | undefined {
    return user === false || !user ? undefined : user;
  }
}
