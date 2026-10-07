/**
 * Pure helpers for deciding who a player row belongs to and for building safe
 * PostgREST filters from user-controlled text. No server-only imports, so this
 * is safe to use from client and server code alike.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}

/** Trim + lowercase; empty or non-string → null. */
export function normalizeEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const e = value.trim().toLowerCase();
  return e.length > 0 ? e : null;
}

/** True only when both are non-empty and equal after trim + lowercase. */
export function emailsMatch(a: unknown, b: unknown): boolean {
  const na = normalizeEmail(a);
  const nb = normalizeEmail(b);
  return na !== null && na === nb;
}

/**
 * Make text safe to pass as a LIKE/ILIKE pattern that should match literally
 * (use with `.ilike(col, escapeLikePattern(text))`, never inside `.or(...)`).
 *
 * Escapes the SQL wildcards `%` and `_` and the escape char `\`. PostgREST
 * also turns `*` into `%` and offers no escape for it, so `*` is replaced with
 * `_` (single-char wildcard). Patterns can therefore still over-match slightly —
 * callers must re-check candidates with an exact comparison.
 */
export function escapeLikePattern(text: string): string {
  return text.replace(/[\\%_]/g, (c) => `\\${c}`).replace(/\*/g, '_');
}

/** Case-insensitive, whitespace-trimmed equality for names. */
export function sameText(a: string | null | undefined, b: string | null | undefined): boolean {
  if (a == null || b == null) return false;
  const na = a.trim().toLowerCase();
  return na.length > 0 && na === b.trim().toLowerCase();
}
