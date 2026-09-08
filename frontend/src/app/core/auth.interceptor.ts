import { inject } from '@angular/core';
import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { TOKEN_KEY, USER_KEY, readRaw, removeRaw } from './storage';

/** Requests that must not trigger the sign-out redirect on 401. */
const AUTH_ENDPOINTS = ['/api/auth/login', '/api/auth/signup'];

/**
 * Attaches the bearer token to every API call and turns an expired session
 * into a single redirect to /login?returnUrl=<here>.
 *
 * It reads the token from storage rather than from AuthService so the HTTP
 * stack never depends on the session service — AuthService itself issues HTTP
 * calls, and injecting it here would close that loop.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);

  const isApiCall = req.url.startsWith('/api/');
  const token = isApiCall ? readRaw(TOKEN_KEY) : null;
  const outbound = token
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(outbound).pipe(
    catchError((error: unknown) => {
      const unauthorized = error instanceof HttpErrorResponse && error.status === 401;
      const isLoginAttempt = AUTH_ENDPOINTS.some((path) => req.url.startsWith(path));

      // Only a *stale* credential logs the member out. A failed sign-in attempt
      // is a form error, and an anonymous read of a guarded route (the feed,
      // say) is answered by the route guard, not by clearing storage.
      if (unauthorized && isApiCall && !isLoginAttempt && token) {
        removeRaw(TOKEN_KEY);
        removeRaw(USER_KEY);
        void router.navigate(['/login'], { queryParams: { returnUrl: router.url } });
      }
      return throwError(() => error);
    }),
  );
};
