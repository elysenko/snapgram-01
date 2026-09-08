import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { AuthService } from './auth.service';

/** Restricts the moderation queue and admin settings to ADMIN accounts. */
export const moderatorGuard: CanActivateFn = (_route, state): boolean | UrlTree => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.isModerator()) {
    return true;
  }

  if (auth.isAuthenticated()) {
    return router.createUrlTree(['/explore']);
  }

  return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
};
