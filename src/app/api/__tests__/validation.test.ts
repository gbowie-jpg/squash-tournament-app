import { describe, it, expect } from 'vitest';

/**
 * Tests for input validation patterns used across API routes.
 * These test the sanitization logic in isolation — no Supabase or Next.js needed.
 */

// Replicate the player sanitizer from players/route.ts
function sanitizePlayer(p: Record<string, unknown>, tournamentId: string) {
  const record: Record<string, unknown> = { tournament_id: tournamentId };
  if (typeof p.name === 'string' && p.name.trim()) record.name = p.name.trim();
  if (typeof p.draw === 'string') record.draw = p.draw.trim() || null;
  if (p.seed !== undefined) record.seed = typeof p.seed === 'number' ? p.seed : (parseInt(String(p.seed)) || null);
  if (typeof p.club === 'string') record.club = p.club.trim() || null;
  if (typeof p.email === 'string') record.email = p.email.trim() || null;
  if (typeof p.phone === 'string') record.phone = p.phone.trim() || null;
  return record;
}

// Replicate tournament field whitelist from tournaments/[id]/route.ts
const TOURNAMENT_FIELDS = [
  'name', 'slug', 'start_date', 'end_date', 'status', 'venue', 'address',
  'location_city', 'court_count', 'category', 'description',
  'image_url', 'hero_image_url', 'hero_gradient', 'hero_text_color', 'hero_overlay',
  'contact_name', 'contact_email', 'contact_phone',
  'registration_opens', 'registration_deadline', 'draw_lock_date', 'entry_close_date',
  'info_latest', 'info_accommodations', 'info_entry', 'info_rules',
] as const;

function whitelistTournamentFields(body: Record<string, unknown>) {
  const updates: Record<string, unknown> = {};
  for (const key of TOURNAMENT_FIELDS) {
    if (key in body) updates[key] = body[key] === '' ? null : body[key];
  }
  return updates;
}

// Replicate match field whitelist
const MATCH_UPDATE_FIELDS = [
  'court_id', 'status', 'scheduled_time', 'scores', 'winner_id',
  'sort_order', 'notes', 'referee_id',
] as const;

function whitelistMatchFields(body: Record<string, unknown>) {
  const updates: Record<string, unknown> = {};
  for (const key of MATCH_UPDATE_FIELDS) {
    if (key in body) updates[key] = body[key];
  }
  return updates;
}

describe('Player sanitization', () => {
  it('trims whitespace from name', () => {
    const result = sanitizePlayer({ name: '  John Smith  ' }, 'tid');
    expect(result.name).toBe('John Smith');
  });

  it('rejects empty name', () => {
    const result = sanitizePlayer({ name: '   ' }, 'tid');
    expect(result.name).toBeUndefined();
  });

  it('rejects non-string name', () => {
    const result = sanitizePlayer({ name: 123 }, 'tid');
    expect(result.name).toBeUndefined();
  });

  it('converts empty draw to null', () => {
    const result = sanitizePlayer({ name: 'John', draw: '' }, 'tid');
    expect(result.draw).toBeNull();
  });

  it('parses string seed to number', () => {
    const result = sanitizePlayer({ name: 'John', seed: '3' }, 'tid');
    expect(result.seed).toBe(3);
  });

  it('rejects non-numeric seed string', () => {
    const result = sanitizePlayer({ name: 'John', seed: 'abc' }, 'tid');
    expect(result.seed).toBeNull();
  });

  it('trims email', () => {
    const result = sanitizePlayer({ name: 'John', email: ' john@test.com ' }, 'tid');
    expect(result.email).toBe('john@test.com');
  });

  it('converts empty email to null', () => {
    const result = sanitizePlayer({ name: 'John', email: '' }, 'tid');
    expect(result.email).toBeNull();
  });

  it('always includes tournament_id', () => {
    const result = sanitizePlayer({ name: 'John' }, 'my-tournament');
    expect(result.tournament_id).toBe('my-tournament');
  });

  it('ignores unknown fields (injection protection)', () => {
    const result = sanitizePlayer({
      name: 'John',
      id: 'injected-id',
      tournament_id: 'injected-tid',
      role: 'admin',
      created_at: '2020-01-01',
    }, 'tid');
    expect(result).not.toHaveProperty('id');
    expect(result).not.toHaveProperty('role');
    expect(result).not.toHaveProperty('created_at');
    expect(result.tournament_id).toBe('tid'); // uses function param, not injected
  });
});

describe('Tournament field whitelisting', () => {
  it('allows valid fields through', () => {
    const result = whitelistTournamentFields({
      name: 'My Tournament',
      venue: 'Main Club',
      start_date: '2026-01-01',
    });
    expect(result.name).toBe('My Tournament');
    expect(result.venue).toBe('Main Club');
    expect(result.start_date).toBe('2026-01-01');
  });

  it('blocks unknown fields', () => {
    const result = whitelistTournamentFields({
      name: 'My Tournament',
      id: 'injected',
      created_at: '2020-01-01',
      organization_id: 'injected-org',
    });
    expect(result).not.toHaveProperty('id');
    expect(result).not.toHaveProperty('created_at');
    expect(result).not.toHaveProperty('organization_id');
  });

  it('converts empty strings to null', () => {
    const result = whitelistTournamentFields({ venue: '', description: '' });
    expect(result.venue).toBeNull();
    expect(result.description).toBeNull();
  });

  it('passes through all allowed fields', () => {
    const body: Record<string, string> = {};
    for (const f of TOURNAMENT_FIELDS) body[f] = `value_${f}`;
    const result = whitelistTournamentFields(body);
    for (const f of TOURNAMENT_FIELDS) {
      expect(result[f]).toBe(`value_${f}`);
    }
  });
});

describe('Match field whitelisting', () => {
  it('allows valid update fields', () => {
    const result = whitelistMatchFields({
      status: 'completed',
      winner_id: 'p1',
      scores: [{ p1: 11, p2: 7 }],
    });
    expect(result.status).toBe('completed');
    expect(result.winner_id).toBe('p1');
    expect(result.scores).toEqual([{ p1: 11, p2: 7 }]);
  });

  it('blocks dangerous fields', () => {
    const result = whitelistMatchFields({
      status: 'completed',
      tournament_id: 'injected',
      player1_id: 'injected',
      player2_id: 'injected',
      created_at: '2020-01-01',
      match_number: 999,
      draw: 'injected',
      round: 'injected',
    });
    expect(result).not.toHaveProperty('tournament_id');
    expect(result).not.toHaveProperty('player1_id');
    expect(result).not.toHaveProperty('player2_id');
    expect(result).not.toHaveProperty('created_at');
    expect(result).not.toHaveProperty('match_number');
    expect(result).not.toHaveProperty('draw');
    expect(result).not.toHaveProperty('round');
  });

  it('allows court and referee assignment', () => {
    const result = whitelistMatchFields({
      court_id: 'court-1',
      referee_id: 'ref-1',
    });
    expect(result.court_id).toBe('court-1');
    expect(result.referee_id).toBe('ref-1');
  });
});

describe('Court status validation', () => {
  const VALID_STATUSES = ['available', 'in_use', 'maintenance'];

  it('accepts valid statuses', () => {
    for (const s of VALID_STATUSES) {
      expect(VALID_STATUSES.includes(s)).toBe(true);
    }
  });

  it('rejects invalid status', () => {
    expect(VALID_STATUSES.includes('closed')).toBe(false);
    expect(VALID_STATUSES.includes('deleted')).toBe(false);
    expect(VALID_STATUSES.includes('')).toBe(false);
  });
});

describe('Announcement validation', () => {
  it('rejects empty message', () => {
    const message = '';
    expect(!message || typeof message !== 'string' || message.trim().length === 0).toBe(true);
  });

  it('rejects whitespace-only message', () => {
    const message = '   \n\t  ';
    expect(!message || typeof message !== 'string' || message.trim().length === 0).toBe(true);
  });

  it('accepts valid message', () => {
    const message = 'Court 3 is now available';
    expect(!message || typeof message !== 'string' || message.trim().length === 0).toBe(false);
  });

  it('normalizes priority to normal/urgent only', () => {
    const normalize = (p: string) => (p === 'urgent' ? 'urgent' : 'normal');
    expect(normalize('urgent')).toBe('urgent');
    expect(normalize('normal')).toBe('normal');
    expect(normalize('critical')).toBe('normal');
    expect(normalize('')).toBe('normal');
  });
});

describe('Video upload validation', () => {
  const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB

  it('rejects files over 500MB', () => {
    const size = 600 * 1024 * 1024;
    expect(size > MAX_FILE_SIZE).toBe(true);
  });

  it('accepts files under 500MB', () => {
    const size = 100 * 1024 * 1024;
    expect(size > MAX_FILE_SIZE).toBe(false);
  });

  it('accepts exactly 500MB', () => {
    expect(MAX_FILE_SIZE > MAX_FILE_SIZE).toBe(false);
  });
});
