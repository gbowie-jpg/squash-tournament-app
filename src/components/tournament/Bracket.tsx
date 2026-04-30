'use client';

import type { GameScore } from '@/lib/supabase/types';

export type BracketMatch = {
  id: string;
  match_number: number;
  draw: string | null;
  round: string;
  status: string;
  player1: { id: string; name: string; seed?: number | null } | null;
  player2: { id: string; name: string; seed?: number | null } | null;
  winner_id: string | null;
  scores: GameScore[];
  scheduled_time: string | null;
  notes: string | null;
};

// ── Layout constants ─────────────────────────────────────────────────────────
const HEADER_H   = 22;  // "M1 · Done" strip
const ROW_H      = 38;  // each player row
const SCORE_ROW_H = 18; // game scores detail row (always reserved)
const CARD_H     = HEADER_H + ROW_H * 2 + SCORE_ROW_H; // 116px
const SLOT_H     = CARD_H + 12;  // 128px — card + gap
const LABEL_H    = 24;
const CARD_W     = 220;
const COL_GAP    = 44;

// ── Round helpers ────────────────────────────────────────────────────────────
const NAMED_ORDER: Record<string, number> = { F: 100, SF: 90, QF: 80 };
function roundOrder(r: string): number {
  if (NAMED_ORDER[r] !== undefined) return NAMED_ORDER[r];
  const m = r.match(/^R(\d+)$/);
  return m ? parseInt(m[1]) : 50;
}
function roundLabel(r: string): string {
  if (r === 'F') return 'Final';
  if (r === 'SF') return 'Semi-Finals';
  if (r === 'QF') return 'Quarter-Finals';
  const m = r.match(/^R(\d+)$/);
  return m ? `Round ${m[1]}` : r;
}

// ── Position maths ───────────────────────────────────────────────────────────
function topOfMatch(roundIdx: number, matchIdx: number): number {
  const mult = Math.pow(2, roundIdx);
  return SLOT_H * (mult * (2 * matchIdx + 1) - 1) / 2;
}

// ── Score helpers ─────────────────────────────────────────────────────────────
function gamesWon(scores: GameScore[], p: 1 | 2): number {
  return scores.filter((g) => (p === 1 ? g.p1 > g.p2 : g.p2 > g.p1)).length;
}

// "11–8 · 7–11 · 11–9 · 11–6" — always from p1's perspective
function fullScoreStr(scores: GameScore[]): string {
  if (!scores?.length) return '';
  return scores.map((g) => `${g.p1}–${g.p2}`).join(' · ');
}

// ── Player row ───────────────────────────────────────────────────────────────
function PlayerRow({
  player, which, isComplete, winner_id, scores, isBye,
}: {
  player: BracketMatch['player1'];
  which: 1 | 2;
  isComplete: boolean;
  winner_id: string | null;
  scores: GameScore[];
  isBye: boolean;
}) {
  const won  = !!(player && winner_id === player.id);
  const lost = !!(isComplete && player && winner_id && winner_id !== player.id);
  const tbd  = !player;
  const games = isComplete && !tbd && scores?.length ? gamesWon(scores, which) : null;

  return (
    <div
      className={`flex items-center gap-2 px-3 ${
        which === 1 ? 'border-b border-[var(--border)]' : ''
      } ${won ? 'bg-green-50 dark:bg-green-950/40' : ''}`}
      style={{ height: ROW_H }}
    >
      {/* Seed */}
      <span className="text-[10px] font-mono w-5 text-right shrink-0 text-[var(--text-secondary)]">
        {player?.seed ?? ''}
      </span>

      {/* Name */}
      <span className={`flex-1 text-[13px] truncate ${
        tbd
          ? 'text-[var(--text-secondary)] italic'
          : won
          ? 'font-bold text-green-700 dark:text-green-300'
          : lost
          ? 'text-[var(--text-secondary)]'
          : 'text-[var(--text-primary)] font-medium'
      }`}>
        {tbd ? (isBye ? '—' : 'TBD') : player!.name}
      </span>

      {/* Games won */}
      {games !== null ? (
        <span className={`text-sm font-bold shrink-0 w-5 text-center ${
          won ? 'text-green-700 dark:text-green-300' : 'text-[var(--text-secondary)]'
        }`}>
          {games}
        </span>
      ) : won ? (
        <span className="text-green-500 text-xs shrink-0">✓</span>
      ) : null}
    </div>
  );
}

// ── Match card ────────────────────────────────────────────────────────────────
function MatchCard({ match, isFinal }: { match: BracketMatch; isFinal?: boolean }) {
  const { player1, player2, winner_id, scores, status, scheduled_time } = match;
  const isBye      = status === 'walkover' || !!match.notes?.startsWith('BYE');
  const isComplete = status === 'completed' || status === 'walkover';
  const isLive     = status === 'in_progress';
  const isOnDeck   = status === 'on_deck';

  const gameScores = isComplete && scores?.length ? fullScoreStr(scores) : '';

  const statusEl = isLive ? (
    <span className="text-[10px] font-semibold text-green-600 dark:text-green-400 animate-pulse">● Live</span>
  ) : isOnDeck ? (
    <span className="text-[10px] font-semibold text-amber-500">On Deck</span>
  ) : isComplete ? (
    <span className="text-[10px] text-[var(--text-secondary)]">Final</span>
  ) : scheduled_time ? (
    <span className="text-[10px] text-[var(--text-secondary)]">
      {new Date(scheduled_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
    </span>
  ) : null;

  return (
    <div
      className={`border rounded-xl overflow-hidden shadow-sm ${
        isFinal
          ? 'border-green-400 dark:border-green-600 shadow-green-100 dark:shadow-green-950'
          : isLive
          ? 'border-green-400 dark:border-green-600'
          : 'border-[var(--border)]'
      } bg-[var(--surface-card)]`}
      style={{ width: CARD_W, height: CARD_H }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 border-b border-[var(--border)] bg-[var(--surface)]"
        style={{ height: HEADER_H }}
      >
        <span className="text-[10px] font-mono text-[var(--text-secondary)]">M{match.match_number}</span>
        {statusEl}
      </div>

      {/* Player rows */}
      <PlayerRow player={player1} which={1} isComplete={isComplete} winner_id={winner_id} scores={scores} isBye={isBye} />
      <PlayerRow player={player2} which={2} isComplete={isComplete} winner_id={winner_id} scores={scores} isBye={isBye} />

      {/* Game scores row */}
      <div
        className="flex items-center px-3 border-t border-[var(--border)] bg-[var(--surface)]"
        style={{ height: SCORE_ROW_H }}
      >
        {gameScores ? (
          <span className="text-[10px] font-mono text-[var(--text-secondary)] truncate">{gameScores}</span>
        ) : (
          <span className="text-[10px] text-[var(--text-secondary)/50]" />
        )}
      </div>
    </div>
  );
}

// ── SVG connector lines ───────────────────────────────────────────────────────
function Connectors({ numMatches, roundIdx }: { numMatches: number; roundIdx: number }) {
  const totalH = topOfMatch(roundIdx, numMatches - 1) + CARD_H + 20;
  const midX   = COL_GAP / 2;

  const lines: React.ReactNode[] = [];
  for (let i = 0; i < numMatches; i += 2) {
    const cy1  = topOfMatch(roundIdx, i)     + CARD_H / 2;
    const cy2  = topOfMatch(roundIdx, i + 1) + CARD_H / 2;
    const midY = (cy1 + cy2) / 2;

    lines.push(
      <g key={i} stroke="var(--border)" strokeWidth={1.5} fill="none">
        <line x1={0}    y1={cy1}  x2={midX} y2={cy1} />
        <line x1={0}    y1={cy2}  x2={midX} y2={cy2} />
        <line x1={midX} y1={cy1}  x2={midX} y2={cy2} />
        <line x1={midX} y1={midY} x2={COL_GAP} y2={midY} />
      </g>,
    );
  }

  return (
    <svg
      width={COL_GAP}
      height={totalH}
      style={{ position: 'absolute', left: CARD_W, top: 0, overflow: 'visible', pointerEvents: 'none' }}
    >
      {lines}
    </svg>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function Bracket({ matches }: { matches: BracketMatch[] }) {
  if (!matches.length) {
    return (
      <p className="text-center py-12 text-[var(--text-secondary)] text-sm">
        No bracket generated yet.
      </p>
    );
  }

  const roundNames = [...new Set(matches.map((m) => m.round))].sort(
    (a, b) => roundOrder(a) - roundOrder(b),
  );

  const byRound: Record<string, BracketMatch[]> = {};
  for (const r of roundNames) {
    byRound[r] = matches
      .filter((m) => m.round === r)
      .sort((a, b) => a.match_number - b.match_number);
  }

  const firstCount = byRound[roundNames[0]]?.length ?? 1;
  const totalH     = LABEL_H + firstCount * SLOT_H + 16;
  const totalW     = roundNames.length * (CARD_W + COL_GAP) - COL_GAP + 8;

  return (
    <div className="overflow-x-auto pb-2">
      <div style={{ position: 'relative', height: totalH, width: totalW, minWidth: 'max-content' }}>
        {roundNames.map((roundName, roundIdx) => {
          const roundMatches = byRound[roundName];
          const isFinalRound = roundIdx === roundNames.length - 1;
          const hasNextRound = roundIdx < roundNames.length - 1;
          const colLeft      = roundIdx * (CARD_W + COL_GAP);

          return (
            <div key={roundName}>
              {/* Round label */}
              <div
                style={{ position: 'absolute', top: 0, left: colLeft, width: CARD_W, height: LABEL_H, lineHeight: `${LABEL_H}px`, textAlign: 'center' }}
                className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider"
              >
                {roundLabel(roundName)}
              </div>

              {/* Cards */}
              {roundMatches.map((match, mi) => (
                <div
                  key={match.id}
                  style={{ position: 'absolute', top: LABEL_H + topOfMatch(roundIdx, mi), left: colLeft }}
                >
                  <MatchCard match={match} isFinal={isFinalRound} />
                </div>
              ))}

              {/* Connectors */}
              {hasNextRound && roundMatches.length > 1 && (
                <div style={{ position: 'absolute', top: LABEL_H, left: colLeft }}>
                  <Connectors numMatches={roundMatches.length} roundIdx={roundIdx} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
