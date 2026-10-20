// Pure VAPID / push-subscription helpers. No Supabase or web-push imports, so
// tests (and the subscribe route) can use them without side effects.
import { createECDH, createHash } from 'node:crypto';
import { parse as legacyParse } from 'node:url';

const BASE64URL_RE = /^[A-Za-z0-9_-]+$/;
// p256dh / auth arrive as standard base64 (PushManager uses btoa) or base64url
// (service worker / toJSON). web-push decodes both.
const BASE64_ANY_RE = /^[A-Za-z0-9+/_-]+={0,2}$/;

/** Uncompressed P-256 public key: 65 bytes = 87 base64url chars, no padding. */
const PUBLIC_KEY_BYTES = 65;
const PRIVATE_KEY_BYTES = 32;

function decodeBase64url(value: string): Buffer | null {
  if (!BASE64URL_RE.test(value)) return null;
  return Buffer.from(value, 'base64url');
}

/**
 * Validates the applicationServerKey a browser says it subscribed with.
 * Returns the trimmed key, or null if it isn't a base64url-encoded
 * uncompressed P-256 public key.
 */
export function parseApplicationServerKey(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const key = value.trim();
  if (key.length < 80 || key.length > 100) return null;
  const bytes = decodeBase64url(key);
  if (!bytes || bytes.length !== PUBLIC_KEY_BYTES || bytes[0] !== 0x04) return null;
  return key;
}

/** Validates a p256dh / auth subscription key (base64 or base64url, bounded length). */
export function isValidSubscriptionKey(value: unknown, maxLength: number): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= maxLength && BASE64_ANY_RE.test(value);
}

/**
 * Hosts of mainstream browser push services. A suffix entry ('.x.com') matches
 * subdomains only; a bare entry matches exactly.
 *  - Chrome / Edge (Chromium) / Opera / Samsung Internet / Brave: FCM
 *  - Firefox: Mozilla autopush
 *  - Safari (macOS 13+, iOS 16.4+): Apple (web.push.apple.com)
 *  - Windows (WNS, e.g. wns2-*.notify.windows.com)
 */
const PUSH_HOSTS_EXACT = ['fcm.googleapis.com', 'updates.push.services.mozilla.com', 'web.push.apple.com'];
const PUSH_HOST_SUFFIXES = ['.push.services.mozilla.com', '.push.apple.com', '.notify.windows.com'];

const MAX_ENDPOINT_LENGTH = 2048;

/** Plain DNS (letters-digits-hyphen) hostname with at least one dot. */
export const LDH_HOST_RE = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/;
/**
 * RFC 3986 URI characters only (no whitespace, '"', backslash, '`', '{', '}', '<', '>',
 * '^', '|'). Besides blocking parser tricks, this keeps a stored endpoint safe
 * to use in a PostgREST in.("…") filter, where a '"' could end the quoted value.
 */
const URI_CHARS_RE = /^[A-Za-z0-9\-._~:/?#[\]@!$&'()*+,;=%]+$/;

/**
 * True only for https endpoints on a known browser push service (default port,
 * no credentials). Anything else is rejected so the server never POSTs to an
 * attacker-chosen URL (SSRF).
 */
export function isAllowedPushEndpoint(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > MAX_ENDPOINT_LENGTH) return false;
  if (!URI_CHARS_RE.test(value)) return false;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:' || url.port !== '' || url.username || url.password) return false;
  const host = url.hostname.toLowerCase();
  // web-push re-parses the endpoint with legacy url.parse() (connect host and
  // JWT audience), which ends the host at ; ' " ` { } % etc. while WHATWG keeps
  // them (and decodes %3b). Require a plain LDH host, spelled literally in the
  // raw string, that both parsers agree on.
  if (!LDH_HOST_RE.test(host)) return false;
  if (!value.toLowerCase().startsWith(`https://${host}/`)) return false;
  let legacyHost: string | null | undefined;
  try {
    legacyHost = legacyParse(value).hostname;
  } catch {
    return false;
  }
  if (legacyHost !== host) return false;
  if (PUSH_HOSTS_EXACT.includes(host)) return true;
  return PUSH_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix) && host.length > suffix.length);
}

/** Short, non-secret identifier for a public key, safe to log. */
export function keyFingerprint(publicKey: string): string {
  return createHash('sha256').update(publicKey).digest('hex').slice(0, 12);
}

export type VapidKeypairCheck =
  | { ok: true; publicKey: string; privateKey: string; fingerprint: string }
  | { ok: false; reason: 'missing' | 'malformed_public' | 'malformed_private' | 'mismatch'; fingerprint: string | null };

/**
 * Self-check: derive the public key from the private key (P-256 ECDH) and
 * compare bytes with the configured public key. Never throws, never returns
 * or logs key material other than the trimmed inputs on success.
 */
export function checkVapidKeypair(
  publicKeyRaw: string | null | undefined,
  privateKeyRaw: string | null | undefined,
): VapidKeypairCheck {
  const publicKey = (publicKeyRaw ?? '').trim();
  const privateKey = (privateKeyRaw ?? '').trim();
  const fingerprint = publicKey ? keyFingerprint(publicKey) : null;
  if (!publicKey || !privateKey) return { ok: false, reason: 'missing', fingerprint };

  const pub = decodeBase64url(publicKey);
  if (!pub || pub.length !== PUBLIC_KEY_BYTES || pub[0] !== 0x04) {
    return { ok: false, reason: 'malformed_public', fingerprint };
  }
  const priv = decodeBase64url(privateKey);
  if (!priv || priv.length !== PRIVATE_KEY_BYTES) {
    return { ok: false, reason: 'malformed_private', fingerprint };
  }

  let derived: Buffer;
  try {
    const ecdh = createECDH('prime256v1');
    ecdh.setPrivateKey(priv); // throws for an out-of-range scalar
    derived = ecdh.getPublicKey(); // 65-byte uncompressed point
  } catch {
    return { ok: false, reason: 'malformed_private', fingerprint };
  }

  if (!derived.equals(pub)) return { ok: false, reason: 'mismatch', fingerprint };
  return { ok: true, publicKey, privateKey, fingerprint: fingerprint! };
}
