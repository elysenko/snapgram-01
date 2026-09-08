/**
 * Relative-time formatting for wire timestamps.
 *
 * The approved design renders compact ages ("12m", "3h", "2d") inline next to
 * authors and reports. The API sends ISO-8601 strings, so every timestamp is
 * folded through here at the service boundary — the components and templates
 * keep receiving exactly the short strings they were designed against.
 */
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;
const MONTH = 30 * DAY;
const YEAR = 365 * DAY;

export function timeAgo(iso: string | null | undefined, now: number = Date.now()): string {
  if (!iso) {
    return '';
  }
  const then = Date.parse(iso);
  if (Number.isNaN(then)) {
    // Already a display string (or something we cannot parse) — pass it through
    // untouched rather than rendering "NaN".
    return iso;
  }
  const delta = Math.max(0, now - then);
  if (delta < MINUTE) return 'now';
  if (delta < HOUR) return `${Math.floor(delta / MINUTE)}m`;
  if (delta < DAY) return `${Math.floor(delta / HOUR)}h`;
  if (delta < WEEK) return `${Math.floor(delta / DAY)}d`;
  if (delta < MONTH) return `${Math.floor(delta / WEEK)}w`;
  if (delta < YEAR) return `${Math.floor(delta / MONTH)}mo`;
  return `${Math.floor(delta / YEAR)}y`;
}
