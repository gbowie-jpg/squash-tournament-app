import { describe, it, expect } from 'vitest';
import { inviteTokenMatches } from '../invite-token';

const STORED = '0b0e4c7e-3f0a-4c55-9a43-2f5a3d9c1e7b';

describe('inviteTokenMatches', () => {
  it('matches the identical token', () => {
    expect(inviteTokenMatches(STORED, STORED)).toBe(true);
  });
  it('rejects a different token of the same length', () => {
    expect(inviteTokenMatches(STORED.replace(/.$/, 'c'), STORED)).toBe(false);
  });
  it('rejects a length mismatch without throwing', () => {
    expect(inviteTokenMatches(STORED.slice(0, -1), STORED)).toBe(false);
    expect(inviteTokenMatches(STORED + 'x', STORED)).toBe(false);
  });
  it('rejects when no token is stored', () => {
    expect(inviteTokenMatches(STORED, null)).toBe(false);
    expect(inviteTokenMatches(STORED, undefined)).toBe(false);
    expect(inviteTokenMatches('', '')).toBe(false);
  });
  it('rejects non-string input', () => {
    expect(inviteTokenMatches(undefined, STORED)).toBe(false);
    expect(inviteTokenMatches(123, STORED)).toBe(false);
    expect(inviteTokenMatches({ toString: () => STORED }, STORED)).toBe(false);
  });
  it('handles multibyte input whose byte length differs', () => {
    expect(inviteTokenMatches('é'.repeat(STORED.length), STORED)).toBe(false);
  });
});
