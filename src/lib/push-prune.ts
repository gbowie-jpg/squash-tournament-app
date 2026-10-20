// Pure prune decisions for push send results. No Supabase / web-push imports.
import { LDH_HOST_RE } from './vapid';

/** What the sender learned from one push-service response. */
export type PushFailureKind =
  /** 404/410: the subscription no longer exists. */
  | 'gone'
  /** 401/403: the push service rejected our VAPID auth for this subscription. */
  | 'auth'
  /** Anything else (400, 413, 429, 5xx, network error, timeout): try again next time. */
  | 'transient';

export function classifyPushFailure(statusCode: number | undefined): PushFailureKind {
  if (statusCode === 404 || statusCode === 410) return 'gone';
  if (statusCode === 401 || statusCode === 403) return 'auth';
  return 'transient';
}

export type PushSendResult =
  | { endpoint: string; ok: true }
  | { endpoint: string; ok: false; statusCode?: number };

export interface PrunePlan {
  /** Endpoints to delete. */
  prune: string[];
  /** Auth-rejected endpoints kept because pruning them wasn't proven safe. */
  authHeld: string[];
}

const SERVICE_DOMAINS = ['push.services.mozilla.com', 'push.apple.com', 'notify.windows.com'];

/** Groups endpoints by push service (WNS / Apple use per-region subdomains). */
export function pushServiceOf(endpoint: string): string {
  let host: string;
  try {
    host = new URL(endpoint).hostname.toLowerCase();
  } catch {
    return endpoint;
  }
  // A malformed host gets its own group, so it can never vouch for a real service.
  if (!LDH_HOST_RE.test(host)) return endpoint;
  return SERVICE_DOMAINS.find((d) => host === d || host.endsWith('.' + d)) ?? host;
}

/**
 * Decide which subscriptions to delete after a send.
 *
 * - gone (404/410): always prune.
 * - auth (401/403): prune only if the keypair self-check passed AND at least
 *   one other send to the same push service in this batch succeeded. The
 *   second condition is a circuit breaker: if a service rejects every one of
 *   our requests, the problem is our JWT/credentials (or the service), not the
 *   subscriptions, so nothing is deleted.
 * - transient: keep.
 */
export function planPrunes(results: PushSendResult[], opts: { keypairVerified: boolean }): PrunePlan {
  const okServices = new Set(results.filter((r) => r.ok).map((r) => pushServiceOf(r.endpoint)));
  const prune: string[] = [];
  const authHeld: string[] = [];

  for (const r of results) {
    if (r.ok) continue;
    const kind = classifyPushFailure(r.statusCode);
    if (kind === 'gone') {
      prune.push(r.endpoint);
    } else if (kind === 'auth') {
      if (opts.keypairVerified && okServices.has(pushServiceOf(r.endpoint))) prune.push(r.endpoint);
      else authHeld.push(r.endpoint);
    }
  }
  return { prune, authHeld };
}
