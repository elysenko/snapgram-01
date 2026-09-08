import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { AuthService } from './auth.service';

/**
 * Keeps signed-in members off /login and /signup.
 *
 * The preview always admits the navigation: the login and signup screens are
 * themselves reviewable UI, and this route must never redirect on restored
 * state (that is the loop the shell guard is guaranteeing against).
 */
export const guestGuard: CanActivateFn = (): boolean | UrlTree => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (COLOSSUS_PREVIEW) {
    return true;
  }

  return auth.isAuthenticated() ? router.createUrlTree(['/feed']) : true;
};
