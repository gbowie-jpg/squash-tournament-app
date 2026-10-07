import { NextRequest, NextResponse } from 'next/server';

/**
 * In-memory sliding-window rate limiter.
 *
 * Works per Vercel serverless instance — sufficient for a tournament app at this
 * scale. For cross-instance limiting, swap the store for Upstash Redis.
 *
 * Usage:
 *   const limited = rateLimit(req, { window: 60_000, max: 10 });
 *   if (limited) return limited; // returns a 429 NextResponse
 */

interface Window {
  count: number;
  resetAt: number;
}

// Global store: key → { count, resetAt }
const store = new Map<string, Window>();

// Clean up expired entries every 5 minutes to avoid memory growth
let lastCleanup = Date.now();
function maybeCleanup() {
  const now = Date.now();
  if (now - lastCleanup < 5 * 60_000) return;
  lastCleanup = now;
  for (const [key, win] of store) {
    if (now > win.resetAt) store.delete(key);
  }
}

/**
 * @param req     - The incoming NextRequest (used to extract the caller IP)
 * @param options - window: milliseconds, max: requests allowed per window,
 *                  bucket: optional fixed key name used instead of the URL path
 *                  (use for dynamic routes so the caller can't pick a fresh
 *                  bucket by varying a path segment)
 * @param suffix  - Optional string appended to the key (e.g. tournament id) to
 *                  prevent one heavy tournament from blocking another
 * @returns NextResponse (429) if over limit, otherwise null
 */
export function rateLimit(
  req: NextRequest,
  options: { window: number; max: number; bucket?: string },
  suffix = '',
): NextResponse | null {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    req.headers.get('x-real-ip') ||
    'unknown';

  const bucket = options.bucket ?? new URL(req.url).pathname;
  return rateLimitKey(`${ip}:${bucket}${suffix ? ':' + suffix : ''}`, options);
}

/**
 * Same limiter, keyed by an arbitrary caller-supplied key instead of the
 * caller IP (e.g. a hash of an email address, to cap resends per address).
 * Keys share the store with rateLimit(); prefix them so they can't collide
 * with `${ip}:${bucket}` keys.
 *
 * @returns NextResponse (429, with Retry-After) if over limit, otherwise null
 */
export function rateLimitKey(
  key: string,
  options: { window: number; max: number },
): NextResponse | null {
  maybeCleanup();

  const storeKey = `key:${key}`;
  const now = Date.now();

  const win = store.get(storeKey);
  if (!win || now > win.resetAt) {
    store.set(storeKey, { count: 1, resetAt: now + options.window });
    return null;
  }

  win.count += 1;
  if (win.count > options.max) {
    const retryAfter = Math.ceil((win.resetAt - now) / 1000);
    return NextResponse.json(
      { error: 'Too many requests. Please try again shortly.' },
      {
        status: 429,
        headers: {
          'Retry-After': String(retryAfter),
          'X-RateLimit-Limit': String(options.max),
          'X-RateLimit-Remaining': '0',
        },
      },
    );
  }

  return null;
}

// Pre-configured limiters for common use cases
export const limits = {
  /** Public registration / volunteer signup: 8 per hour per IP */
  publicSignup: { window: 60 * 60_000, max: 8 },
  /** Score updates: 60 per minute per IP (interactive scoring) */
  scoring: { window: 60_000, max: 60 },
  /** Push subscribe: 10 per hour per IP */
  pushSubscribe: { window: 60 * 60_000, max: 10 },
  /**
   * Public detail reads (e.g. player profile lookup): 600 per minute per IP.
   * High on purpose: everyone at a venue usually shares one NAT IP on the club
   * Wi-Fi, so this only stops real scraping.
   */
  publicRead: { window: 60_000, max: 600 },
  /** AI chat: 30 per hour per IP — Anthropic API costs */
  ai: { window: 60 * 60_000, max: 30 },
};
