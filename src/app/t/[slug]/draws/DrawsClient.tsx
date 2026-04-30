'use client';

import { useState } from 'react';
import Link from 'next/link';
import Bracket from '@/components/tournament/Bracket';
import type { BracketMatch } from '@/components/tournament/Bracket';
import type { GameScore } from '@/lib/supabase/types';

const STATUS_LABEL: Record<string, string> = {
  scheduled: 'Scheduled',
  on_deck: 'On Deck',
  in_progress: 'Live',
  completed: 'Done',
  walkover: 'Walkover',
};

const STATUS_COLOR: Record<string, string> = {
  scheduled: 'text-[var(--text-secondary)]',
  on_deck: 'text-amber-600 dark:text-amber-400',
  in_progress: 'text-green-600 dark:text-green-400 font-semibold',
  completed: 'text-[var(--text-secondary)]',
  walkover: 'text-[var(--text-secondary)]',
};

type Tab = 'bracket' | 'live' | 'done';

type Props = {
  slug: string;
  drawNames: string[];
  matches: BracketMatch[];
  upcoming: BracketMatch[];
  defaultTab?: Tab;
};

function gamesWon(scores: GameScore[], p: 1 | 2): number {
  return (scores ?? []).filter((g) => (p === 1 ? g.p1 > g.p2 : g.p2 > g.p1)).length;
}

export default function DrawsClient({ slug, drawNames, matches, upcoming, defaultTab }: Props) {
  const [activeDraw, setActiveDraw] = useState(drawNames[0]);
  const [view, setView] = useState<Tab>(defaultTab ?? 'bracket');

  const drawMatches = matches.filter((m) => m.draw === activeDraw);

  // Completed matches for the current draw (most recent first)
  const completedDraw = drawMatches
    .filter((m) => m.status === 'completed' || m.status === 'walkover')
    .sort((a, b) => b.match_number - a.match_number);

  // All live matches across all draws
  const liveMatches = matches.filter((m) => m.status === 'in_progress');
  // All completed matches across all draws
  const doneMatches = matches
    .filter((m) => m.status === 'completed' || m.status === 'walkover')
    .sort((a, b) => b.match_number - a.match_number);

  const TABS: { id: Tab; label: string; count?: number }[] = [
    { id: 'bracket', label: 'Bracket' },
    { id: 'live', label: 'Live', count: liveMatches.length },
    { id: 'done', label: 'Results', count: doneMatches.length },
  ];

  return (
    <div className="space-y-4">
      {/* Tab bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex rounded-xl border border-[var(--border)] overflow-hidden shrink-0">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setView(tab.id)}
              className={`relative px-4 py-2 text-sm font-medium transition-colors ${
                view === tab.id
                  ? 'bg-foreground text-card'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${
                  view === tab.id
                    ? 'bg-white/20 text-white'
                    : tab.id === 'live'
                    ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400'
                    : 'bg-[var(--surface)] text-[var(--text-secondary)]'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Draw tabs — only in bracket view */}
        {view === 'bracket' && drawNames.length > 1 && (
          <div className="flex gap-2 flex-wrap">
            {drawNames.map((d) => (
              <button
                key={d}
                onClick={() => setActiveDraw(d)}
                className={`px-3 py-2 text-sm rounded-xl border transition-colors ${
                  activeDraw === d
                    ? 'bg-foreground text-card border-foreground'
                    : 'border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                {d}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Bracket view ── */}
      {view === 'bracket' && (
        <div className="space-y-6">
          <div className="bg-[var(--surface-card)] border border-[var(--border)] rounded-2xl p-4 sm:p-6 overflow-x-auto">
            <h2 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-4">
              {activeDraw} Draw
            </h2>
            <Bracket matches={drawMatches} slug={slug} />
          </div>

          {/* Results for this draw */}
          {completedDraw.length > 0 && (
            <ResultsList matches={completedDraw} slug={slug} />
          )}
        </div>
      )}

      {/* ── Live matches ── */}
      {view === 'live' && (
        <div className="bg-[var(--surface-card)] border border-[var(--border)] rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-[var(--border)] flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <h2 className="font-semibold text-[var(--text-primary)]">Live Matches</h2>
          </div>
          {liveMatches.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-[var(--text-secondary)]">
              No matches in progress right now.
            </div>
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {liveMatches.map((m) => (
                <MatchRow key={m.id} match={m} slug={slug} showScore />
              ))}
            </ul>
          )}
        </div>
      )}

      {/* ── Results (done) ── */}
      {view === 'done' && (
        <div className="space-y-6">
          {doneMatches.length === 0 ? (
            <div className="bg-[var(--surface-card)] border border-[var(--border)] rounded-2xl px-5 py-10 text-center text-sm text-[var(--text-secondary)]">
              No completed matches yet.
            </div>
          ) : (
            <ResultsList matches={doneMatches} slug={slug} />
          )}
        </div>
      )}

      {/* Upcoming — shown below bracket */}
      {view === 'bracket' && upcoming.length > 0 && (
        <div className="bg-[var(--surface-card)] border border-[var(--border)] rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-[var(--border)]">
            <h2 className="font-semibold text-[var(--text-primary)]">Upcoming</h2>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">All draws · scheduled &amp; on deck</p>
          </div>
          <ul className="divide-y divide-[var(--border)]">
            {upcoming.map((m) => (
              <li key={m.id} className="px-5 py-4 flex items-start gap-4">
                <div className="shrink-0 text-center">
                  <span className="block text-xs font-semibold text-[var(--text-primary)]">{m.draw}</span>
                  <span className="block text-[10px] text-[var(--text-secondary)] uppercase">{m.round}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <Link href={`/t/${slug}/match/${m.id}`} className="block hover:opacity-80">
                    <p className="text-sm font-medium text-[var(--text-primary)]">
                      {m.player1?.name ?? 'TBD'}{' '}
                      <span className="text-[var(--text-secondary)] font-normal">vs</span>{' '}
                      {m.player2?.name ?? 'TBD'}
                    </p>
                  </Link>
                  {m.scheduled_time && (
                    <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                      {new Date(m.scheduled_time).toLocaleString([], {
                        weekday: 'short', month: 'short', day: 'numeric',
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </p>
                  )}
                </div>
                <span className={`text-xs shrink-0 ${STATUS_COLOR[m.status] ?? ''}`}>
                  {STATUS_LABEL[m.status] ?? m.status}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ── Shared sub-components ─────────────────────────────────────────────────────

function MatchRow({ match: m, slug, showScore }: { match: BracketMatch; slug: string; showScore?: boolean }) {
  const p1Games = gamesWon(m.scores, 1);
  const p2Games = gamesWon(m.scores, 2);
  return (
    <li>
      <Link href={`/t/${slug}/match/${m.id}`} className="flex items-center gap-3 px-5 py-4 hover:bg-[var(--surface)] transition-colors">
        <div className="shrink-0 w-10 text-center">
          <span className="text-[10px] font-mono text-[var(--text-secondary)]">{m.draw}</span>
          <span className="block text-[10px] font-mono text-[var(--text-secondary)]">{m.round}</span>
        </div>
        <div className="flex-1 min-w-0 space-y-0.5">
          <div className="flex items-center gap-2">
            <span className={`text-sm font-medium truncate ${m.winner_id === m.player1?.id ? 'text-green-700 dark:text-green-300 font-bold' : 'text-[var(--text-primary)]'}`}>
              {m.player1?.name ?? 'TBD'}
            </span>
            {showScore && <span className="text-sm font-bold text-[var(--text-primary)] shrink-0">{p1Games}</span>}
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-sm font-medium truncate ${m.winner_id === m.player2?.id ? 'text-green-700 dark:text-green-300 font-bold' : 'text-[var(--text-primary)]'}`}>
              {m.player2?.name ?? 'TBD'}
            </span>
            {showScore && <span className="text-sm font-bold text-[var(--text-primary)] shrink-0">{p2Games}</span>}
          </div>
        </div>
        {showScore && m.scores?.length > 0 && (
          <span className="text-xs font-mono text-[var(--text-secondary)] shrink-0">
            {m.scores.map(g => `${g.p1}–${g.p2}`).join(' ')}
          </span>
        )}
        <span className="text-xs text-green-600 dark:text-green-400 font-semibold shrink-0">LIVE →</span>
      </Link>
    </li>
  );
}

function ResultsList({ matches, slug }: { matches: BracketMatch[]; slug: string }) {
  return (
    <div className="bg-[var(--surface-card)] border border-[var(--border)] rounded-2xl overflow-hidden">
      <div className="px-5 py-3 border-b border-[var(--border)]">
        <h2 className="font-semibold text-[var(--text-primary)]">Results</h2>
      </div>
      <ul className="divide-y divide-[var(--border)]">
        {matches.map((m) => {
          const winner = m.winner_id === m.player1?.id ? m.player1 : m.player2;
          const loser  = m.winner_id === m.player1?.id ? m.player2 : m.player1;
          const scoreStr = m.scores?.length
            ? (m.winner_id === m.player1?.id
                ? m.scores.map(g => `${g.p1}–${g.p2}`).join(' · ')
                : m.scores.map(g => `${g.p2}–${g.p1}`).join(' · '))
            : null;
          return (
            <li key={m.id}>
              <Link href={`/t/${slug}/match/${m.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-[var(--surface)] transition-colors">
                <span className="text-xs text-[var(--text-secondary)] font-mono w-8 shrink-0">{m.round}</span>
                <div className="flex-1 text-sm">
                  {m.status === 'walkover' ? (
                    <span className="text-[var(--text-primary)]">
                      <span className="font-medium">{winner?.name ?? '—'}</span>{' '}
                      <span className="text-[var(--text-secondary)]">won by walkover</span>
                    </span>
                  ) : (
                    <span>
                      <span className="font-semibold text-green-700 dark:text-green-300">{winner?.name ?? '—'}</span>
                      {' '}<span className="text-[var(--text-secondary)]">def.</span>{' '}
                      <span className="text-[var(--text-primary)]">{loser?.name ?? '—'}</span>
                      {scoreStr && (
                        <span className="text-[var(--text-secondary)] ml-2 font-mono text-xs">{scoreStr}</span>
                      )}
                    </span>
                  )}
                </div>
                <span className="text-xs text-[var(--text-secondary)]">→</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
