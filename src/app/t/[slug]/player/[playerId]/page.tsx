'use client';

import { use } from 'react';
import Link from 'next/link';
import { useTournament } from '@/lib/useTournament';
import { useRealtimeMatches } from '@/lib/realtime/hooks';
import { formatScore } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import { useState, useEffect } from 'react';
import type { Player, MatchWithDetails, Profile } from '@/lib/supabase/types';

const STATUS_LABELS: Record<string, { text: string; color: string }> = {
  in_progress: { text: 'Playing NOW', color: 'bg-green-600 text-white' },
  on_deck: { text: 'ON DECK', color: 'bg-amber-500 text-white' },
  scheduled: { text: 'Upcoming', color: 'bg-blue-100 text-blue-700' },
  completed: { text: 'Completed', color: 'bg-zinc-100 text-zinc-600' },
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
  const [playerProfile, setPlayerProfile] = useState<Profile | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    if (!tournament) return;
    const supabase = createClient();

    supabase
      .from('players')
      .select('*')
      .eq('id', playerId)
      .single()
      .then(({ data }) => {
        const playerData = data as Player | null;
        setPlayer(playerData);
        if (playerData?.email) {
          supabase
            .from('profiles')
            .select('*')
            .eq('email', playerData.email)
            .maybeSingle()
            .then(({ data: profile }) => setPlayerProfile(profile as Profile | null));
        }
      });

    supabase.auth.getUser().then(({ data: { user } }) => setCurrentUserId(user?.id ?? null));
  }, [tournament, playerId]);

  if (tLoading || !tournament) {
    return <div className="flex items-center justify-center min-h-screen text-zinc-600">Loading…</div>;
  }

  const playerMatches = matches
    .filter((m) => m.player1_id === playerId || m.player2_id === playerId)
    .sort((a, b) => {
      const order = ['in_progress', 'on_deck', 'scheduled', 'completed', 'walkover', 'cancelled'];
      return order.indexOf(a.status) - order.indexOf(b.status);
    });

  const activeMatch = playerMatches.find((m) => m.status === 'in_progress' || m.status === 'on_deck');
  const displayName = playerProfile?.full_name || player?.name || 'Loading…';
  const displayClub = playerProfile?.club || player?.club;
  const photo = playerProfile?.photo_url;

  return (
    <div className="min-h-screen bg-zinc-50">
      {/* Header */}
      <header className="bg-white border-b border-zinc-200">
        <div className="max-w-2xl mx-auto px-4 pt-4 pb-5">
          <Link href={`/t/${slug}/players`} className="text-sm text-zinc-500 hover:text-zinc-800 flex items-center gap-1 mb-3">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            All Players
          </Link>

          <div className="flex items-center gap-4">
            {photo ? (
              <img
                src={photo}
                alt={displayName}
                className="w-14 h-14 rounded-full object-cover border-2 border-zinc-200 flex-shrink-0"
              />
            ) : (
              <div className="w-14 h-14 rounded-full bg-zinc-200 flex items-center justify-center text-xl font-bold text-zinc-500 flex-shrink-0 select-none">
                {displayName[0]?.toUpperCase() ?? '?'}
              </div>
            )}

            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold tracking-tight truncate">{displayName}</h1>
              <div className="flex flex-wrap items-center gap-2 mt-0.5">
                {displayClub && <span className="text-sm text-zinc-500">{displayClub}</span>}
                {playerProfile?.squash_ranking && (
                  <span className="text-xs font-medium bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                    Rating: {playerProfile.squash_ranking}
                  </span>
                )}
              </div>
              {playerProfile?.bio && (
                <p className="text-xs text-zinc-500 mt-1 line-clamp-2">{playerProfile.bio}</p>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-5">
        {/* Active status banner */}
        {activeMatch && (
          <div className={`rounded-2xl p-4 mb-5 ${activeMatch.status === 'in_progress' ? 'bg-green-600' : 'bg-amber-500'}`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-white font-bold text-base">
                  {activeMatch.status === 'in_progress' ? '🎾 Playing NOW' : '⏳ ON DECK'}
                </p>
                {activeMatch.court && (
                  <p className="text-white/90 text-sm mt-0.5">📍 {activeMatch.court.name}</p>
                )}
                <p className="text-white/80 text-sm mt-0.5">
                  vs {activeMatch.player1_id === playerId ? activeMatch.player2?.name : activeMatch.player1?.name}
                </p>
                {activeMatch.scores && activeMatch.scores.length > 0 && (
                  <p className="text-white font-mono font-bold mt-1">{formatScore(activeMatch.scores)}</p>
                )}
              </div>
              {currentUserId && (
                <Link
                  href={`/t/${slug}/match/${activeMatch.id}/score`}
                  className="flex-shrink-0 bg-white/20 hover:bg-white/30 text-white font-semibold text-sm px-3 py-2 rounded-xl transition-colors"
                >
                  Score ›
                </Link>
              )}
            </div>
          </div>
        )}

        {/* Match list */}
        {mLoading ? (
          <p className="text-zinc-500 text-center py-12">Loading matches…</p>
        ) : playerMatches.length === 0 ? (
          <p className="text-zinc-500 text-center py-12">No matches scheduled yet.</p>
        ) : (
          <div className="space-y-2.5">
            {playerMatches.map((m: MatchWithDetails) => {
              const opponent = m.player1_id === playerId ? m.player2 : m.player1;
              const statusInfo = STATUS_LABELS[m.status];
              const didWin = m.winner_id === playerId;
              const didLose = m.winner_id && m.winner_id !== playerId;
              const canScore = currentUserId && (m.status === 'in_progress' || m.status === 'on_deck');

              return (
                <div key={m.id} className="bg-white border border-zinc-200 rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${statusInfo.color}`}>
                      {statusInfo.text}
                    </span>
                    <div className="flex items-center gap-2 text-xs text-zinc-500">
                      {m.draw && <span>{m.draw}</span>}
                      {m.round && <span>· {m.round}</span>}
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate">
                        vs {opponent?.name || 'TBD'}
                        {didWin && <span className="text-green-600 ml-2 text-sm font-bold">W</span>}
                        {didLose && <span className="text-red-500 ml-2 text-sm font-bold">L</span>}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-zinc-500">
                        {m.court && <span>📍 {m.court.name}</span>}
                        {m.scheduled_time && (
                          <span>
                            🕐 {new Date(m.scheduled_time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                          </span>
                        )}
                      </div>
                      {m.scores && m.scores.length > 0 && (
                        <p className="text-sm font-mono text-zinc-600 mt-1">{formatScore(m.scores)}</p>
                      )}
                    </div>

                    {canScore && (
                      <Link
                        href={`/t/${slug}/match/${m.id}/score`}
                        className="flex-shrink-0 bg-zinc-900 text-white text-xs font-semibold px-3 py-2 rounded-xl hover:bg-zinc-700 transition-colors"
                      >
                        Score
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="flex items-center gap-1.5 justify-center mt-8 pb-6">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-xs text-zinc-500">Updates automatically</span>
        </div>
      </main>
    </div>
  );
}
