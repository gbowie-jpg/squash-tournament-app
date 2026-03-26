'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useTournament } from '@/lib/useTournament';
import { createClient } from '@/lib/supabase/client';
import type { Player } from '@/lib/supabase/types';

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
    return <div className="flex items-center justify-center min-h-screen text-zinc-600">Loading...</div>;
  }

  const filtered = search
    ? players.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
    : players;

  const draws = [...new Set(filtered.map((p) => p.draw || 'Unassigned'))].sort();

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="bg-white border-b border-zinc-200">
        <div className="max-w-3xl mx-auto px-4 py-6">
          <Link href={`/t/${slug}`} className="text-sm text-zinc-600 hover:text-zinc-800">&larr; {tournament.name}</Link>
          <h1 className="text-2xl font-bold tracking-tight mt-2">Find My Matches</h1>
          <input
            type="search"
            placeholder="Search by name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="mt-4 w-full border border-zinc-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
            autoFocus
          />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6">
        {loading ? (
          <p className="text-zinc-600 text-center py-12">Loading...</p>
        ) : filtered.length === 0 ? (
          <p className="text-zinc-600 text-center py-12">
            {search ? 'No players match your search.' : 'No players registered yet.'}
          </p>
        ) : (
          draws.map((draw) => (
            <div key={draw} className="mb-6">
              <h2 className="text-sm font-semibold text-zinc-600 uppercase tracking-wider mb-3">{draw}</h2>
              <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
                {filtered
                  .filter((p) => (p.draw || 'Unassigned') === draw)
                  .map((p, i) => (
                    <Link
                      key={p.id}
                      href={`/t/${slug}/player/${p.id}`}
                      className={`flex items-center justify-between px-4 py-3.5 hover:bg-zinc-50 transition-colors ${
                        i > 0 ? 'border-t border-zinc-100' : ''
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {p.seed && (
                          <span className="w-6 h-6 rounded-full bg-zinc-100 text-zinc-600 text-xs font-medium flex items-center justify-center">
                            {p.seed}
                          </span>
                        )}
                        <div>
                          <p className="text-sm font-medium">{p.name}</p>
                          {p.club && <p className="text-xs text-zinc-600">{p.club}</p>}
                        </div>
                      </div>
                      <span className="text-zinc-600 text-sm">&rsaquo;</span>
                    </Link>
                  ))}
              </div>
            </div>
          ))
        )}
      </main>
    </div>
  );
}
