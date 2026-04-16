import { describe, it, expect } from 'vitest';
import { generateSingleElimination } from '../singleElimination';
import type { PlayerInput } from '../types';

function makePlayers(count: number, seeds?: number[]): PlayerInput[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `p${i + 1}`,
    name: `Player ${i + 1}`,
    seed: seeds && seeds[i] !== undefined ? seeds[i] : null,
    draw: 'Open',
  }));
}

describe('generateSingleElimination', () => {
  it('throws with fewer than 2 players', () => {
    expect(() => generateSingleElimination([makePlayers(1)[0]], 'Open')).toThrow(
      'Need at least 2 players',
    );
  });

  it('generates 1 match for 2 players', () => {
    const result = generateSingleElimination(makePlayers(2, [1, 2]), 'Open');
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0].round).toBe('F');
    expect(result.matches[0].status).toBe('scheduled');
    expect(result.matches[0].player1_id).toBeTruthy();
    expect(result.matches[0].player2_id).toBeTruthy();
  });

  it('generates correct bracket for 4 seeded players', () => {
    const result = generateSingleElimination(makePlayers(4, [1, 2, 3, 4]), 'Open');
    // 4 players = 2 SF + 1 F = 3 matches
    expect(result.matches).toHaveLength(3);

    const rounds = result.matches.map((m) => m.round);
    expect(rounds.filter((r) => r === 'SF')).toHaveLength(2);
    expect(rounds.filter((r) => r === 'F')).toHaveLength(1);

    // No walkovers with exact power-of-2 players
    expect(result.matches.filter((m) => m.status === 'walkover')).toHaveLength(0);

    // Seed 1 should not face seed 2 in SF (standard seeding)
    const sf1 = result.matches[0]; // first SF
    const sf2 = result.matches[1]; // second SF
    const seed1Match = [sf1, sf2].find(
      (m) => m.player1_id === 'p1' || m.player2_id === 'p1',
    );
    const seed2Match = [sf1, sf2].find(
      (m) => m.player1_id === 'p2' || m.player2_id === 'p2',
    );
    // Seed 1 and seed 2 should be in different halves
    expect(seed1Match).not.toBe(seed2Match);
  });

  it('generates byes for 3 players (non-power-of-2)', () => {
    const result = generateSingleElimination(makePlayers(3, [1, 2, 3]), 'Open');
    // 3 players → bracket size 4 → 2 R1 + 1 F = 3 matches
    expect(result.matches).toHaveLength(3);

    const walkovers = result.matches.filter((m) => m.status === 'walkover');
    expect(walkovers.length).toBeGreaterThanOrEqual(1);

    // Walkover match should have a winner
    for (const w of walkovers) {
      expect(w.winner_id).toBeTruthy();
    }
  });

  it('auto-advances bye winners to next round', () => {
    const result = generateSingleElimination(makePlayers(3, [1, 2, 3]), 'Open');

    // The final should have at least one player already populated from bye advancement
    const finalMatch = result.matches.find((m) => m.round === 'F');
    expect(finalMatch).toBeTruthy();
    const populated = [finalMatch!.player1_id, finalMatch!.player2_id].filter(Boolean);
    expect(populated.length).toBeGreaterThanOrEqual(1);
  });

  it('generates 8-player bracket correctly', () => {
    const result = generateSingleElimination(makePlayers(8, [1, 2, 3, 4, 5, 6, 7, 8]), 'Open');
    // 8 players = 4 QF + 2 SF + 1 F = 7 matches
    expect(result.matches).toHaveLength(7);
    expect(result.matches.filter((m) => m.round === 'QF')).toHaveLength(4);
    expect(result.matches.filter((m) => m.round === 'SF')).toHaveLength(2);
    expect(result.matches.filter((m) => m.round === 'F')).toHaveLength(1);
    // No walkovers
    expect(result.matches.filter((m) => m.status === 'walkover')).toHaveLength(0);
  });

  it('generates correct progression rules', () => {
    const result = generateSingleElimination(makePlayers(4, [1, 2, 3, 4]), 'Open');
    // 2 SF matches feed into 1 F = 2 progression rules
    expect(result.progressionRules).toHaveLength(2);

    const finalMatch = result.matches.find((m) => m.round === 'F')!;
    // Both rules should feed into the final
    for (const rule of result.progressionRules) {
      expect(rule.feedsInto).toBe(finalMatch.match_number);
    }
    // One feeds player1, one feeds player2
    const slots = result.progressionRules.map((r) => r.slot).sort();
    expect(slots).toEqual(['player1', 'player2']);
  });

  it('assigns unique match numbers', () => {
    const result = generateSingleElimination(makePlayers(16), 'Open');
    const numbers = result.matches.map((m) => m.match_number);
    const unique = new Set(numbers);
    expect(unique.size).toBe(numbers.length);
  });

  it('handles 5 players (non-power-of-2, needs 3 byes)', () => {
    const result = generateSingleElimination(makePlayers(5, [1, 2, 3, 4, 5]), 'Open');
    // Bracket size 8 → 4 R1 + 2 SF + 1 F = 7 matches
    expect(result.matches).toHaveLength(7);
    const walkovers = result.matches.filter((m) => m.status === 'walkover');
    expect(walkovers).toHaveLength(3); // 8 - 5 = 3 byes
  });

  it('all matches have draw name set', () => {
    const result = generateSingleElimination(makePlayers(8), 'Women\'s');
    for (const m of result.matches) {
      expect(m.draw).toBe('Women\'s');
    }
  });
});
