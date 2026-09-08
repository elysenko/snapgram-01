import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter, withComponentInputBinding, withInMemoryScrolling } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import { authInterceptor } from './core/auth.interceptor';
import { routes } from './app.routes';

/**
 * Application providers.
 *
 * Data access is plain REST over HttpClient against the NestJS service at
 * `/api` (nginx proxies that prefix through to the backend container). The
 * typed call surface lives in `shared/api/*-api.service.ts`; `authInterceptor`
 * is registered here so every one of those services sends the bearer token and
 * shares one expired-session redirect.
 */
export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(
      routes,
      withComponentInputBinding(),
      withInMemoryScrolling({ scrollPositionRestoration: 'top', anchorScrolling: 'enabled' }),
    ),
    provideHttpClient(withInterceptors([authInterceptor])),
    provideAnimations(),
  ],
};
