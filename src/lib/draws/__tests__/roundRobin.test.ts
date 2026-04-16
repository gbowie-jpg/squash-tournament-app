import { describe, it, expect } from 'vitest';
import { generateRoundRobin } from '../roundRobin';
import type { PlayerInput } from '../types';

function makePlayers(count: number): PlayerInput[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `p${i + 1}`,
    name: `Player ${i + 1}`,
    seed: null,
    draw: 'RR Pool A',
  }));
}

describe('generateRoundRobin', () => {
  it('throws with fewer than 2 players', () => {
    expect(() => generateRoundRobin([makePlayers(1)[0]], 'A')).toThrow(
      'Need at least 2 players',
    );
  });

  it('generates 1 match for 2 players', () => {
    const result = generateRoundRobin(makePlayers(2), 'A');
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0].player1_id).toBe('p1');
    expect(result.matches[0].player2_id).toBe('p2');
  });

  it('generates correct match count for 4 players', () => {
    const result = generateRoundRobin(makePlayers(4), 'A');
    // 4 players: each plays 3 others = 4*3/2 = 6 matches
    expect(result.matches).toHaveLength(6);
  });

  it('generates correct match count for 3 players', () => {
    const result = generateRoundRobin(makePlayers(3), 'A');
    // 3 players: 3*2/2 = 3 matches
    expect(result.matches).toHaveLength(3);
  });

  it('generates correct match count for 5 players', () => {
    const result = generateRoundRobin(makePlayers(5), 'A');
    // 5 players: 5*4/2 = 10 matches
    expect(result.matches).toHaveLength(10);
  });

  it('every player plays every other player exactly once', () => {
    const players = makePlayers(5);
    const result = generateRoundRobin(players, 'A');

    // Build matchup matrix
    const matchups = new Set<string>();
    for (const m of result.matches) {
      const pair = [m.player1_id, m.player2_id].sort().join('-');
      expect(matchups.has(pair)).toBe(false); // no duplicate matchups
      matchups.add(pair);
    }

    // Every pair should exist
    for (let i = 0; i < players.length; i++) {
      for (let j = i + 1; j < players.length; j++) {
        const pair = [players[i].id, players[j].id].sort().join('-');
        expect(matchups.has(pair)).toBe(true);
      }
    }
  });

  it('all matches are scheduled (no walkovers)', () => {
    const result = generateRoundRobin(makePlayers(6), 'A');
    for (const m of result.matches) {
      expect(m.status).toBe('scheduled');
      expect(m.winner_id).toBeNull();
    }
  });

  it('has no progression rules', () => {
    const result = generateRoundRobin(makePlayers(4), 'A');
    expect(result.progressionRules).toHaveLength(0);
  });

  it('assigns unique match numbers', () => {
    const result = generateRoundRobin(makePlayers(6), 'A');
    const numbers = result.matches.map((m) => m.match_number);
    const unique = new Set(numbers);
    expect(unique.size).toBe(numbers.length);
  });

  it('assigns correct draw name', () => {
    const result = generateRoundRobin(makePlayers(4), 'Pool B');
    for (const m of result.matches) {
      expect(m.draw).toBe('Pool B');
    }
  });

  it('round names follow RR pattern', () => {
    const result = generateRoundRobin(makePlayers(4), 'A');
    const rounds = new Set(result.matches.map((m) => m.round));
    for (const r of rounds) {
      expect(r).toMatch(/^RR\d+$/);
    }
  });
});
