import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, firstValueFrom } from 'rxjs';
import { toApiError } from '../../core/api-error';

export type QueryParams = Record<string, string | number | boolean | null | undefined>;

/** Same-origin API root. nginx proxies /api/ through to the NestJS service. */
export const API_BASE = '/api';

/**
 * Thin promise-shaped wrapper over HttpClient.
 *
 * Every `*-api.service.ts` goes through this one class so the base path, the
 * query-param encoding and the HttpErrorResponse → ApiError normalisation are
 * defined exactly once. Bearer tokens are added by authInterceptor, not here.
 */
@Injectable({ providedIn: 'root' })
export class ApiClient {
  private readonly http = inject(HttpClient);

  get<T>(path: string, query?: QueryParams): Promise<T> {
    return this.send(this.http.get<T>(API_BASE + path, { params: toHttpParams(query) }));
  }

  post<T>(path: string, body?: unknown): Promise<T> {
    return this.send(this.http.post<T>(API_BASE + path, body ?? {}));
  }

  patch<T>(path: string, body?: unknown): Promise<T> {
    return this.send(this.http.patch<T>(API_BASE + path, body ?? {}));
  }

  put<T>(path: string, body?: unknown): Promise<T> {
    return this.send(this.http.put<T>(API_BASE + path, body ?? {}));
  }

  delete<T>(path: string): Promise<T> {
    return this.send(this.http.delete<T>(API_BASE + path));
  }

  /**
   * Multipart upload. The Content-Type header is deliberately left unset so the
   * browser writes the multipart boundary itself — setting it by hand produces
   * a body multer cannot parse.
   */
  upload<T>(method: 'POST' | 'PUT', path: string, form: FormData): Promise<T> {
    const request =
      method === 'POST'
        ? this.http.post<T>(API_BASE + path, form)
        : this.http.put<T>(API_BASE + path, form);
    return this.send(request);
  }

  private async send<T>(request: Observable<T>): Promise<T> {
    try {
      return await firstValueFrom(request);
    } catch (error) {
      throw toApiError(error);
    }
  }
}

function toHttpParams(query?: QueryParams): HttpParams {
  let params = new HttpParams();
  if (!query) {
    return params;
  }
  for (const [key, value] of Object.entries(query)) {
    if (value !== null && value !== undefined && value !== '') {
      params = params.set(key, String(value));
    }
  }
  return params;
}
