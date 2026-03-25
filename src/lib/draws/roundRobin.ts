import type { PlayerInput, GeneratedMatch, DrawResult } from './types';

/**
 * Generate round-robin matches using the circle (polygon) method.
 * Fix player[0] in place, rotate all others each round.
 * For N players (padded to even), generates (N-1) rounds of N/2 matches.
 */
export function generateRoundRobin(
  players: PlayerInput[],
  drawName: string,
): DrawResult {
  if (players.length < 2) {
    throw new Error('Need at least 2 players for round robin');
  }

  // Pad to even number with a phantom bye
  const list: (PlayerInput | null)[] = [...players];
  if (list.length % 2 !== 0) {
    list.push(null); // bye phantom
  }

  const n = list.length;
  const numRounds = n - 1;
  const matchesPerRound = n / 2;

  const matches: GeneratedMatch[] = [];
  let matchNum = 1;

  for (let round = 0; round < numRounds; round++) {
    const roundName = `RR${round + 1}`;

    for (let i = 0; i < matchesPerRound; i++) {
      // Circle method pairing
      let homeIdx: number;
      let awayIdx: number;

      if (i === 0) {
        homeIdx = 0;
        awayIdx = n - 1 - round;
        // Wrap around
        if (awayIdx < 0) awayIdx += n - 1;
      } else {
        homeIdx = ((round + i) % (n - 1)) + 1;
        awayIdx = ((round + (n - 1) - i) % (n - 1)) + 1;
      }

      // Fix: use standard circle method rotation
      // Build rotated array for this round
      const rotated: (PlayerInput | null)[] = [list[0]];
      for (let j = 1; j < n; j++) {
        const idx = ((j - 1 + round) % (n - 1)) + 1;
        rotated.push(list[idx]);
      }

      const p1 = rotated[i];
      const p2 = rotated[n - 1 - i];

      // Skip if either is the bye phantom
      if (p1 === null || p2 === null) {
        continue;
      }

      matches.push({
        player1_id: p1.id,
        player2_id: p2.id,
        draw: drawName,
        round: roundName,
        match_number: matchNum,
        sort_order: matchNum,
        notes: null,
        status: 'scheduled',
        winner_id: null,
      });
      matchNum++;
    }
  }

  // Round robin has no progression rules
  return { matches, progressionRules: [] };
}

/**
 * Preview round-robin matchups for display before generating.
 */
export function previewRoundRobin(
  players: PlayerInput[],
  drawName: string,
): { round: string; description: string; matchNumber: number }[] {
  const result = generateRoundRobin(players, drawName);
  const playerMap = new Map(players.map((p) => [p.id, p]));

  return result.matches.map((m) => {
    const p1 = m.player1_id ? playerMap.get(m.player1_id) : null;
    const p2 = m.player2_id ? playerMap.get(m.player2_id) : null;
    const p1Label = p1
      ? `${p1.seed ? `[${p1.seed}] ` : ''}${p1.name}`
      : '?';
    const p2Label = p2
      ? `${p2.seed ? `[${p2.seed}] ` : ''}${p2.name}`
      : '?';

    return {
      round: m.round,
      description: `${p1Label} vs ${p2Label}`,
      matchNumber: m.match_number,
    };
  });
}
