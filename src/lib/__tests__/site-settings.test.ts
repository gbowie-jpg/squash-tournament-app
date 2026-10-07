import { describe, it, expect } from 'vitest';
import {
  PUBLIC_SETTING_KEYS,
  WRITE_ONLY_SETTING_KEYS,
  HOMEPAGE_SETTING_KEYS,
  SCHOLARSHIP_SETTING_KEYS,
  EMAIL_TEMPLATE_SETTING_KEYS,
  isPublicSettingKey,
  isWritableSettingKey,
  validateSettingsPatch,
} from '../site-settings';

describe('site settings key lists', () => {
  it('never exposes or accepts invite_token', () => {
    expect(isPublicSettingKey('invite_token')).toBe(false);
    expect(isWritableSettingKey('invite_token')).toBe(false);
  });

  it('keeps Stripe secrets write-only', () => {
    for (const key of WRITE_ONLY_SETTING_KEYS) {
      expect(isPublicSettingKey(key)).toBe(false);
      expect(isWritableSettingKey(key)).toBe(true);
    }
    expect(isPublicSettingKey('stripe_publishable_key')).toBe(true);
  });

  it('has no overlap between public and write-only keys', () => {
    const pub = new Set<string>(PUBLIC_SETTING_KEYS);
    for (const key of WRITE_ONLY_SETTING_KEYS) expect(pub.has(key)).toBe(false);
  });

  it('includes every homepage, scholarship and email template key in the public list', () => {
    for (const key of [...HOMEPAGE_SETTING_KEYS, ...SCHOLARSHIP_SETTING_KEYS, ...EMAIL_TEMPLATE_SETTING_KEYS]) {
      expect(isPublicSettingKey(key)).toBe(true);
    }
    expect(isPublicSettingKey('sponsor_splash_duration_ms')).toBe(true);
  });

  it('has no secret-looking keys in the public list', () => {
    for (const key of PUBLIC_SETTING_KEYS) {
      expect(key).not.toMatch(/secret|private|webhook|token/i);
    }
  });
});

describe('validateSettingsPatch', () => {
  it('accepts known keys with string/null values and converts "" to null', () => {
    const result = validateSettingsPatch({
      homepage_hero_title: 'Hello',
      homepage_hero_image: '',
      stripe_secret_key: 'sk_test_x',
      email_footer_text: null,
    });
    expect(result).toEqual({
      ok: true,
      values: {
        homepage_hero_title: 'Hello',
        homepage_hero_image: null,
        stripe_secret_key: 'sk_test_x',
        email_footer_text: null,
      },
    });
  });

  it('rejects invite_token', () => {
    const result = validateSettingsPatch({ invite_token: 'abc' });
    expect(result.ok).toBe(false);
  });

  it('rejects unknown keys even alongside known ones', () => {
    const result = validateSettingsPatch({ homepage_hero_title: 'x', foo: 'bar' });
    expect(result.ok).toBe(false);
  });

  it.each([
    ['number', { sponsor_splash_duration_ms: 3000 }],
    ['boolean', { scholarship_open: true }],
    ['object', { homepage_hero_title: { a: 1 } }],
    ['array value', { homepage_hero_title: ['x'] }],
  ])('rejects non-string value (%s)', (_label, body) => {
    expect(validateSettingsPatch(body).ok).toBe(false);
  });

  it.each([
    ['null', null],
    ['array', [['homepage_hero_title', 'x']]],
    ['string', 'homepage_hero_title'],
    ['number', 1],
    ['empty object', {}],
  ])('rejects non-object / empty body (%s)', (_label, body) => {
    expect(validateSettingsPatch(body).ok).toBe(false);
  });

  it('rejects __proto__ smuggling', () => {
    const body = JSON.parse('{"__proto__": {"x": 1}, "homepage_hero_title": "x"}');
    expect(validateSettingsPatch(body).ok).toBe(false);
  });
});
