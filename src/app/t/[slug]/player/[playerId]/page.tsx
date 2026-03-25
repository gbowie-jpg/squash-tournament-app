'use client';

import { use } from 'react';
import Link from 'next/link';
import { useTournament } from '@/lib/useTournament';
import { useRealtimeMatches } from '@/lib/realtime/hooks';
import { formatScore } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import { useState, useEffect } from 'react';
import type { Player, MatchWithDetails } from '@/lib/supabase/types';

const STATUS_LABELS: Record<string, { text: string; color: string }> = {
  in_progress: { text: "You're playing NOW", color: 'bg-green-600 text-white' },
  on_deck: { text: "You're ON DECK", color: 'bg-amber-500 text-white' },
  scheduled: { text: 'Upcoming', color: 'bg-blue-100 text-blue-700' },
  completed: { text: 'Completed', color: 'bg-zinc-100 text-zinc-500' },
  walkover: { text: 'Walkover', color: 'bg-purple-100 text-purple-600' },
  cancelled: { text: 'Cancelled', color: 'bg-red-100 text-red-500' },
};

export default function MyMatches({
  params,
}: {
  params: Promise<{ slug: string; playerId: string }>;
}) {
  const { slug, playerId } = use(params);
  const { tournament, loading: tLoading } = useTournament(slug);
  const { matches, loading: mLoading } = useRealtimeMatches(tournament?.id ?? '');
  const [player, setPlayer] = useState<Player | null>(null);

  useEffect(() => {
    if (!tournament) return;
    const supabase = createClient();
    supabase
      .from('players')
      .select('*')
      .eq('id', playerId)
      .single()
      .then(({ data }) => setPlayer(data as Player | null));
  }, [tournament, playerId]);

  if (tLoading || !tournament) {
    return <div className="flex items-center justify-center min-h-screen text-zinc-400">Loading...</div>;
  }

  const playerMatches = matches
    .filter((m) => m.player1_id === playerId || m.player2_id === playerId)
    .sort((a, b) => {
      const order = ['in_progress', 'on_deck', 'scheduled', 'completed', 'walkover', 'cancelled'];
      return order.indexOf(a.status) - order.indexOf(b.status);
    });

  const activeMatch = playerMatches.find((m) => m.status === 'in_progress' || m.status === 'on_deck');

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="bg-white border-b border-zinc-200">
        <div className="max-w-2xl mx-auto px-4 py-6">
          <Link href={`/t/${slug}/players`} className="text-sm text-zinc-400 hover:text-zinc-600">&larr; All Players</Link>
          <h1 className="text-2xl font-bold tracking-tight mt-2">{player?.name || 'Loading...'}</h1>
          {player?.club && <p className="text-zinc-400 text-sm">{player.club}</p>}
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        {/* Active status banner */}
        {activeMatch && (
          <div className={`rounded-xl p-5 mb-6 ${activeMatch.status === 'in_progress' ? 'bg-green-600' : 'bg-amber-500'}`}>
            <p className="text-white font-bold text-lg">
              {activeMatch.status === 'in_progress' ? "You're playing NOW" : "You're ON DECK"}
            </p>
            {activeMatch.court && (
              <p className="text-white/90 text-sm mt-1">📍 {activeMatch.court.name}</p>
            )}
            <p className="text-white/80 text-sm mt-1">
              vs {activeMatch.player1_id === playerId ? activeMatch.player2?.name : activeMatch.player1?.name}
            </p>
            {activeMatch.scores && activeMatch.scores.length > 0 && (
              <p className="text-white font-mono mt-2">{formatScore(activeMatch.scores)}</p>
            )}
          </div>
        )}

        {/* All matches */}
        {mLoading ? (
          <p className="text-zinc-400 text-center py-12">Loading matches...</p>
        ) : playerMatches.length === 0 ? (
          <p className="text-zinc-400 text-center py-12">No matches scheduled yet.</p>
        ) : (
          <div className="space-y-3">
            {playerMatches.map((m) => {
              const opponent = m.player1_id === playerId ? m.player2 : m.player1;
              const statusInfo = STATUS_LABELS[m.status];
              const didWin = m.winner_id === playerId;
              const didLose = m.winner_id && m.winner_id !== playerId;

              return (
                <div key={m.id} className="bg-white border border-zinc-200 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${statusInfo.color}`}>
                      {statusInfo.text}
                    </span>
                    <div className="flex items-center gap-2 text-xs text-zinc-400">
                      {m.draw && <span>{m.draw}</span>}
                      {m.round && <span>&middot; {m.round}</span>}
                    </div>
                  </div>
                  <p className="font-semibold">
                    vs {opponent?.name || 'TBD'}
                    {didWin && <span className="text-green-600 ml-2 text-sm">W</span>}
                    {didLose && <span className="text-red-500 ml-2 text-sm">L</span>}
                  </p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-zinc-400">
                    {m.court && <span>📍 {m.court.name}</span>}
                    {m.scheduled_time && (
                      <span>
                        🕐 {new Date(m.scheduled_time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                      </span>
                    )}
                  </div>
                  {m.scores && m.scores.length > 0 && (
                    <p className="text-sm font-mono text-zinc-600 mt-2">{formatScore(m.scores)}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="flex items-center gap-1.5 justify-center mt-8">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-xs text-zinc-400">Updates automatically</span>
        </div>
      </main>
    </div>
  );
}
