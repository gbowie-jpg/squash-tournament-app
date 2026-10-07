import { describe, it, expect } from 'vitest';
import { MIN_PASSWORD_LENGTH, MAX_PASSWORD_LENGTH, validateNewPassword } from '../password-rules';

describe('validateNewPassword', () => {
  it('accepts a matching password of valid length', () => {
    expect(validateNewPassword('secret1', 'secret1')).toBeNull();
    const min = 'a'.repeat(MIN_PASSWORD_LENGTH);
    expect(validateNewPassword(min, min)).toBeNull();
    const max = 'a'.repeat(MAX_PASSWORD_LENGTH);
    expect(validateNewPassword(max, max)).toBeNull();
  });

  it('rejects short passwords', () => {
    const short = 'a'.repeat(MIN_PASSWORD_LENGTH - 1);
    expect(validateNewPassword(short, short)).toMatch(/at least/);
  });

  it('rejects passwords over the bcrypt byte limit', () => {
    const long = 'a'.repeat(MAX_PASSWORD_LENGTH + 1);
    expect(validateNewPassword(long, long)).toMatch(/at most/);
    // 25 three-byte characters = 75 bytes
    const multibyte = '€'.repeat(25);
    expect(validateNewPassword(multibyte, multibyte)).toMatch(/at most/);
  });

  it('rejects mismatched confirmation', () => {
    expect(validateNewPassword('secret1', 'secret2')).toBe('Passwords do not match.');
  });
});
