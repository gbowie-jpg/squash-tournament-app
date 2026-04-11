'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useTournament } from '@/lib/useTournament';
import { createClient } from '@/lib/supabase/client';
import type { Player } from '@/lib/supabase/types';
import TournamentBottomNav from '@/components/layout/TournamentBottomNav';

export default function PlayerLookup({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
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
    return <div className="flex items-center justify-center min-h-screen text-zinc-600">Loading…</div>;
  }

  const filtered = search
    ? players.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
    : players;

  const draws = [...new Set(filtered.map((p) => p.draw || 'Unassigned'))].sort();

  return (
    <div className="min-h-screen bg-zinc-50 pb-20 md:pb-0">
      <header className="bg-white border-b border-zinc-200 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 pt-3 pb-4">
          <Link href={`/t/${slug}`} className="text-xs text-zinc-500 hover:text-zinc-800 flex items-center gap-1 mb-0.5">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            {tournament.name}
          </Link>
          <h1 className="text-lg font-bold tracking-tight mb-3">Find My Matches</h1>
          <input
            type="search"
            placeholder="Search by name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full border border-zinc-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-zinc-50"
            autoFocus
          />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-4">
        {loading ? (
          <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className={`flex items-center gap-3 px-4 py-3.5 animate-pulse ${i > 1 ? 'border-t border-zinc-100' : ''}`}>
                <div className="w-7 h-7 rounded-full bg-zinc-100" />
                <div className="flex-1">
                  <div className="h-4 bg-zinc-100 rounded w-32 mb-1" />
                  <div className="h-3 bg-zinc-100 rounded w-20" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-4xl mb-3">🔍</p>
            <p className="text-zinc-500">
              {search ? 'No players match your search.' : 'No players registered yet.'}
            </p>
          </div>
        ) : (
          draws.map((draw) => (
            <div key={draw} className="mb-5">
              <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2 px-1">{draw}</h2>
              <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden">
                {filtered
                  .filter((p) => (p.draw || 'Unassigned') === draw)
                  .map((p, i) => (
                    <Link
                      key={p.id}
                      href={`/t/${slug}/player/${p.id}`}
                      className={`flex items-center gap-3 px-4 py-3.5 hover:bg-zinc-50 active:bg-zinc-100 transition-colors ${
                        i > 0 ? 'border-t border-zinc-100' : ''
                      }`}
                    >
                      {p.seed ? (
                        <span className="w-7 h-7 rounded-full bg-zinc-100 text-zinc-600 text-xs font-bold flex items-center justify-center flex-shrink-0">
                          {p.seed}
                        </span>
                      ) : (
                        <span className="w-7 h-7 rounded-full bg-zinc-50 flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{p.name}</p>
                        {p.club && <p className="text-xs text-zinc-500 truncate">{p.club}</p>}
                      </div>
                      <svg className="w-4 h-4 text-zinc-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </Link>
                  ))}
              </div>
            </div>
          ))
        )}
      </main>

      <TournamentBottomNav slug={slug} />
    </div>
  );
}
