/**
 * Open-redirect guard for `next` / `redirect` query params.
 *
 * Only same-origin relative paths are allowed: must start with a single '/',
 * and must not contain a backslash, a colon, or any control character
 * (browsers strip tabs/newlines from URLs, so "/\t/evil.com" would otherwise
 * become the protocol-relative "//evil.com").
 *
 * No imports — safe for middleware, route handlers and client components.
 */
export function isSafeRelativePath(value: string | null | undefined): value is string {
  if (typeof value !== 'string' || value.length === 0) return false;
  if (!value.startsWith('/') || value.startsWith('//')) return false;
  if (value.includes('\\') || value.includes(':')) return false;
  if (/[\u0000-\u001f\u007f]/.test(value)) return false;
  return true;
}

/** Returns `value` if it is a safe relative path, otherwise `fallback`. */
export function safeRelativePath(value: string | null | undefined, fallback = '/'): string {
  return isSafeRelativePath(value) ? value : fallback;
}
