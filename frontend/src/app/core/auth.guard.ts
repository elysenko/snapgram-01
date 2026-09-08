import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { AuthService } from './auth.service';

/**
 * Protects member-only routes.
 *
 * The session is rehydrated from storage synchronously in AuthService's
 * constructor, so this resolves on the first tick without a round trip. It
 * redirects at most once, and never from /login, so no guard↔shell redirect
 * loop is possible.
 */
export const authGuard: CanActivateFn = (_route, state): boolean | UrlTree => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.isAuthenticated()) {
    return true;
  }

  return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
};
