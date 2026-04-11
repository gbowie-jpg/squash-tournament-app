'use client';

import { use } from 'react';
import Link from 'next/link';
import { useTournament } from '@/lib/useTournament';
import { useRealtimeMatches, useRealtimeCourts } from '@/lib/realtime/hooks';
import { formatScore } from '@/lib/utils';
import type { Court, MatchWithDetails } from '@/lib/supabase/types';
import TournamentBottomNav from '@/components/layout/TournamentBottomNav';

const COURT_STATUS_COLORS: Record<string, string> = {
  available: 'border-green-400 bg-green-50',
  in_use: 'border-amber-400 bg-amber-50',
  maintenance: 'border-zinc-300 bg-zinc-100',
};

const COURT_STATUS_DOT: Record<string, string> = {
  available: 'bg-green-500',
  in_use: 'bg-amber-500 animate-pulse',
  maintenance: 'bg-zinc-400',
};

export default function CourtBoard({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const { tournament, loading: tLoading } = useTournament(slug);
  const { matches, loading: mLoading } = useRealtimeMatches(tournament?.id ?? '');
  const { courts, loading: cLoading } = useRealtimeCourts(tournament?.id ?? '');

  if (tLoading || !tournament) {
    return <div className="flex items-center justify-center min-h-screen text-zinc-600">Loading…</div>;
  }

  const loading = mLoading || cLoading;

  const getCourtMatches = (court: Court) => {
    const courtMatches = matches.filter((m) => m.court_id === court.id);
    const current = courtMatches.find((m) => m.status === 'in_progress');
    const onDeck = courtMatches.find((m) => m.status === 'on_deck');
    const nextScheduled = courtMatches.find((m) => m.status === 'scheduled');
    return { current, next: onDeck || nextScheduled };
  };

  return (
    <div className="min-h-screen bg-zinc-50 pb-20 md:pb-0">
      <header className="bg-white border-b border-zinc-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <Link href={`/t/${slug}`} className="text-xs text-zinc-500 hover:text-zinc-800 flex items-center gap-1 mb-0.5">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              {tournament.name}
            </Link>
            <h1 className="text-lg font-bold tracking-tight">Court Board</h1>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs text-zinc-500 font-medium">Live</span>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-4">
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-white border border-zinc-200 rounded-2xl p-5 animate-pulse">
                <div className="h-5 bg-zinc-100 rounded w-24 mb-4" />
                <div className="h-4 bg-zinc-100 rounded w-full mb-2" />
                <div className="h-4 bg-zinc-100 rounded w-3/4" />
              </div>
            ))}
          </div>
        ) : courts.length === 0 ? (
          <p className="text-zinc-500 text-center py-16">No courts set up yet.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {courts.map((court) => {
              const { current, next } = getCourtMatches(court);
              return (
                <div
                  key={court.id}
                  className={`border-2 rounded-2xl p-4 transition-all ${COURT_STATUS_COLORS[court.status]}`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="font-bold text-base">{court.name}</h2>
                    <span className={`w-3 h-3 rounded-full ${COURT_STATUS_DOT[court.status]}`} />
                  </div>

                  {current ? (
                    <div className="mb-3">
                      <p className="text-xs font-semibold text-green-700 uppercase tracking-wider mb-1.5">Now Playing</p>
                      <MatchDisplay match={current} />
                    </div>
                  ) : court.status === 'maintenance' ? (
                    <p className="text-sm text-zinc-500 mb-3">Under maintenance</p>
                  ) : (
                    <p className="text-sm text-zinc-500 mb-3">Court available</p>
                  )}

                  {next && (
                    <div className="pt-3 border-t border-zinc-200/60">
                      <p className="text-xs font-semibold text-amber-600 uppercase tracking-wider mb-1.5">
                        {next.status === 'on_deck' ? 'On Deck' : 'Up Next'}
                      </p>
                      <MatchDisplay match={next} compact />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      <TournamentBottomNav slug={slug} />
    </div>
  );
}

function MatchDisplay({ match: m, compact }: { match: MatchWithDetails; compact?: boolean }) {
  return (
    <div>
      <p className={`font-semibold ${compact ? 'text-sm' : ''}`}>
        {m.player1?.name || 'TBD'} <span className="text-zinc-400 font-normal">vs</span> {m.player2?.name || 'TBD'}
      </p>
      <div className="flex items-center gap-2 mt-0.5">
        {m.draw && <span className="text-xs text-zinc-500">{m.draw}</span>}
        {m.round && <span className="text-xs text-zinc-500">· {m.round}</span>}
      </div>
      {m.scores && m.scores.length > 0 && (
        <p className="text-sm font-mono font-semibold mt-1">{formatScore(m.scores)}</p>
      )}
      {!compact && m.scheduled_time && (
        <p className="text-xs text-zinc-500 mt-1">
          {new Date(m.scheduled_time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
        </p>
      )}
    </div>
  );
}
