import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import { emailsMatch, escapeLikePattern, isUuid, normalizeEmail, sameText } from '../player-access';
import { PUBLIC_PLAYER_COLUMNS, type PublicPlayer } from '../supabase/types';

describe('normalizeEmail / emailsMatch', () => {
  it('trims and lowercases', () => {
    expect(normalizeEmail('  Player.One@Example.COM ')).toBe('player.one@example.com');
  });

  it.each([null, undefined, '', '   ', 42])('treats %s as no email', (v) => {
    expect(normalizeEmail(v)).toBeNull();
  });

  it('matches case- and whitespace-insensitively', () => {
    expect(emailsMatch('A@Example.com', ' a@example.com ')).toBe(true);
  });

  it('never matches when either side is empty', () => {
    expect(emailsMatch('', '')).toBe(false);
    expect(emailsMatch(null, null)).toBe(false);
    expect(emailsMatch('a@example.com', null)).toBe(false);
    expect(emailsMatch(undefined, 'a@example.com')).toBe(false);
  });

  it('does not match different addresses', () => {
    expect(emailsMatch('a@example.com', 'b@example.com')).toBe(false);
  });
});

describe('escapeLikePattern', () => {
  it('leaves plain text alone', () => {
    expect(escapeLikePattern('Alex Example')).toBe('Alex Example');
  });

  it('escapes SQL wildcards and the escape char', () => {
    expect(escapeLikePattern('100%_\\')).toBe('100\\%\\_\\\\');
  });

  it('turns PostgREST * into a single-char wildcard', () => {
    expect(escapeLikePattern('a*b')).toBe('a_b');
  });

  it('passes PostgREST filter syntax through as literal text (only for .ilike, never .or)', () => {
    expect(escapeLikePattern('x,name.ilike.*),or(id.neq.0')).toBe('x,name.ilike._),or(id.neq.0');
  });
});

describe('sameText', () => {
  it('compares trimmed, case-insensitive', () => {
    expect(sameText(' Alex Example', 'alex example ')).toBe(true);
    expect(sameText('Alex', 'Alexa')).toBe(false);
    expect(sameText(null, 'a')).toBe(false);
    expect(sameText('', '')).toBe(false);
  });
});

describe('isUuid', () => {
  it('accepts uuids and rejects others', () => {
    expect(isUuid('123e4567-e89b-12d3-a456-426614174000')).toBe(true);
    expect(isUuid('not-a-uuid')).toBe(false);
    expect(isUuid('123e4567-e89b-12d3-a456-426614174000,x')).toBe(false);
    expect(isUuid(undefined)).toBe(false);
  });
});

describe('PUBLIC_PLAYER_COLUMNS', () => {
  const cols = PUBLIC_PLAYER_COLUMNS.split(',').map((c) => c.trim());

  it('never includes private fields', () => {
    for (const col of ['email', 'phone', 'payment_status', 'stripe_session_id', 'gender', 'club_locker_id', '*']) {
      expect(cols).not.toContain(col);
    }
  });

  it('matches the PublicPlayer type keys', () => {
    // Compile-time: every key here must be a PublicPlayer key, and vice versa.
    const keys: Record<keyof PublicPlayer, true> = {
      id: true, tournament_id: true, name: true, first_name: true, last_name: true,
      seed: true, club: true, draw: true, created_at: true,
    };
    expect([...cols].sort()).toEqual(Object.keys(keys).sort());
  });

  it('matches the column grant in the lockdown migration', () => {
    const sql = readFileSync(
      path.resolve(__dirname, '../../../supabase/players-pii-lockdown-migration.sql'),
      'utf8',
    );
    const m = sql.match(/grant select \(([^)]+)\)\s+on public\.players to anon, authenticated/i);
    expect(m).not.toBeNull();
    const granted = m![1].split(',').map((c) => c.trim());
    expect([...granted].sort()).toEqual([...cols].sort());
  });
});
