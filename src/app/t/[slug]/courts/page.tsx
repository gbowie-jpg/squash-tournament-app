'use client';

import { use } from 'react';
import Link from 'next/link';
import { useTournament } from '@/lib/useTournament';
import { useRealtimeMatches, useRealtimeCourts } from '@/lib/realtime/hooks';
import { formatScore } from '@/lib/utils';
import type { Court, MatchWithDetails } from '@/lib/supabase/types';
import TournamentBottomNav from '@/components/layout/TournamentBottomNav';
import { ChevronLeft } from 'lucide-react';
import PullToRefresh from '@/components/PullToRefresh';
import RefreshButton from '@/components/RefreshButton';
import ThemeToggle from '@/components/ThemeToggle';

const COURT_STATUS_COLORS: Record<string, string> = {
  available: 'border-green-400 dark:border-green-700 bg-green-50 dark:bg-green-950/30',
  in_use: 'border-amber-400 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30',
  maintenance: 'border-[var(--border)] bg-[var(--surface-card)]',
};

const COURT_STATUS_DOT: Record<string, string> = {
  available: 'bg-green-500',
  in_use: 'bg-amber-500 animate-pulse',
  maintenance: 'bg-[var(--text-muted)]',
};

export default function CourtBoard({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const { tournament, loading: tLoading } = useTournament(slug);
  const { matches, loading: mLoading } = useRealtimeMatches(tournament?.id ?? '');
  const { courts, loading: cLoading } = useRealtimeCourts(tournament?.id ?? '');

  if (tLoading || !tournament) {
    return <div className="flex items-center justify-center min-h-screen text-[var(--text-secondary)]">Loading…</div>;
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
    <PullToRefresh>
    <div className="min-h-screen bg-[var(--surface)] pb-20 md:pb-0">
      <header className="bg-[var(--surface-card)] border-b border-[var(--border)] sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <Link href={`/t/${slug}`} className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center gap-1 mb-0.5">
              <ChevronLeft className="w-3.5 h-3.5" /> {tournament.name}
            </Link>
            <h1 className="text-lg font-bold tracking-tight text-[var(--text-primary)]">Court Board</h1>
          </div>
          <div className="flex items-center gap-1">
            <span className="flex items-center gap-1.5 mr-1">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs text-[var(--text-secondary)] font-medium">Live</span>
            </span>
            <ThemeToggle />
            <RefreshButton />
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-4">
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-[var(--surface-card)] border border-[var(--border)] rounded-2xl p-5 animate-pulse">
                <div className="h-5 bg-surface rounded w-24 mb-4" />
                <div className="h-4 bg-surface rounded w-full mb-2" />
                <div className="h-4 bg-surface rounded w-3/4" />
              </div>
            ))}
          </div>
        ) : courts.length === 0 ? (
          <p className="text-[var(--text-secondary)] text-center py-16">No courts set up yet.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {courts.map((court) => {
              const { current, next } = getCourtMatches(court);
              return (
                <div key={court.id} className={`border-2 rounded-2xl p-4 transition-all ${COURT_STATUS_COLORS[court.status]}`}>
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="font-bold text-base text-[var(--text-primary)]">{court.name}</h2>
                    <span className={`w-3 h-3 rounded-full ${COURT_STATUS_DOT[court.status]}`} />
                  </div>

                  {current ? (
                    <div className="mb-3">
                      <p className="text-xs font-semibold text-green-700 dark:text-green-400 uppercase tracking-wider mb-1.5">Now Playing</p>
                      <MatchDisplay match={current} slug={slug} />
                    </div>
                  ) : court.status === 'maintenance' ? (
                    <p className="text-sm text-[var(--text-secondary)] mb-3">Under maintenance</p>
                  ) : (
                    <p className="text-sm text-[var(--text-secondary)] mb-3">Court available</p>
                  )}

                  {next && (
                    <div className="pt-3 border-t border-border/60">
                      <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider mb-1.5">
                        {next.status === 'on_deck' ? 'On Deck' : 'Up Next'}
                      </p>
                      <MatchDisplay match={next} compact slug={slug} />
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
    </PullToRefresh>
  );
}

function MatchDisplay({ match: m, compact, slug }: { match: MatchWithDetails; compact?: boolean; slug: string }) {
  return (
    <Link href={`/t/${slug}/match/${m.id}`} className="block group">
      <p className={`font-semibold text-[var(--text-primary)] group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors ${compact ? 'text-sm' : ''}`}>
        {m.player1?.name || 'TBD'} <span className="text-[var(--text-muted)] font-normal">vs</span> {m.player2?.name || 'TBD'}
      </p>
      <div className="flex items-center gap-2 mt-0.5">
        {m.draw && <span className="text-xs text-[var(--text-secondary)]">{m.draw}</span>}
        {m.round && <span className="text-xs text-[var(--text-secondary)]">· {m.round}</span>}
      </div>
      {m.scores && m.scores.length > 0 && (
        <p className="text-sm font-mono font-semibold mt-1 text-[var(--text-primary)]">{formatScore(m.scores)}</p>
      )}
      {!compact && m.scheduled_time && (
        <p className="text-xs text-[var(--text-secondary)] mt-1">
          {new Date(m.scheduled_time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
        </p>
      )}
    </Link>
  );
}
