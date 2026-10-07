import { describe, it, expect } from 'vitest';
import {
  AUTH_ERROR_MESSAGES,
  authErrorMessage,
  authErrorCodeFor,
  isAllowedOtpType,
  postConfirmPath,
} from '../auth-errors';

describe('authErrorMessage', () => {
  it.each(Object.keys(AUTH_ERROR_MESSAGES))('maps known code %s to fixed copy', (code) => {
    expect(authErrorMessage(code)).toBe(AUTH_ERROR_MESSAGES[code as keyof typeof AUTH_ERROR_MESSAGES]);
  });

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['empty', ''],
    ['free text', 'Your account is locked. Call 555-0100 to unlock it.'],
    ['prototype key', 'toString'],
    ['proto', '__proto__'],
    ['case variant', 'LINK_EXPIRED'],
  ])('ignores %s', (_label, value) => {
    expect(authErrorMessage(value as string | null | undefined)).toBeNull();
  });
});

describe('authErrorCodeFor', () => {
  it('maps expiry codes to link_expired', () => {
    expect(authErrorCodeFor('otp_expired')).toBe('link_expired');
    expect(authErrorCodeFor('flow_state_expired')).toBe('link_expired');
    expect(authErrorCodeFor('flow_state_not_found')).toBe('link_expired');
  });

  it('maps everything else to confirm_failed', () => {
    expect(authErrorCodeFor('bad_code_verifier')).toBe('confirm_failed');
    expect(authErrorCodeFor(undefined)).toBe('confirm_failed');
    expect(authErrorCodeFor(null)).toBe('confirm_failed');
  });
});

describe('isAllowedOtpType', () => {
  it.each(['signup', 'invite', 'magiclink', 'recovery', 'email'])('accepts %s', (t) => {
    expect(isAllowedOtpType(t)).toBe(true);
  });
  it.each([null, undefined, '', 'email_change', 'SIGNUP', 'sms', 42])('rejects %s', (t) => {
    expect(isAllowedOtpType(t)).toBe(false);
  });
});

describe('postConfirmPath', () => {
  it('always sends new accounts to set-password, ignoring next', () => {
    expect(postConfirmPath('signup', '/admin')).toBe('/account/set-password');
    expect(postConfirmPath('invite', null)).toBe('/account/set-password');
  });

  it('honours a safe next for other types', () => {
    expect(postConfirmPath('magiclink', '/t/spring-open')).toBe('/t/spring-open');
    expect(postConfirmPath('recovery', '/account/reset-password')).toBe('/account/reset-password');
  });

  it('falls back to / for unsafe or missing next', () => {
    expect(postConfirmPath('email', 'https://evil.example')).toBe('/');
    expect(postConfirmPath('email', '//evil.example')).toBe('/');
    expect(postConfirmPath('magiclink', undefined)).toBe('/');
  });
});
