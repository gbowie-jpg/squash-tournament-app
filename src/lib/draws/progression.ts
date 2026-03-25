import type { ProgressionRule } from './types';

/**
 * Determine where a match winner should be placed in the next round.
 * Returns the target match number and slot, or null if no progression exists.
 */
export function getProgression(
  completedMatchNumber: number,
  allMatchNumbers: number[],
  drawMatches: { match_number: number; notes: string | null }[],
): { feedsIntoMatchNumber: number; slot: 'player1_id' | 'player2_id' } | null {
  // Look for a match whose notes reference this match number
  for (const m of drawMatches) {
    if (!m.notes) continue;
    const winnerPattern = `Winner of M${completedMatchNumber}`;
    if (!m.notes.includes(winnerPattern)) continue;

    // Determine which slot: the first "Winner of MX" in the notes is player1,
    // the second is player2
    const regex = /Winner of M(\d+)/g;
    let slotIndex = 0;
    let match;
    while ((match = regex.exec(m.notes)) !== null) {
      if (parseInt(match[1]) === completedMatchNumber) {
        return {
          feedsIntoMatchNumber: m.match_number,
          slot: slotIndex === 0 ? 'player1_id' : 'player2_id',
        };
      }
      slotIndex++;
    }
  }

  return null;
}

/**
 * Rebuild progression rules from existing matches (for when matches are loaded from DB).
 */
export function rebuildProgressionRules(
  matches: { match_number: number; notes: string | null }[],
): ProgressionRule[] {
  const rules: ProgressionRule[] = [];

  for (const m of matches) {
    if (!m.notes) continue;
    const regex = /Winner of M(\d+)/g;
    let result;
    let slotIndex = 0;
    while ((result = regex.exec(m.notes)) !== null) {
      rules.push({
        matchNumber: parseInt(result[1]),
        feedsInto: m.match_number,
        slot: slotIndex === 0 ? 'player1' : 'player2',
      });
      slotIndex++;
    }
  }

  return rules;
}
