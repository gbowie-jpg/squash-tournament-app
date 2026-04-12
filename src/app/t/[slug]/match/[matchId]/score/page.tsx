'use client';

import { use, useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import type { MatchWithDetails, GameScore } from '@/lib/supabase/types';

type Params = { slug: string; matchId: string };

export default function ScorePage({ params }: { params: Promise<Params> }) {
  const { slug, matchId } = use(params);
  const router = useRouter();

  const [match, setMatch] = useState<MatchWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);
  const [canScore, setCanScore] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [scores, setScores] = useState<GameScore[]>([]);
  const [currentGame, setCurrentGame] = useState(0);
  const [confirmWinner, setConfirmWinner] = useState<'p1' | 'p2' | null>(null);

  // Serve/side state
  const [server, setServer] = useState<'p1' | 'p2' | null>(null);
  const [leftPlayer, setLeftPlayer] = useState<'p1' | 'p2'>('p1');
  const [setupDone, setSetupDone] = useState(false);

  useEffect(() => {
    const supabase = createClient();

    async function load() {
      const { data: tRow } = await supabase.from('tournaments').select('id').eq('slug', slug).single();
      const t = tRow as { id: string } | null;
      if (!t) { router.push(`/t/${slug}`); return; }

      const res = await fetch(`/api/tournaments/${t.id}/matches/${matchId}/score`);
      if (!res.ok) { router.push(`/t/${slug}`); return; }
      const data: MatchWithDetails = await res.json();
      setMatch(data);

      const existing: GameScore[] = Array.isArray(data.scores) && data.scores.length > 0
        ? data.scores : [{ p1: 0, p2: 0 }];
      setScores(existing);
      const lastIncomplete = existing.findIndex(g => g.p1 < 11 && g.p2 < 11);
      setCurrentGame(lastIncomplete >= 0 ? lastIncomplete : existing.length - 1);

      // If match already in progress, mark setup done
      if (data.status === 'in_progress') setSetupDone(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setAuthChecked(true); setLoading(false); return; }

      const patchTest = await fetch(`/api/tournaments/${t.id}/matches/${matchId}/score`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ _check: true }),
      });
      setCanScore(patchTest.status !== 403 && patchTest.status !== 401);
      setAuthChecked(true);
      setLoading(false);
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId, slug]);

  const saveScores = useCallback(async (newScores: GameScore[], newStatus?: string, winnerId?: string) => {
    if (!match) return;
    setSaving(true);
    setError('');
    const supabase = createClient();
    const { data: tRow2 } = await supabase.from('tournaments').select('id').eq('slug', slug).single();
    const t = tRow2 as { id: string } | null;
    if (!t) { setSaving(false); return; }

    const body: Record<string, unknown> = { scores: newScores };
    if (newStatus) body.status = newStatus;
    if (winnerId) body.winner_id = winnerId;

    const res = await fetch(`/api/tournaments/${t.id}/matches/${matchId}/score`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    setSaving(false);
    if (!res.ok) {
      const d = await res.json();
      setError(d.error ?? 'Save failed');
    } else {
      const updated: MatchWithDetails = await res.json();
      setMatch(updated);
    }
  }, [match, matchId, slug]);

  function adjustScore(player: 'p1' | 'p2', delta: number) {
    if (!canScore) return;
    const updated = scores.map((g, i) => {
      if (i !== currentGame) return g;
      return { ...g, [player]: Math.max(0, g[player] + delta) };
    });
    setScores(updated);
    saveScores(updated);
    // PAR scoring: winner of rally becomes server
    if (delta === 1) setServer(player);
  }

  function addGame() {
    if (scores.length >= 5) return;
    const newScores = [...scores, { p1: 0, p2: 0 }];
    setScores(newScores);
    setCurrentGame(newScores.length - 1);
    saveScores(newScores);
    // Loser of previous game serves next (switch server on new game)
    setServer(prev => prev === 'p1' ? 'p2' : 'p1');
  }

  function startMatch() {
    const supabase = createClient();
    supabase.from('tournaments').select('id').eq('slug', slug).single().then(({ data: tRow3 }) => {
      const t = tRow3 as { id: string } | null;
      if (!t || !match) return;
      fetch(`/api/tournaments/${t.id}/matches/${matchId}/score`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'in_progress', scores: [{ p1: 0, p2: 0 }] }),
      }).then(r => r.json()).then(updated => {
        setMatch(updated);
        setScores([{ p1: 0, p2: 0 }]);
        setCurrentGame(0);
        setSetupDone(true);
      });
    });
  }

  function declareWinner(player: 'p1' | 'p2') {
    if (!match) return;
    const winnerId = player === 'p1' ? match.player1_id : match.player2_id;
    saveScores(scores, 'completed', winnerId ?? undefined);
    setConfirmWinner(null);
  }

  function countGamesWon(player: 'p1' | 'p2') {
    return scores.filter(g => {
      const other: 'p1' | 'p2' = player === 'p1' ? 'p2' : 'p1';
      return g[player] > g[other] && (g[player] >= 11 || g[other] >= 10);
    }).length;
  }

  function serviceBox(srv: 'p1' | 'p2') {
    const gs = scores[currentGame] ?? { p1: 0, p2: 0 };
    const srvScore = gs[srv];
    return srvScore % 2 === 0 ? 'Right box' : 'Left box';
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-zinc-600 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  if (!match) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center gap-4 text-white px-4">
        <p className="text-zinc-400">Match not found.</p>
        <Link href={`/t/${slug}`} className="text-sm underline text-zinc-400">Back to tournament</Link>
      </div>
    );
  }

  if (authChecked && !canScore) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center gap-4 px-4 text-center">
        <div className="w-14 h-14 bg-zinc-800 rounded-full flex items-center justify-center mb-2">
          <svg className="w-7 h-7 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <h1 className="text-white text-xl font-bold">Sign in to score</h1>
        <p className="text-zinc-400 text-sm max-w-xs">
          You must be a player in this match, an assigned referee, or a tournament organizer.
        </p>
        <Link href={`/login?redirect=/t/${slug}/match/${matchId}/score`} className="bg-white text-zinc-900 font-semibold px-6 py-3 rounded-xl text-sm">
          Sign In
        </Link>
        <Link href={`/t/${slug}/match/${matchId}`} className="text-sm text-zinc-500 mt-1">Back to match</Link>
      </div>
    );
  }

  const p1 = match.player1;
  const p2 = match.player2;
  const p1Games = countGamesWon('p1');
  const p2Games = countGamesWon('p2');
  const gs = scores[currentGame] ?? { p1: 0, p2: 0 };
  const isCompleted = match.status === 'completed' || match.status === 'walkover';
  const isNotStarted = match.status === 'scheduled' || match.status === 'on_deck';

  // Show setup screen before starting
  if (isNotStarted && canScore && !setupDone) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex flex-col select-none">
        {/* Header */}
        <div className="flex items-center px-4 pt-safe pt-4 pb-3">
          <Link href={`/t/${slug}/match/${matchId}`} className="text-zinc-400 hover:text-white p-1 -ml-1">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div className="flex-1 text-center">
            <p className="text-xs text-zinc-500 font-semibold uppercase tracking-wider">Match Setup</p>
            {match.draw && <p className="text-xs text-zinc-600 mt-0.5">{match.draw}{match.round ? ` · ${match.round}` : ''}</p>}
          </div>
          <div className="w-7" />
        </div>

        <div className="flex-1 px-4 pb-8 space-y-8 overflow-y-auto pt-4">
          {/* Who serves first */}
          <div>
            <p className="text-sm font-semibold text-zinc-300 uppercase tracking-wider text-center mb-4">Who serves first?</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setServer('p1')}
                className={`p-5 rounded-2xl font-bold text-lg transition-colors ${
                  server === 'p1' ? 'bg-blue-600 text-white ring-2 ring-blue-400' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                }`}
              >
                {p1?.name ?? 'Player 1'}
                {server === 'p1' && <div className="text-xs font-normal mt-1 text-blue-200">● Serves first</div>}
              </button>
              <button
                onClick={() => setServer('p2')}
                className={`p-5 rounded-2xl font-bold text-lg transition-colors ${
                  server === 'p2' ? 'bg-blue-600 text-white ring-2 ring-blue-400' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                }`}
              >
                {p2?.name ?? 'Player 2'}
                {server === 'p2' && <div className="text-xs font-normal mt-1 text-blue-200">● Serves first</div>}
              </button>
            </div>
          </div>

          {/* Court positions */}
          <div>
            <p className="text-sm font-semibold text-zinc-300 uppercase tracking-wider text-center mb-4">Starting positions</p>
            {/* Court diagram */}
            <div className="border-2 border-zinc-600 rounded-lg overflow-hidden mb-4">
              <div className="grid grid-cols-2 divide-x-2 divide-zinc-600">
                <button
                  onClick={() => setLeftPlayer('p1')}
                  className={`p-4 text-center transition-colors ${leftPlayer === 'p1' ? 'bg-blue-900/60' : 'bg-zinc-800/40 hover:bg-zinc-700/40'}`}
                >
                  <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Left</p>
                  <p className={`font-semibold text-sm ${leftPlayer === 'p1' ? 'text-blue-300' : 'text-zinc-400'}`}>
                    {leftPlayer === 'p1' ? p1?.name ?? 'P1' : p2?.name ?? 'P2'}
                  </p>
                </button>
                <button
                  onClick={() => setLeftPlayer('p2')}
                  className={`p-4 text-center transition-colors ${leftPlayer === 'p2' ? 'bg-amber-900/40' : 'bg-zinc-800/40 hover:bg-zinc-700/40'}`}
                >
                  <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Right</p>
                  <p className={`font-semibold text-sm ${leftPlayer === 'p2' ? 'text-amber-300' : 'text-zinc-400'}`}>
                    {leftPlayer === 'p2' ? p1?.name ?? 'P1' : p2?.name ?? 'P2'}
                  </p>
                </button>
              </div>
              <div className="bg-zinc-900 border-t-2 border-zinc-600 py-1.5 text-center">
                <p className="text-xs text-zinc-600 font-medium">↑ T-line / Front wall ↑</p>
              </div>
            </div>
            <p className="text-xs text-zinc-600 text-center">Tap to swap sides. Players switch sides each game.</p>
          </div>
        </div>

        {/* Start button */}
        <div className="px-4 pb-safe pb-8">
          <button
            onClick={startMatch}
            disabled={!server}
            className="w-full bg-green-600 active:bg-green-500 text-white font-bold py-5 rounded-2xl text-xl disabled:opacity-40 transition-colors"
          >
            Start Match
          </button>
          {!server && <p className="text-center text-xs text-zinc-600 mt-2">Select who serves first</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col select-none">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 pt-safe pt-4 pb-3">
        <Link href={`/t/${slug}/match/${matchId}`} className="text-zinc-400 hover:text-white p-1 -ml-1">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div className="text-center">
          <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider">
            {match.draw}{match.round ? ` · ${match.round}` : ''}
          </p>
          {match.court && (
            <p className="text-xs text-zinc-400 mt-0.5">{match.court.name}</p>
          )}
        </div>
        <div className="w-7" />
      </div>

      {/* Serve indicator bar (shows during play) */}
      {server && !isCompleted && !isNotStarted && (
        <div className="mx-4 mb-2 bg-zinc-800/60 rounded-xl px-3 py-1.5 flex items-center justify-between text-xs">
          <span className={`font-semibold ${server === 'p1' ? 'text-blue-400' : 'text-zinc-500'}`}>
            {server === 'p1' ? '● Serving' : ''}
          </span>
          <span className="text-zinc-500 font-medium">{serviceBox(server)}</span>
          <span className={`font-semibold ${server === 'p2' ? 'text-blue-400' : 'text-zinc-500'}`}>
            {server === 'p2' ? 'Serving ●' : ''}
          </span>
        </div>
      )}

      {/* Completed banner */}
      {isCompleted && (
        <div className="mx-4 mb-2 bg-zinc-800 rounded-xl px-4 py-2 text-center text-sm">
          {match.winner_id === match.player1_id
            ? <span><span className="text-yellow-400 font-bold">{p1?.name}</span> wins!</span>
            : <span><span className="text-yellow-400 font-bold">{p2?.name}</span> wins!</span>}
          <span className="text-zinc-400 ml-2">Match complete</span>
        </div>
      )}

      {/* Main scoring area */}
      <div className="flex-1 flex flex-col">
        {/* Players + game scores */}
        <div className="grid grid-cols-2 gap-3 px-4 mb-4">
          {/* Player 1 */}
          <div className={`rounded-2xl p-4 flex flex-col items-center gap-1 relative ${
            match.winner_id === match.player1_id ? 'bg-yellow-500/20 border border-yellow-500/40' : 'bg-zinc-800'
          }`}>
            {server === 'p1' && !isCompleted && (
              <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-blue-400" title="Serving" />
            )}
            <p className="text-xs text-zinc-400 font-medium truncate w-full text-center">{p1?.name ?? 'Player 1'}</p>
            {p1?.club && <p className="text-xs text-zinc-500 truncate">{p1.club}</p>}
            <div className="text-6xl font-black tabular-nums mt-1">{p1Games}</div>
            <p className="text-xs text-zinc-500">games</p>
            {match.winner_id === match.player1_id && <p className="text-xs text-yellow-400 font-bold mt-1">🏆 Winner</p>}
          </div>

          {/* Player 2 */}
          <div className={`rounded-2xl p-4 flex flex-col items-center gap-1 relative ${
            match.winner_id === match.player2_id ? 'bg-yellow-500/20 border border-yellow-500/40' : 'bg-zinc-800'
          }`}>
            {server === 'p2' && !isCompleted && (
              <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-blue-400" title="Serving" />
            )}
            <p className="text-xs text-zinc-400 font-medium truncate w-full text-center">{p2?.name ?? 'Player 2'}</p>
            {p2?.club && <p className="text-xs text-zinc-500 truncate">{p2.club}</p>}
            <div className="text-6xl font-black tabular-nums mt-1">{p2Games}</div>
            <p className="text-xs text-zinc-500">games</p>
            {match.winner_id === match.player2_id && <p className="text-xs text-yellow-400 font-bold mt-1">🏆 Winner</p>}
          </div>
        </div>

        {/* Current game score */}
        {!isNotStarted && !isCompleted && (
          <>
            {/* Game tabs */}
            <div className="flex items-center gap-2 px-4 mb-3 overflow-x-auto">
              {scores.map((g, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentGame(i)}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    currentGame === i ? 'bg-white text-zinc-900' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                  }`}
                >
                  G{i + 1}: {g.p1}–{g.p2}
                </button>
              ))}
              {scores.length < 5 && (
                <button
                  onClick={addGame}
                  className="flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-800 text-zinc-500 hover:bg-zinc-700"
                >
                  + Game
                </button>
              )}
            </div>

            {/* Live score + +/- buttons */}
            <div className="grid grid-cols-2 gap-3 px-4 mb-4">
              {/* P1 score */}
              <div className={`rounded-2xl p-4 flex flex-col items-center gap-3 transition-colors ${
                server === 'p1' ? 'bg-zinc-700 ring-1 ring-blue-500/50' : 'bg-zinc-800'
              }`}>
                <p className="text-xs text-zinc-400 truncate w-full text-center">{p1?.name ?? 'P1'}</p>
                {server === 'p1' && <p className="text-[10px] text-blue-400 font-semibold -mt-2">● SERVING</p>}
                <div className="text-7xl font-black tabular-nums">{gs.p1}</div>
                <div className="flex gap-2 w-full">
                  <button
                    onPointerDown={() => adjustScore('p1', -1)}
                    className="flex-1 bg-zinc-700 active:bg-zinc-600 rounded-xl py-3 text-xl font-bold transition-colors"
                  >
                    −
                  </button>
                  <button
                    onPointerDown={() => adjustScore('p1', 1)}
                    className="flex-1 bg-blue-600 active:bg-blue-500 rounded-xl py-3 text-xl font-bold transition-colors"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* P2 score */}
              <div className={`rounded-2xl p-4 flex flex-col items-center gap-3 transition-colors ${
                server === 'p2' ? 'bg-zinc-700 ring-1 ring-blue-500/50' : 'bg-zinc-800'
              }`}>
                <p className="text-xs text-zinc-400 truncate w-full text-center">{p2?.name ?? 'P2'}</p>
                {server === 'p2' && <p className="text-[10px] text-blue-400 font-semibold -mt-2">● SERVING</p>}
                <div className="text-7xl font-black tabular-nums">{gs.p2}</div>
                <div className="flex gap-2 w-full">
                  <button
                    onPointerDown={() => adjustScore('p2', -1)}
                    className="flex-1 bg-zinc-700 active:bg-zinc-600 rounded-xl py-3 text-xl font-bold transition-colors"
                  >
                    −
                  </button>
                  <button
                    onPointerDown={() => adjustScore('p2', 1)}
                    className="flex-1 bg-blue-600 active:bg-blue-500 rounded-xl py-3 text-xl font-bold transition-colors"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Final scores summary */}
        {scores.some(g => g.p1 > 0 || g.p2 > 0) && isCompleted && (
          <div className="px-4 mb-4">
            <div className="bg-zinc-800 rounded-2xl p-4">
              <p className="text-xs text-zinc-500 mb-2 font-medium uppercase tracking-wider">Final Scores</p>
              <div className="space-y-1">
                {scores.map((g, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <span className="text-zinc-500">Game {i + 1}</span>
                    <span className="font-mono font-semibold">{g.p1} – {g.p2}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="px-4 pb-safe pb-8 space-y-3 mt-auto">
          {error && (
            <div className="bg-red-900/60 border border-red-700 rounded-xl px-3 py-2 text-sm text-red-300 text-center">
              {error}
            </div>
          )}
          {saving && <p className="text-center text-xs text-zinc-500">Saving…</p>}

          {isNotStarted && canScore && (
            <button
              onClick={() => setSetupDone(false)}
              className="w-full bg-green-600 active:bg-green-500 text-white font-bold py-4 rounded-2xl text-lg transition-colors"
            >
              Start Match
            </button>
          )}

          {!isCompleted && !isNotStarted && canScore && (
            <button
              onClick={() => setConfirmWinner('p1')}
              className="w-full bg-yellow-500 active:bg-yellow-400 text-zinc-900 font-bold py-4 rounded-2xl transition-colors"
            >
              End Match — Declare Winner
            </button>
          )}

          {isCompleted && (
            <Link
              href={`/t/${slug}/match/${matchId}`}
              className="block w-full bg-zinc-800 text-white text-center font-semibold py-4 rounded-2xl"
            >
              Back to Match
            </Link>
          )}
        </div>
      </div>

      {/* Confirm winner modal */}
      {confirmWinner && (
        <div className="fixed inset-0 bg-black/80 flex items-end justify-center z-50 px-4 pb-8">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-5 w-full max-w-sm">
            <p className="text-white font-bold text-lg mb-1 text-center">Who won?</p>
            <p className="text-zinc-400 text-sm text-center mb-5">This will complete the match</p>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <button onClick={() => declareWinner('p1')} className="bg-blue-600 active:bg-blue-500 text-white font-bold py-4 rounded-xl text-sm">
                {p1?.name ?? 'Player 1'}
              </button>
              <button onClick={() => declareWinner('p2')} className="bg-blue-600 active:bg-blue-500 text-white font-bold py-4 rounded-xl text-sm">
                {p2?.name ?? 'Player 2'}
              </button>
            </div>
            <button onClick={() => setConfirmWinner(null)} className="w-full bg-zinc-800 text-zinc-400 py-3 rounded-xl text-sm">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
