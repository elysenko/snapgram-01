import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { AuthService } from './auth.service';

/**
 * Protects member-only routes.
 *
 * In the static preview a cold load of an authenticated route must render that
 * screen rather than bouncing to /login, so the guard seeds the preview session
 * and admits the navigation. It redirects at most once, and never from /login,
 * so no guard↔shell redirect loop is possible.
 */
export const authGuard: CanActivateFn = (_route, state): boolean | UrlTree => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (COLOSSUS_PREVIEW) {
    auth.previewSignIn();
    return true;
  }

  if (auth.isAuthenticated()) {
    return true;
  }

  return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
};
