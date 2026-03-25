import type { GeneratedMatch, ScheduleConfig, ScheduleAssignment } from './types';

type MatchForScheduling = GeneratedMatch & { id?: string };

/**
 * Greedy scheduler: assigns courts and time slots to matches.
 * - Processes matches round by round (earlier rounds first)
 * - Respects rest periods between matches for the same player
 * - Assigns to the earliest available court
 */
export function autoSchedule(
  matches: MatchForScheduling[],
  config: ScheduleConfig,
): ScheduleAssignment[] {
  const { courts, startTime, matchDurationMinutes, restPeriodMinutes } = config;

  if (courts.length === 0) return [];

  const slotDurationMs = matchDurationMinutes * 60 * 1000;
  const restMs = restPeriodMinutes * 60 * 1000;
  const startMs = startTime.getTime();

  // Only schedule matches with both players known and not walkovers
  const schedulable = matches.filter(
    (m) => m.player1_id && m.player2_id && m.status !== 'walkover',
  );

  // Group by round and sort rounds in order
  const roundOrder = getRoundOrder(schedulable);
  const byRound = new Map<string, MatchForScheduling[]>();
  for (const m of schedulable) {
    const arr = byRound.get(m.round) || [];
    arr.push(m);
    byRound.set(m.round, arr);
  }

  // Tracking maps
  const playerLastEnd = new Map<string, number>(); // playerId → end timestamp
  const courtNextFree = new Map<string, number>(); // courtId → next free timestamp
  for (const court of courts) {
    courtNextFree.set(court.id, startMs);
  }

  const assignments: ScheduleAssignment[] = [];

  for (const round of roundOrder) {
    const roundMatches = byRound.get(round) || [];
    // Sort by match_number for deterministic ordering
    roundMatches.sort((a, b) => a.match_number - b.match_number);

    for (const match of roundMatches) {
      // Earliest time based on player rest
      let earliest = startMs;
      if (match.player1_id) {
        const p1End = playerLastEnd.get(match.player1_id);
        if (p1End) earliest = Math.max(earliest, p1End + restMs);
      }
      if (match.player2_id) {
        const p2End = playerLastEnd.get(match.player2_id);
        if (p2End) earliest = Math.max(earliest, p2End + restMs);
      }

      // Find the first court available at or after earliest
      let bestCourt: string | null = null;
      let bestTime = Infinity;

      for (const court of courts) {
        const courtFree = courtNextFree.get(court.id) || startMs;
        const slotStart = Math.max(courtFree, earliest);
        if (slotStart < bestTime) {
          bestTime = slotStart;
          bestCourt = court.id;
        }
      }

      if (!bestCourt) continue;

      const matchEnd = bestTime + slotDurationMs;

      assignments.push({
        matchNumber: match.match_number,
        courtId: bestCourt,
        scheduledTime: new Date(bestTime),
      });

      // Update tracking
      courtNextFree.set(bestCourt, matchEnd);
      if (match.player1_id) playerLastEnd.set(match.player1_id, matchEnd);
      if (match.player2_id) playerLastEnd.set(match.player2_id, matchEnd);
    }
  }

  return assignments;
}

/**
 * Detect scheduling conflicts (overlapping matches for same player).
 */
export function detectConflicts(
  matches: { player1_id: string | null; player2_id: string | null; scheduled_time: string | null; match_number: number; id?: string }[],
  matchDurationMinutes: number,
): { playerId: string; match1: number; match2: number }[] {
  const durationMs = matchDurationMinutes * 60 * 1000;
  const conflicts: { playerId: string; match1: number; match2: number }[] = [];

  // Build player → matches map
  const playerMatches = new Map<string, typeof matches>();
  for (const m of matches) {
    if (!m.scheduled_time) continue;
    for (const pid of [m.player1_id, m.player2_id]) {
      if (!pid) continue;
      const arr = playerMatches.get(pid) || [];
      arr.push(m);
      playerMatches.set(pid, arr);
    }
  }

  for (const [playerId, pMatches] of playerMatches) {
    const sorted = pMatches
      .filter((m) => m.scheduled_time)
      .sort((a, b) => new Date(a.scheduled_time!).getTime() - new Date(b.scheduled_time!).getTime());

    for (let i = 0; i < sorted.length - 1; i++) {
      const end1 = new Date(sorted[i].scheduled_time!).getTime() + durationMs;
      const start2 = new Date(sorted[i + 1].scheduled_time!).getTime();
      if (end1 > start2) {
        conflicts.push({
          playerId,
          match1: sorted[i].match_number,
          match2: sorted[i + 1].match_number,
        });
      }
    }
  }

  return conflicts;
}

/**
 * Sort rounds in logical order for scheduling.
 */
function getRoundOrder(matches: MatchForScheduling[]): string[] {
  const rounds = [...new Set(matches.map((m) => m.round))];

  const priority = (r: string): number => {
    if (r.startsWith('RR')) return parseInt(r.slice(2)) || 0;
    if (r.startsWith('R')) return parseInt(r.slice(1)) || 0;
    if (r === 'QF') return 100;
    if (r === 'SF') return 200;
    if (r === 'F') return 300;
    return 50;
  };

  return rounds.sort((a, b) => priority(a) - priority(b));
}
