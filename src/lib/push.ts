import webpush from 'web-push';
import { createAdminClient } from '@/lib/supabase/admin';
import { checkVapidKeypair, isAllowedPushEndpoint, type VapidKeypairCheck } from '@/lib/vapid';
import { planPrunes, type PushSendResult } from '@/lib/push-prune';

const VAPID_SUBJECT = 'mailto:president@seattlesquash.com';

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  urgent?: boolean;
  tag?: string;
}

export interface PushResult {
  sent: number;
  failed: number;
  /** Rows not sent to: tagged with another VAPID key, or untagged (legacy). */
  skipped: number;
  pruned: number;
  error?: 'vapid_not_configured' | 'db_error' | 'unexpected';
}

type VapidState =
  | { ok: true; publicKey: string; fingerprint: string }
  | { ok: false; reason: string; fingerprint: string | null };

let vapidState: VapidState | null = null;

/**
 * Lazily validates and installs the VAPID keys on first send (not at module
 * load, so a bad env value can't break routes that merely import this file).
 * NEXT_PUBLIC_VAPID_PUBLIC_KEY is inlined at build time; VAPID_PRIVATE_KEY is
 * read at runtime. Logs only a fingerprint, never key material.
 */
function getVapidState(): VapidState {
  if (vapidState) return vapidState;

  const check: VapidKeypairCheck = checkVapidKeypair(
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  );
  if (!check.ok) {
    console.error(
      `[push] VAPID self-check failed (${check.reason}; public key fp ${check.fingerprint ?? 'none'}). ` +
        'No notifications will be sent and no subscriptions pruned. ' +
        'VAPID_PRIVATE_KEY must be the private half of NEXT_PUBLIC_VAPID_PUBLIC_KEY.',
    );
    return (vapidState = { ok: false, reason: check.reason, fingerprint: check.fingerprint });
  }

  try {
    webpush.setVapidDetails(VAPID_SUBJECT, check.publicKey, check.privateKey);
  } catch (err) {
    console.error('[push] web-push rejected the VAPID details:', (err as Error).message);
    return (vapidState = { ok: false, reason: 'setVapidDetails', fingerprint: check.fingerprint });
  }
  return (vapidState = { ok: true, publicKey: check.publicKey, fingerprint: check.fingerprint });
}

export type VapidStatus =
  | { ok: true; fingerprint: string }
  | { ok: false; reason: string; fingerprint: string | null };

/**
 * The same check the send path uses (keypair self-check + setVapidDetails),
 * reduced to non-secret fields: never returns key material.
 */
export function getVapidStatus(): VapidStatus {
  const v = getVapidState();
  return v.ok
    ? { ok: true, fingerprint: v.fingerprint }
    : { ok: false, reason: v.reason, fingerprint: v.fingerprint };
}

/**
 * Broadcast a push notification to every subscriber created under the
 * current VAPID public key. Rows tagged with another key (or untagged legacy
 * rows) are skipped, never deleted, so a deployment with a different keypair
 * (Preview, local dev, rollback) can't wipe them. Never throws.
 */
export async function sendPushToAll(payload: PushPayload): Promise<PushResult> {
  const result: PushResult = { sent: 0, failed: 0, skipped: 0, pruned: 0 };
  try {
    const vapid = getVapidState();
    if (!vapid.ok) return { ...result, error: 'vapid_not_configured' };

    const supabase = createAdminClient();
    const { data: rows, error } = await supabase
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth, vapid_public_key');
    if (error) {
      console.error('[push] could not load subscriptions:', error.message);
      return { ...result, error: 'db_error' };
    }
    if (!rows || rows.length === 0) return result;

    // Defense in depth: never send to a stored endpoint the subscribe route
    // would reject now (e.g. rows stored before the allowlist was tightened).
    // They are pruned below and kept out of planPrunes, so they can't count as
    // a successful send for any push service.
    const disallowed = rows.filter((r) => !isAllowedPushEndpoint(r.endpoint)).map((r) => r.endpoint);
    const allowedRows = rows.filter((r) => isAllowedPushEndpoint(r.endpoint));
    // One eq() per row: these strings are untrusted, and an in() list could be
    // broken out of by a stored '"' and match other rows.
    for (const endpoint of disallowed) {
      const { error: badDelError } = await supabase
        .from('push_subscriptions')
        .delete()
        .eq('endpoint', endpoint);
      if (badDelError) console.error('[push] prune of a disallowed endpoint failed:', badDelError.message);
      else result.pruned += 1;
    }
    if (disallowed.length > 0) {
      console.warn(`[push] found ${disallowed.length} subscription(s) with a disallowed endpoint (not sent to)`);
    }

    const targets = allowedRows.filter((r) => r.vapid_public_key === vapid.publicKey);
    result.skipped = allowedRows.length - targets.length;
    if (targets.length === 0) return result;

    const message = JSON.stringify({
      title: payload.title,
      body: payload.body,
      url: payload.url ?? '/',
      urgent: payload.urgent ?? false,
      tag: payload.tag ?? 'default',
    });

    const sendResults: PushSendResult[] = await Promise.all(
      targets.map(async (sub): Promise<PushSendResult> => {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            message,
            { timeout: 10_000 },
          );
          return { endpoint: sub.endpoint, ok: true };
        } catch (err: unknown) {
          const statusCode = (err as { statusCode?: number }).statusCode;
          let host = 'invalid-endpoint';
          try { host = new URL(sub.endpoint).host; } catch { /* keep placeholder */ }
          console.warn(`[push] send failed: status ${statusCode ?? 'none'} from ${host}`);
          return { endpoint: sub.endpoint, ok: false, statusCode };
        }
      }),
    );

    result.sent = sendResults.filter((r) => r.ok).length;
    result.failed = sendResults.length - result.sent;

    // Reaching this point means the keypair self-check passed.
    const plan = planPrunes(sendResults, { keypairVerified: true });
    if (plan.authHeld.length > 0) {
      console.error(
        `[push] ${plan.authHeld.length} subscription(s) rejected our VAPID auth and were kept: ` +
          `no send to the same push service succeeded, so the cause may be our credentials (fp ${vapid.fingerprint}).`,
      );
    }
    if (plan.prune.length > 0) {
      const { error: delError } = await supabase
        .from('push_subscriptions')
        .delete()
        .in('endpoint', plan.prune)
        .eq('vapid_public_key', vapid.publicKey);
      if (delError) console.error('[push] prune failed:', delError.message);
      else result.pruned += plan.prune.length;
    }
    return result;
  } catch (err) {
    console.error('[push] unexpected error:', (err as Error)?.message ?? err);
    return { ...result, error: 'unexpected' };
  }
}
