import { HttpErrorResponse } from '@angular/common/http';

/**
 * Normalised transport failure.
 *
 * Nest answers validation failures with `{ message: string | string[] }`, so
 * the raw HttpErrorResponse is flattened here once and every call site can
 * render `error.message` straight into the banner the design already has.
 */
export class ApiError extends Error {
  constructor(
    override readonly message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const FALLBACK = 'Something went wrong. Please try again.';

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) {
    return error;
  }
  if (error instanceof HttpErrorResponse) {
    return new ApiError(extractMessage(error), error.status);
  }
  return new ApiError(FALLBACK, 0);
}

/** Convenience for `catch` blocks that only need a string for the UI. */
export function errorMessage(error: unknown): string {
  return toApiError(error).message;
}

function extractMessage(response: HttpErrorResponse): string {
  // status 0 means the request never reached the server (offline / CORS / DNS).
  if (response.status === 0) {
    return 'Cannot reach the SnapGram API. Check your connection and try again.';
  }
  const body: unknown = response.error;
  const raw = typeof body === 'object' && body !== null ? (body as { message?: unknown }).message : undefined;
  if (typeof raw === 'string' && raw.trim()) {
    return raw;
  }
  if (Array.isArray(raw)) {
    const joined = raw.filter((item): item is string => typeof item === 'string').join(' ');
    if (joined.trim()) {
      return joined;
    }
  }
  if (typeof body === 'string' && body.trim() && !body.trim().startsWith('<')) {
    return body;
  }
  return response.status === 404 ? 'Not found.' : FALLBACK;
}
