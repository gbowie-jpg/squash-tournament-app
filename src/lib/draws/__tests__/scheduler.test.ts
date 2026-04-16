import { describe, it, expect } from 'vitest';
import { autoSchedule, detectConflicts } from '../scheduler';
import type { GeneratedMatch, ScheduleConfig } from '../types';

function makeMatch(
  overrides: Partial<GeneratedMatch & { id: string }> = {},
): GeneratedMatch & { id: string } {
  return {
    id: 'match-1',
    player1_id: 'p1',
    player2_id: 'p2',
    draw: 'Open',
    round: 'QF',
    match_number: 1,
    sort_order: 1,
    notes: null,
    status: 'scheduled',
    winner_id: null,
    ...overrides,
  };
}

const baseConfig: ScheduleConfig = {
  courts: [
    { id: 'c1', name: 'Court 1' },
    { id: 'c2', name: 'Court 2' },
  ],
  startTime: new Date('2026-06-01T09:00:00Z'),
  matchDurationMinutes: 45,
  restPeriodMinutes: 30,
};

describe('autoSchedule', () => {
  it('returns empty for no courts', () => {
    const result = autoSchedule(
      [makeMatch()],
      { ...baseConfig, courts: [] },
    );
    expect(result).toHaveLength(0);
  });

  it('schedules a single match', () => {
    const result = autoSchedule([makeMatch()], baseConfig);
    expect(result).toHaveLength(1);
    expect(result[0].matchNumber).toBe(1);
    expect(result[0].courtId).toBe('c1');
    expect(result[0].scheduledTime).toEqual(baseConfig.startTime);
  });

  it('skips walkovers', () => {
    const result = autoSchedule(
      [makeMatch({ status: 'walkover', match_number: 1 })],
      baseConfig,
    );
    expect(result).toHaveLength(0);
  });

  it('skips matches with missing players', () => {
    const result = autoSchedule(
      [makeMatch({ player1_id: null, match_number: 1 })],
      baseConfig,
    );
    expect(result).toHaveLength(0);
  });

  it('distributes matches across courts', () => {
    const matches = [
      makeMatch({ id: 'm1', match_number: 1, player1_id: 'p1', player2_id: 'p2' }),
      makeMatch({ id: 'm2', match_number: 2, player1_id: 'p3', player2_id: 'p4' }),
    ];
    const result = autoSchedule(matches, baseConfig);
    expect(result).toHaveLength(2);
    // Two different players → two courts available → parallel scheduling
    const courts = new Set(result.map((a) => a.courtId));
    expect(courts.size).toBe(2);
    // Both start at the same time
    expect(result[0].scheduledTime).toEqual(result[1].scheduledTime);
  });

  it('respects player rest period', () => {
    // Player 1 plays in match 1 and match 3
    const matches = [
      makeMatch({ id: 'm1', match_number: 1, player1_id: 'p1', player2_id: 'p2', round: 'QF' }),
      makeMatch({ id: 'm2', match_number: 2, player1_id: 'p3', player2_id: 'p4', round: 'QF' }),
      makeMatch({ id: 'm3', match_number: 3, player1_id: 'p1', player2_id: 'p3', round: 'SF' }),
    ];
    const result = autoSchedule(matches, baseConfig);
    expect(result).toHaveLength(3);

    const m1Time = result.find((a) => a.matchNumber === 1)!.scheduledTime.getTime();
    const m3Time = result.find((a) => a.matchNumber === 3)!.scheduledTime.getTime();
    const gapMs = m3Time - m1Time;
    // Gap must be at least matchDuration + restPeriod = 45 + 30 = 75 minutes
    expect(gapMs).toBeGreaterThanOrEqual(75 * 60 * 1000);
  });

  it('assigns unique match numbers in output', () => {
    const matches = Array.from({ length: 8 }, (_, i) =>
      makeMatch({
        id: `m${i + 1}`,
        match_number: i + 1,
        player1_id: `p${i * 2 + 1}`,
        player2_id: `p${i * 2 + 2}`,
        round: 'QF',
      }),
    );
    const result = autoSchedule(matches, baseConfig);
    const numbers = result.map((a) => a.matchNumber);
    const unique = new Set(numbers);
    expect(unique.size).toBe(numbers.length);
  });
});

describe('detectConflicts', () => {
  it('returns empty for no overlaps', () => {
    const matches = [
      { player1_id: 'p1', player2_id: 'p2', scheduled_time: '2026-06-01T09:00:00Z', match_number: 1 },
      { player1_id: 'p1', player2_id: 'p3', scheduled_time: '2026-06-01T11:00:00Z', match_number: 2 },
    ];
    expect(detectConflicts(matches, 45)).toHaveLength(0);
  });

  it('detects overlapping matches for same player', () => {
    const matches = [
      { player1_id: 'p1', player2_id: 'p2', scheduled_time: '2026-06-01T09:00:00Z', match_number: 1 },
      { player1_id: 'p1', player2_id: 'p3', scheduled_time: '2026-06-01T09:30:00Z', match_number: 2 },
    ];
    const conflicts = detectConflicts(matches, 45);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].playerId).toBe('p1');
  });

  it('ignores matches without scheduled times', () => {
    const matches = [
      { player1_id: 'p1', player2_id: 'p2', scheduled_time: null, match_number: 1 },
      { player1_id: 'p1', player2_id: 'p3', scheduled_time: '2026-06-01T09:00:00Z', match_number: 2 },
    ];
    expect(detectConflicts(matches, 45)).toHaveLength(0);
  });

  it('detects conflicts for player on both sides', () => {
    const matches = [
      { player1_id: 'p1', player2_id: 'p2', scheduled_time: '2026-06-01T09:00:00Z', match_number: 1 },
      { player1_id: 'p3', player2_id: 'p1', scheduled_time: '2026-06-01T09:15:00Z', match_number: 2 },
    ];
    const conflicts = detectConflicts(matches, 45);
    expect(conflicts.length).toBeGreaterThanOrEqual(1);
    expect(conflicts[0].playerId).toBe('p1');
  });
});
