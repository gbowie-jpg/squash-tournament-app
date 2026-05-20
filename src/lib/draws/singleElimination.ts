import type { PlayerInput, GeneratedMatch, ProgressionRule, DrawResult } from './types';

/**
 * Generate standard seed positions for a bracket.
 * Uses the recursive interleave algorithm:
 *   Start with [1], then for each doubling add the complement.
 *   [1] → [1,2] → [1,4,3,2] → [1,8,5,4,3,6,7,2]
 * This ensures seed 1 meets seed 2 only in the final.
 */
function getSeedPositions(bracketSize: number): number[] {
  let positions = [1];
  while (positions.length < bracketSize) {
    const newPositions: number[] = [];
    const sum = positions.length * 2 + 1;
    for (const pos of positions) {
      newPositions.push(pos);
      newPositions.push(sum - pos);
    }
    positions = newPositions;
  }
  return positions;
}

function nextPowerOf2(n: number): number {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

function getRoundName(roundIndex: number, totalRounds: number): string {
  const fromEnd = totalRounds - 1 - roundIndex;
  if (fromEnd === 0) return 'F';
  if (fromEnd === 1) return 'SF';
  if (fromEnd === 2) return 'QF';
  return `R${roundIndex + 1}`;
}

/**
 * Shuffle an array (Fisher-Yates).
 */
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

type BracketSlot = {
  playerId: string | null;
  playerName: string | null;
  seed: number | null;
  isBye: boolean;
};

export function generateSingleElimination(
  players: PlayerInput[],
  drawName: string,
): DrawResult {
  if (players.length < 2) {
    throw new Error('Need at least 2 players for single elimination');
  }

  const bracketSize = nextPowerOf2(players.length);
  const totalRounds = Math.log2(bracketSize);

  // Separate seeded and unseeded players
  const seeded = players
    .filter((p) => p.seed != null)
    .sort((a, b) => a.seed! - b.seed!);
  const unseeded = shuffle(players.filter((p) => p.seed == null));

  // Create bracket slots — all start as BYEs
  const slots: BracketSlot[] = Array(bracketSize)
    .fill(null)
    .map(() => ({
      playerId: null,
      playerName: null,
      seed: null,
      isBye: true,
    }));

  // seedPositions[i] = the seed NUMBER that belongs in slot i.
  // e.g. for 16 slots: [1, 16, 8, 9, 4, 13, 5, 12, 2, 15, 7, 10, 3, 14, 6, 11]
  // so slot 0 → seed 1, slot 1 → seed 16, slot 2 → seed 8, etc.
  // This ensures top seeds meet only in late rounds, and byes go to the highest seeds.
  const seedPositions = getSeedPositions(bracketSize);

  // Build a lookup from seed number → player
  const seededBySeedNum = new Map(seeded.map((p) => [p.seed!, p]));

  // Place each seeded player into their correct slot
  for (let i = 0; i < bracketSize; i++) {
    const expectedSeed = seedPositions[i];
    const player = seededBySeedNum.get(expectedSeed);
    if (player) {
      slots[i] = {
        playerId: player.id,
        playerName: player.name,
        seed: player.seed,
        isBye: false,
      };
    }
    // If no player has this seed number, slot stays as BYE
  }

  // Any seeded players whose seed# wasn't in seedPositions fall back to unseeded pool
  const placedIds = new Set(slots.filter((s) => !s.isBye).map((s) => s.playerId));
  const fallbackSeeded = seeded
    .filter((p) => !placedIds.has(p.id))
    .map((p) => ({ ...p, seed: null as null }));
  const unseededPool = shuffle([...fallbackSeeded, ...unseeded]);

  // Fill remaining BYE slots with unseeded players
  let unseededIdx = 0;
  for (let i = 0; i < slots.length; i++) {
    if (slots[i].isBye && unseededIdx < unseededPool.length) {
      slots[i] = {
        playerId: unseededPool[unseededIdx].id,
        playerName: unseededPool[unseededIdx].name,
        seed: unseededPool[unseededIdx].seed,
        isBye: false,
      };
      unseededIdx++;
    }
  }

  // Generate first-round matches
  const matches: GeneratedMatch[] = [];
  const progressionRules: ProgressionRule[] = [];
  let matchNum = 1;

  const firstRoundMatchNums: number[] = [];

  for (let i = 0; i < bracketSize; i += 2) {
    const s1 = slots[i];
    const s2 = slots[i + 1];
    const isBye = s1.isBye || s2.isBye;

    const match: GeneratedMatch = {
      player1_id: s1.isBye ? null : s1.playerId,
      player2_id: s2.isBye ? null : s2.playerId,
      draw: drawName,
      round: getRoundName(0, totalRounds),
      match_number: matchNum,
      sort_order: matchNum,
      notes: isBye
        ? `BYE - ${s1.isBye ? (s2.playerName || 'TBD') : (s1.playerName || 'TBD')} advances`
        : null,
      status: isBye ? 'walkover' : 'scheduled',
      winner_id: isBye
        ? (s1.isBye ? s2.playerId : s1.playerId)
        : null,
    };

    matches.push(match);
    firstRoundMatchNums.push(matchNum);
    matchNum++;
  }

  // Generate subsequent rounds
  let prevRoundMatchNums = firstRoundMatchNums;

  for (let round = 1; round < totalRounds; round++) {
    const roundName = getRoundName(round, totalRounds);
    const currentRoundMatchNums: number[] = [];

    for (let i = 0; i < prevRoundMatchNums.length; i += 2) {
      const m1Num = prevRoundMatchNums[i];
      const m2Num = prevRoundMatchNums[i + 1];

      const match: GeneratedMatch = {
        player1_id: null,
        player2_id: null,
        draw: drawName,
        round: roundName,
        match_number: matchNum,
        sort_order: matchNum,
        notes: `Winner of M${m1Num} vs Winner of M${m2Num}`,
        status: 'scheduled',
        winner_id: null,
      };

      // Record progression
      progressionRules.push(
        { matchNumber: m1Num, feedsInto: matchNum, slot: 'player1' },
        { matchNumber: m2Num, feedsInto: matchNum, slot: 'player2' },
      );

      matches.push(match);
      currentRoundMatchNums.push(matchNum);
      matchNum++;
    }

    prevRoundMatchNums = currentRoundMatchNums;
  }

  // Auto-advance bye winners into next round
  for (const match of matches) {
    if (match.status === 'walkover' && match.winner_id) {
      const rules = progressionRules.filter(
        (r) => r.matchNumber === match.match_number,
      );
      for (const rule of rules) {
        const target = matches.find((m) => m.match_number === rule.feedsInto);
        if (target) {
          if (rule.slot === 'player1') {
            target.player1_id = match.winner_id;
          } else {
            target.player2_id = match.winner_id;
          }
        }
      }
    }
  }

  return { matches, progressionRules };
}

/**
 * Preview-only: returns match descriptions without player IDs.
 * Used client-side before actually generating.
 */
export function previewSingleElimination(
  players: PlayerInput[],
  drawName: string,
): { round: string; description: string; matchNumber: number }[] {
  const result = generateSingleElimination(players, drawName);
  const playerMap = new Map(players.map((p) => [p.id, p]));

  return result.matches.map((m) => {
    const p1 = m.player1_id ? playerMap.get(m.player1_id) : null;
    const p2 = m.player2_id ? playerMap.get(m.player2_id) : null;
    const p1Label = p1
      ? `${p1.seed ? `[${p1.seed}] ` : ''}${p1.name}`
      : 'BYE';
    const p2Label = p2
      ? `${p2.seed ? `[${p2.seed}] ` : ''}${p2.name}`
      : 'BYE';

    let description: string;
    if (m.status === 'walkover') {
      description = `${p1Label !== 'BYE' ? p1Label : p2Label} (BYE)`;
    } else if (m.notes?.startsWith('Winner of')) {
      description = m.notes;
    } else {
      description = `${p1Label} vs ${p2Label}`;
    }

    return {
      round: m.round,
      description,
      matchNumber: m.match_number,
    };
  });
}
