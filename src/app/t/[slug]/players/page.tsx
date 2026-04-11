'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useTournament } from '@/lib/useTournament';
import { createClient } from '@/lib/supabase/client';
import type { Player } from '@/lib/supabase/types';
import TournamentBottomNav from '@/components/layout/TournamentBottomNav';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';
import PullToRefresh from '@/components/PullToRefresh';
import RefreshButton from '@/components/RefreshButton';

export default function PlayerLookup({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const { tournament, loading: tLoading } = useTournament(slug);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!tournament) return;
    const supabase = createClient();
    supabase
      .from('players')
      .select('*')
      .eq('tournament_id', tournament.id)
      .order('draw')
      .order('seed', { nullsFirst: false })
      .order('name')
      .then(({ data }) => {
        setPlayers((data as Player[]) ?? []);
        setLoading(false);
      });
  }, [tournament]);

  if (tLoading || !tournament) {
    return <div className="flex items-center justify-center min-h-screen text-[var(--text-secondary)]">Loading…</div>;
  }

  const filtered = search
    ? players.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
    : players;

  const draws = [...new Set(filtered.map((p) => p.draw || 'Unassigned'))].sort();

  return (
    <PullToRefresh>
    <div className="min-h-screen bg-[var(--surface)] pb-20 md:pb-0">
      <header className="bg-[var(--surface-card)] border-b border-[var(--border)] sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 pt-3 pb-4">
          <div className="flex items-center justify-between mb-0.5">
            <Link href={`/t/${slug}`} className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center gap-1">
              <ChevronLeft className="w-3.5 h-3.5" /> {tournament.name}
            </Link>
            <RefreshButton />
          </div>
          <h1 className="text-lg font-bold tracking-tight mb-3 text-[var(--text-primary)]">Find My Matches</h1>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" strokeWidth={1.5} />
            <input
              type="search"
              placeholder="Search by name…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full border border-[var(--border)] rounded-xl pl-9 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-[var(--surface)] text-[var(--text-primary)]"
              autoFocus
            />
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-4">
        {loading ? (
          <div className="bg-[var(--surface-card)] border border-[var(--border)] rounded-2xl overflow-hidden">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className={`flex items-center gap-3 px-4 py-3.5 animate-pulse ${i > 1 ? 'border-t border-[var(--border)]' : ''}`}>
                <div className="w-7 h-7 rounded-full bg-zinc-100 dark:bg-zinc-800" />
                <div className="flex-1">
                  <div className="h-4 bg-zinc-100 dark:bg-zinc-800 rounded w-32 mb-1" />
                  <div className="h-3 bg-zinc-100 dark:bg-zinc-800 rounded w-20" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <Search className="w-8 h-8 text-zinc-300 dark:text-zinc-700 mx-auto mb-3" strokeWidth={1.5} />
            <p className="text-[var(--text-secondary)]">
              {search ? 'No players match your search.' : 'No players registered yet.'}
            </p>
          </div>
        ) : (
          draws.map((draw) => (
            <div key={draw} className="mb-5">
              <h2 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2 px-1">{draw}</h2>
              <div className="bg-[var(--surface-card)] border border-[var(--border)] rounded-2xl overflow-hidden">
                {filtered
                  .filter((p) => (p.draw || 'Unassigned') === draw)
                  .map((p, i) => (
                    <Link
                      key={p.id}
                      href={`/t/${slug}/player/${p.id}`}
                      className={`flex items-center gap-3 px-4 py-3.5 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 active:bg-zinc-100 dark:active:bg-zinc-800 transition-colors ${
                        i > 0 ? 'border-t border-[var(--border)]' : ''
                      }`}
                    >
                      {p.seed ? (
                        <span className="w-7 h-7 rounded-full bg-zinc-100 dark:bg-zinc-800 text-[var(--text-secondary)] text-xs font-bold flex items-center justify-center flex-shrink-0">
                          {p.seed}
                        </span>
                      ) : (
                        <span className="w-7 h-7 rounded-full bg-zinc-50 dark:bg-zinc-800/50 flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate text-[var(--text-primary)]">{p.name}</p>
                        {p.club && <p className="text-xs text-[var(--text-secondary)] truncate">{p.club}</p>}
                      </div>
                      <ChevronRight className="w-4 h-4 text-zinc-300 dark:text-zinc-600 flex-shrink-0" />
                    </Link>
                  ))}
              </div>
            </div>
          ))
        )}
      </main>

      <TournamentBottomNav slug={slug} />
    </div>
    </PullToRefresh>
  );
}
