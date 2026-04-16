import { describe, it, expect } from 'vitest';
import { getProgression, rebuildProgressionRules } from '../progression';

describe('getProgression', () => {
  const drawMatches = [
    { match_number: 1, notes: null },
    { match_number: 2, notes: null },
    { match_number: 3, notes: 'Winner of M1 vs Winner of M2' },
    { match_number: 4, notes: null },
    { match_number: 5, notes: null },
    { match_number: 6, notes: 'Winner of M4 vs Winner of M5' },
    { match_number: 7, notes: 'Winner of M3 vs Winner of M6' },
  ];

  it('finds correct target for match 1 (feeds into M3 as player1)', () => {
    const result = getProgression(1, drawMatches.map((m) => m.match_number), drawMatches);
    expect(result).toEqual({
      feedsIntoMatchNumber: 3,
      slot: 'player1_id',
    });
  });

  it('finds correct target for match 2 (feeds into M3 as player2)', () => {
    const result = getProgression(2, drawMatches.map((m) => m.match_number), drawMatches);
    expect(result).toEqual({
      feedsIntoMatchNumber: 3,
      slot: 'player2_id',
    });
  });

  it('finds correct target for match 3 (feeds into M7 as player1)', () => {
    const result = getProgression(3, drawMatches.map((m) => m.match_number), drawMatches);
    expect(result).toEqual({
      feedsIntoMatchNumber: 7,
      slot: 'player1_id',
    });
  });

  it('returns null for final match (no progression)', () => {
    const result = getProgression(7, drawMatches.map((m) => m.match_number), drawMatches);
    expect(result).toBeNull();
  });

  it('returns null for non-existent match number', () => {
    const result = getProgression(99, drawMatches.map((m) => m.match_number), drawMatches);
    expect(result).toBeNull();
  });

  it('returns null when no notes reference the match', () => {
    const matches = [
      { match_number: 1, notes: null },
      { match_number: 2, notes: 'Some other note' },
    ];
    const result = getProgression(1, [1, 2], matches);
    expect(result).toBeNull();
  });
});

describe('rebuildProgressionRules', () => {
  it('rebuilds rules from match notes', () => {
    const matches = [
      { match_number: 1, notes: null },
      { match_number: 2, notes: null },
      { match_number: 3, notes: 'Winner of M1 vs Winner of M2' },
    ];
    const rules = rebuildProgressionRules(matches);
    expect(rules).toHaveLength(2);
    expect(rules).toContainEqual({ matchNumber: 1, feedsInto: 3, slot: 'player1' });
    expect(rules).toContainEqual({ matchNumber: 2, feedsInto: 3, slot: 'player2' });
  });

  it('returns empty array when no notes contain progression info', () => {
    const matches = [
      { match_number: 1, notes: null },
      { match_number: 2, notes: 'Just a regular note' },
    ];
    expect(rebuildProgressionRules(matches)).toHaveLength(0);
  });

  it('handles complex multi-round bracket', () => {
    const matches = [
      { match_number: 1, notes: null },
      { match_number: 2, notes: null },
      { match_number: 3, notes: null },
      { match_number: 4, notes: null },
      { match_number: 5, notes: 'Winner of M1 vs Winner of M2' },
      { match_number: 6, notes: 'Winner of M3 vs Winner of M4' },
      { match_number: 7, notes: 'Winner of M5 vs Winner of M6' },
    ];
    const rules = rebuildProgressionRules(matches);
    expect(rules).toHaveLength(6);
  });
});
