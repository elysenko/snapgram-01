/**
 * Namespaced browser storage.
 *
 * Mockups are served many-per-origin under /<mockup_id>/ and browser storage is
 * origin-scoped, not path-scoped — an unprefixed `user` key would collide with
 * every other mockup the reviewer has opened. Every read/write in the app goes
 * through these helpers so each build gets its own keyspace.
 */

const NS = (typeof location !== 'undefined' && location.pathname.split('/')[1]) || 'app';

export const nsKey = (key: string): string => `${NS}:${key}`;

export function readRaw(key: string): string | null {
  try {
    return localStorage.getItem(nsKey(key));
  } catch {
    return null;
  }
}

export function writeRaw(key: string, value: string): void {
  try {
    localStorage.setItem(nsKey(key), value);
  } catch {
    /* storage disabled / quota exceeded — the app stays usable without it */
  }
}

export function removeRaw(key: string): void {
  try {
    localStorage.removeItem(nsKey(key));
  } catch {
    /* no-op */
  }
}

/** Reads and JSON-parses a key, returning null on anything unexpected. */
export function readJson<T>(key: string, isValid: (value: unknown) => value is T): T | null {
  const raw = readRaw(key);
  if (!raw) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (isValid(parsed)) {
      return parsed;
    }
  } catch {
    /* fall through to the clear below */
  }
  removeRaw(key);
  return null;
}

export function writeJson(key: string, value: unknown): void {
  try {
    writeRaw(key, JSON.stringify(value));
  } catch {
    /* no-op */
  }
}
