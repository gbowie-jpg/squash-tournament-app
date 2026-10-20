import { describe, it, expect } from 'vitest';
import webpush from 'web-push';
import { parse as legacyParse } from 'node:url';
import {
  checkVapidKeypair,
  isAllowedPushEndpoint,
  isValidSubscriptionKey,
  keyFingerprint,
  parseApplicationServerKey,
} from '../vapid';
import { classifyPushFailure, planPrunes, pushServiceOf, type PushSendResult } from '../push-prune';

// Fresh throwaway keys every run — never hardcode real keys in this public repo.
const pairA = webpush.generateVAPIDKeys();
const pairB = webpush.generateVAPIDKeys();

describe('checkVapidKeypair', () => {
  it('accepts a matching pair', () => {
    const r = checkVapidKeypair(pairA.publicKey, pairA.privateKey);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.publicKey).toBe(pairA.publicKey);
      expect(r.fingerprint).toBe(keyFingerprint(pairA.publicKey));
    }
  });

  it('trims surrounding whitespace (e.g. a trailing newline pasted into Vercel)', () => {
    const r = checkVapidKeypair(`  ${pairA.publicKey}\n`, `${pairA.privateKey}\n`);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.publicKey).toBe(pairA.publicKey);
  });

  it('rejects a mismatched pair', () => {
    expect(checkVapidKeypair(pairA.publicKey, pairB.privateKey)).toMatchObject({ ok: false, reason: 'mismatch' });
    expect(checkVapidKeypair(pairB.publicKey, pairA.privateKey)).toMatchObject({ ok: false, reason: 'mismatch' });
  });

  it('rejects missing keys', () => {
    expect(checkVapidKeypair(undefined, pairA.privateKey)).toMatchObject({ ok: false, reason: 'missing' });
    expect(checkVapidKeypair(pairA.publicKey, '')).toMatchObject({ ok: false, reason: 'missing' });
    expect(checkVapidKeypair('  ', null)).toMatchObject({ ok: false, reason: 'missing' });
  });

  it('rejects malformed keys without throwing', () => {
    expect(checkVapidKeypair('not-a-key', pairA.privateKey)).toMatchObject({ ok: false, reason: 'malformed_public' });
    expect(checkVapidKeypair(pairA.publicKey + '=', pairA.privateKey)).toMatchObject({ ok: false, reason: 'malformed_public' });
    expect(checkVapidKeypair(pairA.privateKey, pairA.privateKey)).toMatchObject({ ok: false, reason: 'malformed_public' });
    expect(checkVapidKeypair(pairA.publicKey, pairA.publicKey)).toMatchObject({ ok: false, reason: 'malformed_private' });
    expect(checkVapidKeypair(pairA.publicKey, 'x'.repeat(43) + '!')).toMatchObject({ ok: false, reason: 'malformed_private' });
    // All-zero scalar is not a valid P-256 private key.
    const zero = Buffer.alloc(32).toString('base64url');
    expect(checkVapidKeypair(pairA.publicKey, zero)).toMatchObject({ ok: false, reason: 'malformed_private' });
  });

  it('never exposes key material on failure', () => {
    const r = checkVapidKeypair(pairA.publicKey, pairB.privateKey);
    expect(JSON.stringify(r)).not.toContain(pairB.privateKey);
    expect(JSON.stringify(r)).not.toContain(pairA.publicKey);
  });
});

describe('parseApplicationServerKey', () => {
  it('accepts a base64url P-256 public key (trimmed)', () => {
    expect(parseApplicationServerKey(pairA.publicKey)).toBe(pairA.publicKey);
    expect(parseApplicationServerKey(` ${pairA.publicKey} `)).toBe(pairA.publicKey);
  });

  it.each([
    ['undefined', undefined],
    ['null', null],
    ['number', 42],
    ['object', { key: 'x' }],
    ['empty', ''],
    ['too short', 'BAAA'],
    ['too long', 'B'.repeat(200)],
    ['standard base64 chars', pairA.publicKey.slice(0, 85) + '+/'],
    ['padded', pairA.publicKey + '='],
    ['private key', pairA.privateKey],
  ])('rejects %s', (_label, value) => {
    expect(parseApplicationServerKey(value)).toBeNull();
  });

  it('rejects a 65-byte value that is not an uncompressed point', () => {
    const bytes = Buffer.from(pairA.publicKey, 'base64url');
    bytes[0] = 0x05;
    expect(parseApplicationServerKey(bytes.toString('base64url'))).toBeNull();
  });
});

describe('isValidSubscriptionKey', () => {
  it('accepts base64 and base64url', () => {
    expect(isValidSubscriptionKey('YWJjZA==', 64)).toBe(true);
    expect(isValidSubscriptionKey('ab+/cd', 64)).toBe(true);
    expect(isValidSubscriptionKey('ab-_cd', 64)).toBe(true);
  });
  it('rejects junk and over-length values', () => {
    expect(isValidSubscriptionKey('', 64)).toBe(false);
    expect(isValidSubscriptionKey(123, 64)).toBe(false);
    expect(isValidSubscriptionKey('a b', 64)).toBe(false);
    expect(isValidSubscriptionKey('a'.repeat(65), 64)).toBe(false);
  });
});

describe('isAllowedPushEndpoint', () => {
  it.each([
    'https://fcm.googleapis.com/fcm/send/abc123',
    'https://fcm.googleapis.com/wp/abc123',
    'https://updates.push.services.mozilla.com/wpush/v2/abc',
    'https://web.push.apple.com/QGx_abc',
    'https://api.push.apple.com/3/device/abc',
    'https://wns2-by3p.notify.windows.com/w/?token=abc',
    'https://FCM.GOOGLEAPIS.COM/fcm/send/abc',
  ])('accepts %s', (url) => expect(isAllowedPushEndpoint(url)).toBe(true));

  it.each([
    ['http scheme', 'http://fcm.googleapis.com/fcm/send/abc'],
    ['custom port', 'https://fcm.googleapis.com:8443/fcm/send/abc'],
    ['credentials', 'https://user:pw@fcm.googleapis.com/fcm/send/abc'],
    ['lookalike suffix', 'https://fcm.googleapis.com.evil.example/x'],
    ['lookalike prefix', 'https://evilfcm.googleapis.com/x'],
    ['bare suffix domain', 'https://push.apple.com/x'],
    ['bare WNS domain', 'https://notify.windows.com/x'],
    ['suffix without dot', 'https://evilnotify.windows.com/x'],
    ['localhost', 'https://localhost/x'],
    ['metadata IP', 'https://169.254.169.254/latest/meta-data'],
    ['revoked Chrome placeholder', 'https://permanently-removed.invalid/fcm/send/abc'],
    ['not a URL', 'fcm.googleapis.com/fcm/send/abc'],
    ['javascript', 'javascript:alert(1)'],
    ['non-string', 42],
    ['too long', 'https://fcm.googleapis.com/' + 'a'.repeat(3000)],
  ])('rejects %s', (_label, value) => expect(isAllowedPushEndpoint(value)).toBe(false));

  // WHATWG URL keeps these characters in the host (and decodes %3b), but the
  // legacy url.parse() that web-push uses to connect ends the host at them.
  it.each([
    'https://evil.example;.notify.windows.com/x',
    'https://169.254.169.254;.push.apple.com/x',
    'https://169.254.169.254;.push.apple.com/latest',
    'https://127.0.0.1;.push.services.mozilla.com/x',
    'https://evil.example%3b.push.services.mozilla.com/x',
    'https://evil.example%3b.push.apple.com/x',
    'https://localhost%21.push.apple.com/x',
    'https://a%2eb.push.apple.com/x',
    "https://evil.example'.push.apple.com/x",
    "https://evil.example'.notify.windows.com/x",
    'https://evil.example`.push.apple.com/x',
    'https://a`b.push.apple.com/x',
    'https://evil.example{.push.apple.com/x',
    'https://a{b.push.apple.com/x',
    'https://evil.example}.push.apple.com/x',
    'https://evil.example".push.apple.com/x',
    'https://a"b.push.apple.com/x',
    'https://web.push.apple.com\\@evil.com/x',
    ' https://web.push.apple.com/x',
    'https://web.push.apple.com',
    'https://fcm.googleapis.com/x","https://fcm.googleapis.com/y',
  ])('rejects parser-differential endpoint %s', (value) => expect(isAllowedPushEndpoint(value)).toBe(false));

  const realShaped = [
    'https://fcm.googleapis.com/fcm/send/dQw4w9WgXcQ:APA91bH-abc_123',
    'https://updates.push.services.mozilla.com/wpush/v2/gAAAAABk-abc_123',
    'https://web.push.apple.com/QGx_abc-123',
    'https://wns2-by3p.notify.windows.com/w/?token=BQYAAAB%2bAbC%2fdef%3d%3d',
  ];

  it.each(realShaped)('accepts real-shaped endpoint %s', (e) => expect(isAllowedPushEndpoint(e)).toBe(true));

  it.each(realShaped)('legacy url.parse and WHATWG agree on the host of %s', (e) => {
    expect(legacyParse(e).hostname).toBe(new URL(e).hostname);
  });
});

describe('classifyPushFailure', () => {
  it.each([
    [404, 'gone'],
    [410, 'gone'],
    [401, 'auth'],
    [403, 'auth'],
    [400, 'transient'],
    [413, 'transient'],
    [429, 'transient'],
    [500, 'transient'],
    [502, 'transient'],
    [503, 'transient'],
    [undefined, 'transient'], // network error / timeout
  ] as const)('%s → %s', (status, kind) => expect(classifyPushFailure(status)).toBe(kind));
});

describe('planPrunes', () => {
  const fcm = (id: string) => `https://fcm.googleapis.com/fcm/send/${id}`;
  const moz = (id: string) => `https://updates.push.services.mozilla.com/wpush/v2/${id}`;
  const wns = (region: string, id: string) => `https://${region}.notify.windows.com/w/?token=${id}`;

  it('always prunes 404/410 and keeps transient failures', () => {
    const results: PushSendResult[] = [
      { endpoint: fcm('gone404'), ok: false, statusCode: 404 },
      { endpoint: fcm('gone410'), ok: false, statusCode: 410 },
      { endpoint: fcm('rate'), ok: false, statusCode: 429 },
      { endpoint: fcm('down'), ok: false, statusCode: 503 },
      { endpoint: fcm('net'), ok: false },
    ];
    for (const keypairVerified of [true, false]) {
      expect(planPrunes(results, { keypairVerified })).toEqual({ prune: [fcm('gone404'), fcm('gone410')], authHeld: [] });
    }
  });

  it('prunes 401/403 when verified and the same service accepted another send', () => {
    const results: PushSendResult[] = [
      { endpoint: fcm('ok'), ok: true },
      { endpoint: fcm('forbidden'), ok: false, statusCode: 403 },
      { endpoint: fcm('unauth'), ok: false, statusCode: 401 },
    ];
    expect(planPrunes(results, { keypairVerified: true })).toEqual({
      prune: [fcm('forbidden'), fcm('unauth')],
      authHeld: [],
    });
  });

  it('never prunes 401/403 when the keypair is not verified', () => {
    const results: PushSendResult[] = [
      { endpoint: fcm('ok'), ok: true },
      { endpoint: fcm('forbidden'), ok: false, statusCode: 403 },
    ];
    expect(planPrunes(results, { keypairVerified: false })).toEqual({ prune: [], authHeld: [fcm('forbidden')] });
  });

  it('circuit breaker: keeps auth failures when no send to that service succeeded', () => {
    const results: PushSendResult[] = [
      { endpoint: fcm('a'), ok: false, statusCode: 403 },
      { endpoint: fcm('b'), ok: false, statusCode: 403 },
      { endpoint: moz('ok'), ok: true },
    ];
    expect(planPrunes(results, { keypairVerified: true })).toEqual({ prune: [], authHeld: [fcm('a'), fcm('b')] });
  });

  it('keeps a lone auth failure (nothing proves our credentials are accepted)', () => {
    expect(planPrunes([{ endpoint: fcm('only'), ok: false, statusCode: 403 }], { keypairVerified: true })).toEqual({
      prune: [],
      authHeld: [fcm('only')],
    });
  });

  it('groups regional WNS hosts as one service', () => {
    expect(pushServiceOf(wns('wns2-by3p', 'x'))).toBe(pushServiceOf(wns('wns2-db5p', 'y')));
    const results: PushSendResult[] = [
      { endpoint: wns('wns2-by3p', 'ok'), ok: true },
      { endpoint: wns('wns2-db5p', 'bad'), ok: false, statusCode: 403 },
    ];
    expect(planPrunes(results, { keypairVerified: true }).prune).toEqual([wns('wns2-db5p', 'bad')]);
  });

  it('gives a malformed host its own group so it cannot vouch for a real service', () => {
    const bad = 'https://evil.example%3b.push.apple.com/x';
    expect(pushServiceOf(bad)).toBe(bad);
    const results: PushSendResult[] = [
      { endpoint: bad, ok: true },
      { endpoint: 'https://web.push.apple.com/victim', ok: false, statusCode: 403 },
    ];
    expect(planPrunes(results, { keypairVerified: true }).prune).toEqual([]);
  });

  it('returns nothing for an empty batch', () => {
    expect(planPrunes([], { keypairVerified: true })).toEqual({ prune: [], authHeld: [] });
  });
});
