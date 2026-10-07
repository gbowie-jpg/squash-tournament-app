import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { rateLimit, rateLimitKey } from '../rateLimit';

describe('rateLimitKey', () => {
  it('allows up to max, then 429s with Retry-After', () => {
    const opts = { window: 60_000, max: 3 };
    const key = `test-${Math.random()}`;
    expect(rateLimitKey(key, opts)).toBeNull();
    expect(rateLimitKey(key, opts)).toBeNull();
    expect(rateLimitKey(key, opts)).toBeNull();
    const res = rateLimitKey(key, opts);
    expect(res?.status).toBe(429);
    expect(Number(res?.headers.get('Retry-After'))).toBeGreaterThan(0);
  });

  it('keeps separate keys separate', () => {
    const opts = { window: 60_000, max: 1 };
    const a = `a-${Math.random()}`;
    const b = `b-${Math.random()}`;
    expect(rateLimitKey(a, opts)).toBeNull();
    expect(rateLimitKey(a, opts)?.status).toBe(429);
    expect(rateLimitKey(b, opts)).toBeNull();
  });
});

describe('rateLimit', () => {
  it('keys by IP + bucket + suffix', () => {
    const opts = { window: 60_000, max: 1, bucket: `bucket-${Math.random()}` };
    const req = (ip: string) =>
      new NextRequest('http://localhost/api/x', { headers: { 'x-forwarded-for': ip } });
    expect(rateLimit(req('10.0.0.1'), opts, 't1')).toBeNull();
    expect(rateLimit(req('10.0.0.1'), opts, 't1')?.status).toBe(429);
    expect(rateLimit(req('10.0.0.1'), opts, 't2')).toBeNull();
    expect(rateLimit(req('10.0.0.2'), opts, 't1')).toBeNull();
  });
});
