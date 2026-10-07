import { describe, it, expect } from 'vitest';
import { isSafeRelativePath, safeRelativePath } from '../safe-redirect';

describe('isSafeRelativePath', () => {
  it.each(['/', '/admin', '/t/spring-open/match/abc/score', '/account?tab=profile', '/a#b'])(
    'accepts %s',
    (p) => expect(isSafeRelativePath(p)).toBe(true),
  );

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['empty', ''],
    ['absolute URL', 'https://evil.example'],
    ['protocol-relative', '//evil.example'],
    ['backslash trick', '/\\evil.example'],
    ['leading backslash', '\\\\evil.example'],
    ['javascript scheme', 'javascript:alert(1)'],
    ['colon in path', '/foo:bar'],
    ['relative without slash', 'admin'],
    ['tab smuggling', '/\t/evil.example'],
    ['newline smuggling', '/\n/evil.example'],
    ['null byte', '/\u0000'],
  ])('rejects %s', (_label, p) => expect(isSafeRelativePath(p)).toBe(false));
});

describe('safeRelativePath', () => {
  it('returns the value when safe', () => {
    expect(safeRelativePath('/account', '/')).toBe('/account');
  });
  it('falls back when unsafe or missing', () => {
    expect(safeRelativePath('//evil.example', '/')).toBe('/');
    expect(safeRelativePath(null, '/admin')).toBe('/admin');
  });
  it('defaults the fallback to /', () => {
    expect(safeRelativePath('https://evil.example')).toBe('/');
  });
});
