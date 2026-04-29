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

// ── Round ordering ──────────────────────────────────────────────────────────
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

// ── Score string helper ─────────────────────────────────────────────────────
function scoreStr(scores: GameScore[], p: 1 | 2): string {
  if (!scores?.length) return '';
  return scores.map((g) => (p === 1 ? g.p1 : g.p2)).join(', ');
}

// ── Match card ──────────────────────────────────────────────────────────────
const CARD_H = 80; // px — height of one match card
const CARD_W = 192; // px — width of one match card
const COL_GAP = 48; // px — horizontal gap between round columns

type CardProps = { match: BracketMatch; isFinal?: boolean };

function MatchCard({ match, isFinal }: CardProps) {
  const { player1, player2, winner_id, scores, status } = match;
  const isBye = status === 'walkover' || match.notes?.startsWith('BYE');
  const isComplete = status === 'completed' || status === 'walkover';

  const renderSlot = (player: BracketMatch['player1'], which: 1 | 2) => {
    const won = player && winner_id === player.id;
    const lost = isComplete && player && winner_id && winner_id !== player.id;
    const tbd = !player;
    const score = isComplete && !tbd ? scoreStr(scores, which) : '';

    return (
      <div
        className={`flex items-center justify-between px-2.5 h-9 rounded ${
          won
            ? 'bg-blue-50 dark:bg-blue-950/40'
            : tbd
            ? 'bg-[var(--surface)]'
            : 'bg-[var(--surface-card)]'
        } ${which === 1 ? 'border-b border-[var(--border)]' : ''}`}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          {player?.seed && (
            <span className="text-[10px] text-[var(--text-secondary)] w-4 shrink-0 text-right">
              {player.seed}
            </span>
          )}
          <span
            className={`text-xs truncate ${
              tbd
                ? 'text-[var(--text-secondary)] italic'
                : won
                ? 'font-semibold text-blue-700 dark:text-blue-300'
                : lost
                ? 'text-[var(--text-secondary)]'
                : 'text-[var(--text-primary)]'
            }`}
          >
            {tbd ? (isBye ? '—' : 'TBD') : player.name}
          </span>
        </div>
        {score && (
          <span
            className={`text-[11px] font-mono ml-1 shrink-0 ${
              won ? 'font-bold text-blue-700 dark:text-blue-300' : 'text-[var(--text-secondary)]'
            }`}
          >
            {score}
          </span>
        )}
        {won && <span className="ml-1 text-[10px]">✓</span>}
      </div>
    );
  };

  return (
    <div
      className={`border border-[var(--border)] rounded-lg overflow-hidden ${
        isFinal ? 'ring-2 ring-blue-400 ring-offset-1' : ''
      } bg-[var(--surface-card)]`}
      style={{ width: CARD_W, height: CARD_H - 8 }}
    >
      {/* Match number */}
      <div className="flex items-center justify-between px-2.5 py-0.5 border-b border-[var(--border)] bg-[var(--surface)]">
        <span className="text-[9px] text-[var(--text-secondary)] font-mono">M{match.match_number}</span>
        {match.scheduled_time && !isComplete && (
          <span className="text-[9px] text-[var(--text-secondary)]">
            {new Date(match.scheduled_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
        {isComplete && <span className="text-[9px] text-green-600 font-medium">Done</span>}
      </div>
      <div style={{ height: CARD_H - 8 - 20 }}>
        {renderSlot(player1, 1)}
        {renderSlot(player2, 2)}
      </div>
    </div>
  );
}

// ── SVG connector lines ─────────────────────────────────────────────────────
function Connectors({
  numMatches,
  roundIdx,
}: {
  numMatches: number; // matches in THIS round (left side)
  roundIdx: number;   // 0-indexed round of the LEFT column
}) {
  const matchHeight = CARD_H;
  const top0 = topOfMatch(roundIdx, 0);
  const totalH = top0 * 2 + matchHeight * Math.pow(2, roundIdx); // approximate full column height

  const paths: React.ReactNode[] = [];

  for (let i = 0; i < numMatches; i += 2) {
    const centerA = topOfMatch(roundIdx, i) + matchHeight / 2;
    const centerB = topOfMatch(roundIdx, i + 1) + matchHeight / 2;
    const midX = COL_GAP / 2;
    const midY = (centerA + centerB) / 2;

    paths.push(
      <g key={i}>
        {/* right edge → midpoint horizontal lines */}
        <line x1={0} y1={centerA} x2={midX} y2={centerA} className="stroke-[var(--border)]" strokeWidth={1.5} />
        <line x1={0} y1={centerB} x2={midX} y2={centerB} className="stroke-[var(--border)]" strokeWidth={1.5} />
        {/* vertical join */}
        <line x1={midX} y1={centerA} x2={midX} y2={centerB} className="stroke-[var(--border)]" strokeWidth={1.5} />
        {/* midpoint → next card */}
        <line x1={midX} y1={midY} x2={COL_GAP} y2={midY} className="stroke-[var(--border)]" strokeWidth={1.5} />
      </g>,
    );
  }

  return (
    <svg
      width={COL_GAP}
      height={totalH + matchHeight}
      style={{ position: 'absolute', left: CARD_W, top: 0, overflow: 'visible', pointerEvents: 'none' }}
    >
      {paths}
    </svg>
  );
}

// ── Position maths ──────────────────────────────────────────────────────────
// Returns the top pixel offset of match i in round r (0-indexed)
function topOfMatch(roundIdx: number, matchIdx: number): number {
  const mult = Math.pow(2, roundIdx);
  return CARD_H * (mult * (2 * matchIdx + 1) - 1) / 2;
}

// ── Main bracket renderer ───────────────────────────────────────────────────
export default function Bracket({ matches }: { matches: BracketMatch[] }) {
  if (!matches.length) {
    return (
      <div className="text-center py-12 text-[var(--text-secondary)] text-sm">
        No bracket generated yet.
      </div>
    );
  }

  // Sort rounds earliest → latest
  const roundNames = [...new Set(matches.map((m) => m.round))].sort(
    (a, b) => roundOrder(a) - roundOrder(b),
  );

  // Group matches by round, sorted by match_number within each round
  const byRound: Record<string, BracketMatch[]> = {};
  for (const r of roundNames) {
    byRound[r] = matches
      .filter((m) => m.round === r)
      .sort((a, b) => a.match_number - b.match_number);
  }

  const firstRoundCount = byRound[roundNames[0]]?.length ?? 1;
  const totalHeight = firstRoundCount * CARD_H + 16; // a bit of padding

  return (
    <div className="overflow-x-auto pb-4">
      <div
        style={{
          position: 'relative',
          height: totalHeight,
          width: roundNames.length * (CARD_W + COL_GAP) - COL_GAP + 16,
          minWidth: 'max-content',
        }}
      >
        {roundNames.map((roundName, roundIdx) => {
          const roundMatches = byRound[roundName];
          const isFinalRound = roundIdx === roundNames.length - 1;
          const hasNextRound = roundIdx < roundNames.length - 1;

          return (
            <div key={roundName}>
              {/* Round label */}
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: roundIdx * (CARD_W + COL_GAP),
                  width: CARD_W,
                  textAlign: 'center',
                }}
                className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider"
              >
                {roundLabel(roundName)}
              </div>

              {/* Match cards */}
              {roundMatches.map((match, matchIdx) => {
                const top = topOfMatch(roundIdx, matchIdx) + 20; // +20 for label
                return (
                  <div
                    key={match.id}
                    style={{
                      position: 'absolute',
                      top,
                      left: roundIdx * (CARD_W + COL_GAP),
                    }}
                  >
                    <MatchCard match={match} isFinal={isFinalRound} />
                  </div>
                );
              })}

              {/* Connector lines to next round */}
              {hasNextRound && roundMatches.length > 1 && (
                <div
                  style={{
                    position: 'absolute',
                    top: 20,
                    left: roundIdx * (CARD_W + COL_GAP),
                  }}
                >
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
