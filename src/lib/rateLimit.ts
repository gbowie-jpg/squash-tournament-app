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
 * @param options - window: milliseconds, max: requests allowed per window
 * @param suffix  - Optional string appended to the key (e.g. tournament id) to
 *                  prevent one heavy tournament from blocking another
 * @returns NextResponse (429) if over limit, otherwise null
 */
export function rateLimit(
  req: NextRequest,
  options: { window: number; max: number },
  suffix = '',
): NextResponse | null {
  maybeCleanup();

  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    req.headers.get('x-real-ip') ||
    'unknown';

  const path = new URL(req.url).pathname;
  const key = `${ip}:${path}${suffix ? ':' + suffix : ''}`;
  const now = Date.now();

  const win = store.get(key);
  if (!win || now > win.resetAt) {
    store.set(key, { count: 1, resetAt: now + options.window });
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
};
