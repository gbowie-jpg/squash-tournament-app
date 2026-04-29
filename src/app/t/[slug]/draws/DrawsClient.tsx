'use client';

import { useState } from 'react';
import Bracket from '@/components/tournament/Bracket';
import type { BracketMatch } from '@/components/tournament/Bracket';

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

type Props = {
  drawNames: string[];
  matches: BracketMatch[];
  upcoming: BracketMatch[];
};

export default function DrawsClient({ drawNames, matches, upcoming }: Props) {
  const [activeDraw, setActiveDraw] = useState(drawNames[0]);
  const [view, setView] = useState<'bracket' | 'upcoming'>('bracket');

  const drawMatches = matches.filter((m) => m.draw === activeDraw);

  // Simple completed match history (most recent first)
  const completed = drawMatches
    .filter((m) => m.status === 'completed' || m.status === 'walkover')
    .sort((a, b) => b.match_number - a.match_number);

  return (
    <div className="space-y-4">
      {/* Top nav: view toggle + draw tabs */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* View toggle */}
        <div className="flex rounded-xl border border-[var(--border)] overflow-hidden shrink-0">
          {(['bracket', 'upcoming'] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                view === v
                  ? 'bg-foreground text-card'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {v === 'bracket' ? 'Bracket' : 'Upcoming'}
            </button>
          ))}
        </div>

        {/* Draw tabs (only shown in bracket view) */}
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
            <Bracket matches={drawMatches} />
          </div>

          {/* Results */}
          {completed.length > 0 && (
            <div className="bg-[var(--surface-card)] border border-[var(--border)] rounded-2xl overflow-hidden">
              <div className="px-5 py-3 border-b border-[var(--border)]">
                <h2 className="font-semibold text-[var(--text-primary)]">Results</h2>
              </div>
              <ul className="divide-y divide-[var(--border)]">
                {completed.map((m) => {
                  const winner = m.winner_id === m.player1?.id ? m.player1 : m.player2;
                  const loser = m.winner_id === m.player1?.id ? m.player2 : m.player1;
                  const scoreP1 = m.scores?.map((g) => g.p1).join(', ');
                  const scoreP2 = m.scores?.map((g) => g.p2).join(', ');
                  return (
                    <li key={m.id} className="px-5 py-3 flex items-center gap-3">
                      <span className="text-xs text-[var(--text-secondary)] font-mono w-8 shrink-0">
                        {m.round}
                      </span>
                      <div className="flex-1 text-sm">
                        {m.status === 'walkover' ? (
                          <span className="text-[var(--text-primary)]">
                            <span className="font-medium">{winner?.name ?? '—'}</span>{' '}
                            <span className="text-[var(--text-secondary)]">won by walkover</span>
                          </span>
                        ) : (
                          <span>
                            <span className="font-medium text-[var(--text-primary)]">{winner?.name ?? '—'}</span>
                            {' '}
                            <span className="text-[var(--text-secondary)]">def.</span>
                            {' '}
                            <span className="text-[var(--text-primary)]">{loser?.name ?? '—'}</span>
                            {m.scores?.length ? (
                              <span className="text-[var(--text-secondary)] ml-2 font-mono text-xs">
                                {m.winner_id === m.player1?.id
                                  ? `${scoreP1} – ${scoreP2}`
                                  : `${scoreP2} – ${scoreP1}`}
                              </span>
                            ) : null}
                          </span>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* ── Upcoming matches ── */}
      {view === 'upcoming' && (
        <div className="bg-[var(--surface-card)] border border-[var(--border)] rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-[var(--border)]">
            <h2 className="font-semibold text-[var(--text-primary)]">Upcoming Matches</h2>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">All draws · scheduled &amp; on deck</p>
          </div>
          {upcoming.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-[var(--text-secondary)]">
              No upcoming matches scheduled yet.
            </div>
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {upcoming.map((m) => (
                <li key={m.id} className="px-5 py-4 flex items-start gap-4">
                  {/* Draw + round badge */}
                  <div className="shrink-0 text-center">
                    <span className="block text-xs font-semibold text-[var(--text-primary)]">
                      {m.draw}
                    </span>
                    <span className="block text-[10px] text-[var(--text-secondary)] uppercase">
                      {m.round}
                    </span>
                  </div>

                  {/* Players */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--text-primary)]">
                      {m.player1?.name ?? 'TBD'}{' '}
                      <span className="text-[var(--text-secondary)] font-normal">vs</span>{' '}
                      {m.player2?.name ?? 'TBD'}
                    </p>
                    {m.scheduled_time && (
                      <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                        {new Date(m.scheduled_time).toLocaleString([], {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    )}
                  </div>

                  {/* Status */}
                  <span className={`text-xs shrink-0 ${STATUS_COLOR[m.status] ?? ''}`}>
                    {STATUS_LABEL[m.status] ?? m.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
