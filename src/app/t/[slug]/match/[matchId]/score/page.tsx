'use client';

import { use, useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Trophy } from 'lucide-react';
import type { MatchWithDetails, GameScore, Court } from '@/lib/supabase/types';

type Params = { slug: string; matchId: string };
type Step = 'confirm' | 'serve' | 'warmup' | 'scoring';

// ── Scoring helpers ────────────────────────────────────────────────
function gameWinner(g: GameScore): 'p1' | 'p2' | null {
  if (g.p1 >= 11 && g.p1 - g.p2 >= 2) return 'p1';
  if (g.p2 >= 11 && g.p2 - g.p1 >= 2) return 'p2';
  return null;
}

function matchWinner(all: GameScore[]): 'p1' | 'p2' | null {
  const p1 = all.filter(g => gameWinner(g) === 'p1').length;
  const p2 = all.filter(g => gameWinner(g) === 'p2').length;
  if (p1 >= 3) return 'p1';
  if (p2 >= 3) return 'p2';
  return null;
}

function gamesWon(all: GameScore[], player: 'p1' | 'p2') {
  return all.filter(g => gameWinner(g) === player).length;
}

function fmt(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

// ── Component ──────────────────────────────────────────────────────
export default function ScorePage({ params }: { params: Promise<Params> }) {
  const { slug, matchId } = use(params);
  const router = useRouter();

  // Match data
  const [match, setMatch] = useState<MatchWithDetails | null>(null);
  const [courts, setCourts] = useState<Court[]>([]);
  const [tournamentId, setTournamentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);
  const [canScore, setCanScore] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Setup flow
  const [step, setStep] = useState<Step>('confirm');
  const [selectedCourtId, setSelectedCourtId] = useState('');

  // Serve + side
  const [server, setServer] = useState<'p1' | 'p2' | null>(null);
  const [leftPlayer, setLeftPlayer] = useState<'p1' | 'p2'>('p1');

  // Warmup timer (5 min = 300s per US Squash Rule 4)
  const [warmupRunning, setWarmupRunning] = useState(false);
  const [warmupSeconds, setWarmupSeconds] = useState(300);

  // Scoring state
  const [scores, setScores] = useState<GameScore[]>([{ p1: 0, p2: 0 }]);
  const [currentGame, setCurrentGame] = useState(0);

  // Between-game break (90s per WSF Rule 14.1)
  const [gameBreak, setGameBreak] = useState(false);
  const [breakSeconds, setBreakSeconds] = useState(90);
  const [breakWinner, setBreakWinner] = useState<'p1' | 'p2' | null>(null);

  // Auto-detected match winner
  const [autoMatchWinner, setAutoMatchWinner] = useState<'p1' | 'p2' | null>(null);

  // Ref for saveScores (used inside adjustScore without dependency chain)
  const saveRef = useRef<((s: GameScore[], status?: string, wid?: string) => void) | null>(null);

  // ── Load match ──────────────────────────────────────────────────
  useEffect(() => {
    const supabase = createClient();
    async function load() {
      const { data: tRow } = await supabase.from('tournaments').select('id').eq('slug', slug).single();
      const t = tRow as { id: string } | null;
      if (!t) { router.push(`/t/${slug}`); return; }
      setTournamentId(t.id);

      const [matchRes, courtsRes] = await Promise.all([
        fetch(`/api/tournaments/${t.id}/matches/${matchId}/score`),
        fetch(`/api/tournaments/${t.id}/courts`),
      ]);
      if (!matchRes.ok) { router.push(`/t/${slug}`); return; }
      const data: MatchWithDetails = await matchRes.json();
      const courtList: Court[] = courtsRes.ok ? await courtsRes.json() : [];

      setMatch(data);
      setCourts(courtList);
      setSelectedCourtId(data.court_id ?? '');

      // Restore scores
      const existing: GameScore[] = Array.isArray(data.scores) && data.scores.length > 0
        ? data.scores : [{ p1: 0, p2: 0 }];
      setScores(existing);
      const last = existing.findIndex(g => !gameWinner(g));
      setCurrentGame(last >= 0 ? last : existing.length - 1);

      // Skip setup if already in progress
      if (data.status === 'in_progress') setStep('scoring');

      // Auth check
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

  // ── Timers ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!warmupRunning || warmupSeconds <= 0) return;
    const t = setTimeout(() => setWarmupSeconds(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [warmupRunning, warmupSeconds]);

  useEffect(() => {
    if (!gameBreak || breakSeconds <= 0) return;
    const t = setTimeout(() => setBreakSeconds(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [gameBreak, breakSeconds]);

  // Auto-advance when break timer hits 0
  useEffect(() => {
    if (gameBreak && breakSeconds === 0) startNextGame();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameBreak, breakSeconds]);

  // ── API helpers ────────────────────────────────────────────────
  const saveScores = useCallback(async (
    newScores: GameScore[],
    status?: string,
    winnerId?: string,
  ) => {
    if (!tournamentId) return;
    setSaving(true);
    setError('');
    const body: Record<string, unknown> = { scores: newScores };
    if (status) body.status = status;
    if (winnerId) body.winner_id = winnerId;
    const res = await fetch(`/api/tournaments/${tournamentId}/matches/${matchId}/score`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    setSaving(false);
    if (res.ok) {
      const updated: MatchWithDetails = await res.json();
      setMatch(updated);
    } else {
      const d = await res.json();
      setError(d.error ?? 'Save failed');
    }
  }, [tournamentId, matchId]);

  // Keep ref fresh
  saveRef.current = saveScores;

  const doStartMatch = useCallback(async (courtOverride?: string) => {
    if (!tournamentId) return;
    const body: Record<string, unknown> = {
      status: 'in_progress',
      scores: [{ p1: 0, p2: 0 }],
    };
    const courtId = courtOverride ?? selectedCourtId;
    if (courtId) body.court_id = courtId;
    const res = await fetch(`/api/tournaments/${tournamentId}/matches/${matchId}/score`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const updated: MatchWithDetails = await res.json();
      setMatch(updated);
      setScores([{ p1: 0, p2: 0 }]);
      setCurrentGame(0);
    }
  }, [tournamentId, matchId, selectedCourtId]);

  // ── Scoring logic ──────────────────────────────────────────────
  function adjustScore(player: 'p1' | 'p2', delta: number) {
    if (!canScore) return;
    setScores(prev => {
      const updated = prev.map((g, i) =>
        i !== currentGame ? g : { ...g, [player]: Math.max(0, g[player] + delta) }
      );

      // PAR: winner of rally serves
      if (delta === 1) setServer(player);

      // Check auto-detection after +1
      if (delta === 1) {
        const gw = gameWinner(updated[currentGame]);
        if (gw) {
          const mw = matchWinner(updated);
          if (mw) {
            // Match over — save + auto-complete
            const wid = mw === 'p1' ? match?.player1_id : match?.player2_id;
            saveRef.current?.(updated, 'completed', wid ?? undefined);
            setAutoMatchWinner(mw);
          } else {
            // Game over — save + start break
            saveRef.current?.(updated);
            setBreakWinner(gw);
            setBreakSeconds(90);
            setGameBreak(true);
          }
        } else {
          saveRef.current?.(updated);
        }
      } else {
        saveRef.current?.(updated);
      }

      return updated;
    });
  }

  function startNextGame() {
    setGameBreak(false);
    setBreakSeconds(90);
    setBreakWinner(null);
    setScores(prev => {
      const newScores = [...prev, { p1: 0, p2: 0 }];
      setCurrentGame(newScores.length - 1);
      saveRef.current?.(newScores);
      return newScores;
    });
    // Switch sides: opponent of last game winner opens new game serve
    // (in practice, re-allow side selection — just swap leftPlayer)
    setLeftPlayer(p => p === 'p1' ? 'p2' : 'p1');
  }

  // ─────────────────────────────────────────────────────────────────
  // RENDER GATES
  // ─────────────────────────────────────────────────────────────────
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
          You must be a player in this match, an assigned referee, or tournament organizer.
        </p>
        <Link href={`/login?redirect=/t/${slug}/match/${matchId}/score`}
          className="bg-white text-zinc-900 font-semibold px-6 py-3 rounded-xl text-sm">
          Sign In
        </Link>
        <Link href={`/t/${slug}/match/${matchId}`} className="text-sm text-zinc-500 mt-1">Back to match</Link>
      </div>
    );
  }

  const p1 = match.player1;
  const p2 = match.player2;
  const p1GamesWon = gamesWon(scores, 'p1');
  const p2GamesWon = gamesWon(scores, 'p2');
  const gs = scores[currentGame] ?? { p1: 0, p2: 0 };
  const isCompleted = match.status === 'completed' || match.status === 'walkover' || !!autoMatchWinner;
  const isNotStarted = match.status === 'scheduled' || match.status === 'on_deck';

  // ── STEP 1: Confirm players & court ──────────────────────────────
  if (step === 'confirm') {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex flex-col select-none">
        <div className="flex items-center px-4 pt-8 pb-4">
          <Link href={`/t/${slug}/match/${matchId}`} className="text-zinc-400 p-1 -ml-1">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div className="flex-1 text-center">
            <p className="text-xs text-zinc-500 font-semibold uppercase tracking-widest">Step 1 of 3</p>
            <p className="text-sm font-bold mt-0.5">Confirm Match</p>
          </div>
          <div className="w-7" />
        </div>

        <div className="flex-1 px-4 space-y-4 overflow-y-auto pb-6">
          {/* Draw + Round */}
          {(match.draw || match.round) && (
            <div className="bg-zinc-800 rounded-2xl px-4 py-3 text-center">
              <p className="text-sm text-zinc-300 font-semibold">
                {[match.draw, match.round].filter(Boolean).join(' · ')}
              </p>
            </div>
          )}

          {/* Players */}
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl overflow-hidden">
            <div className="px-4 py-4 border-b border-zinc-800">
              <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Player 1</p>
              <p className="text-xl font-bold">{p1?.name ?? 'TBD'}</p>
              {p1?.club && <p className="text-xs text-zinc-500 mt-0.5">{p1.club}</p>}
            </div>
            <div className="px-4 py-2 text-center">
              <p className="text-zinc-600 text-sm font-semibold">VS</p>
            </div>
            <div className="px-4 py-4 border-t border-zinc-800">
              <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Player 2</p>
              <p className="text-xl font-bold">{p2?.name ?? 'TBD'}</p>
              {p2?.club && <p className="text-xs text-zinc-500 mt-0.5">{p2.club}</p>}
            </div>
          </div>

          {/* Court */}
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl px-4 py-4">
            <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Court</p>
            {courts.length > 0 ? (
              <select
                value={selectedCourtId}
                onChange={e => setSelectedCourtId(e.target.value)}
                className="w-full bg-zinc-800 text-white border border-zinc-700 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">No court assigned</option>
                {courts.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            ) : (
              <p className="text-zinc-400 text-sm">{match.court?.name ?? 'No court assigned'}</p>
            )}
          </div>
        </div>

        <div className="px-4 pb-10 pt-3">
          <button
            onClick={() => setStep('serve')}
            className="w-full py-4 rounded-2xl text-lg font-bold text-white"
            style={{ background: '#2563eb' }}
          >
            Confirm & Continue →
          </button>
        </div>
      </div>
    );
  }

  // ── STEP 2: Who serves first + sides ──────────────────────────────
  if (step === 'serve') {
    const rightPlayer: 'p1' | 'p2' = leftPlayer === 'p1' ? 'p2' : 'p1';
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex flex-col select-none">
        <div className="flex items-center px-4 pt-8 pb-4">
          <button onClick={() => setStep('confirm')} className="text-zinc-400 p-1 -ml-1">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 text-center">
            <p className="text-xs text-zinc-500 font-semibold uppercase tracking-widest">Step 2 of 3</p>
            <p className="text-sm font-bold mt-0.5">Serve &amp; Sides</p>
          </div>
          <div className="w-7" />
        </div>

        <div className="flex-1 px-4 space-y-8 overflow-y-auto pb-6">
          {/* Who serves first */}
          <div>
            <p className="text-xs text-zinc-500 font-semibold uppercase tracking-widest text-center mb-4">
              Who serves first?
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setServer('p1')}
                className="p-5 rounded-2xl font-bold text-base transition-all"
                style={{
                  background: server === 'p1' ? '#2563eb' : '#27272a',
                  border: server === 'p1' ? '2px solid #60a5fa' : '2px solid transparent',
                  color: '#fff',
                }}
              >
                {p1?.name ?? 'Player 1'}
                {server === 'p1' && (
                  <div className="text-xs font-normal mt-1.5" style={{ color: '#bfdbfe' }}>
                    ● Serves first
                  </div>
                )}
              </button>
              <button
                onClick={() => setServer('p2')}
                className="p-5 rounded-2xl font-bold text-base transition-all"
                style={{
                  background: server === 'p2' ? '#2563eb' : '#27272a',
                  border: server === 'p2' ? '2px solid #60a5fa' : '2px solid transparent',
                  color: '#fff',
                }}
              >
                {p2?.name ?? 'Player 2'}
                {server === 'p2' && (
                  <div className="text-xs font-normal mt-1.5" style={{ color: '#bfdbfe' }}>
                    ● Serves first
                  </div>
                )}
              </button>
            </div>
            <p className="text-xs text-zinc-600 text-center mt-2">Usually determined by coin toss</p>
          </div>

          {/* Court sides */}
          <div>
            <p className="text-xs text-zinc-500 font-semibold uppercase tracking-widest text-center mb-4">
              Starting court positions
            </p>
            <div className="border-2 border-zinc-700 rounded-2xl overflow-hidden">
              {/* Court top label */}
              <div className="bg-zinc-900 py-2 text-center border-b border-zinc-700">
                <p className="text-[10px] text-zinc-600 font-semibold uppercase tracking-widest">Front Wall</p>
              </div>
              {/* Service boxes */}
              <div className="grid grid-cols-2">
                <button
                  onClick={() => setLeftPlayer('p1')}
                  className="py-5 text-center border-r border-zinc-700 transition-colors"
                  style={{ background: leftPlayer === 'p1' ? '#1e3a5f' : '#18181b' }}
                >
                  <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Left</p>
                  <p className="font-bold text-sm" style={{ color: leftPlayer === 'p1' ? '#93c5fd' : '#71717a' }}>
                    {leftPlayer === 'p1' ? p1?.name ?? 'P1' : p2?.name ?? 'P2'}
                  </p>
                </button>
                <button
                  onClick={() => setLeftPlayer('p2')}
                  className="py-5 text-center transition-colors"
                  style={{ background: leftPlayer === 'p2' ? '#1e3a5f' : '#18181b' }}
                >
                  <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Right</p>
                  <p className="font-bold text-sm" style={{ color: leftPlayer === 'p2' ? '#93c5fd' : '#71717a' }}>
                    {leftPlayer === 'p2' ? p1?.name ?? 'P1' : p2?.name ?? 'P2'}
                  </p>
                </button>
              </div>
              {/* Court back label */}
              <div className="bg-zinc-900 py-2 text-center border-t border-zinc-700">
                <p className="text-[10px] text-zinc-600 font-semibold uppercase tracking-widest">Back Wall</p>
              </div>
            </div>
            <p className="text-xs text-zinc-600 text-center mt-2">Tap to swap. Sides alternate each game.</p>
          </div>
        </div>

        <div className="px-4 pb-10 pt-3">
          <button
            onClick={() => setStep('warmup')}
            disabled={!server}
            className="w-full py-4 rounded-2xl text-lg font-bold text-white disabled:opacity-30 transition-opacity"
            style={{ background: server ? '#2563eb' : '#27272a' }}
          >
            Continue to Warm-up →
          </button>
          {!server && (
            <p className="text-center text-xs text-zinc-600 mt-2">Select who serves first</p>
          )}
        </div>
      </div>
    );
  }

  // ── STEP 3: Warm-up timer ─────────────────────────────────────────
  if (step === 'warmup') {
    const warmupDone = warmupSeconds === 0;
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex flex-col select-none items-center">
        <div className="w-full flex items-center px-4 pt-8 pb-4">
          <button onClick={() => setStep('serve')} className="text-zinc-400 p-1 -ml-1">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 text-center">
            <p className="text-xs text-zinc-500 font-semibold uppercase tracking-widest">Step 3 of 3</p>
            <p className="text-sm font-bold mt-0.5">Warm-up</p>
          </div>
          <div className="w-7" />
        </div>

        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center gap-6">
          {/* Timer */}
          <div className="w-48 h-48 rounded-full border-4 border-zinc-700 flex flex-col items-center justify-center"
            style={{ borderColor: warmupRunning && !warmupDone ? '#2563eb' : warmupDone ? '#16a34a' : '#3f3f46' }}>
            <p className="text-6xl font-black tabular-nums tracking-tight">
              {fmt(warmupSeconds)}
            </p>
            <p className="text-xs text-zinc-500 mt-1 uppercase tracking-wider">
              {warmupDone ? 'Complete' : warmupRunning ? 'Running' : 'Ready'}
            </p>
          </div>

          <div>
            <p className="text-zinc-400 text-sm">US Squash — 5 minute warm-up</p>
            <p className="text-zinc-600 text-xs mt-1">WSF Rule 4: Both players share the court</p>
          </div>

          {/* Controls */}
          {!warmupRunning && !warmupDone && (
            <button
              onClick={() => setWarmupRunning(true)}
              className="px-8 py-3 rounded-2xl font-bold text-white"
              style={{ background: '#2563eb' }}
            >
              Start Warm-up
            </button>
          )}
          {warmupRunning && !warmupDone && (
            <div className="bg-zinc-800 rounded-xl px-4 py-2 text-sm text-zinc-400">
              Timing warm-up…
            </div>
          )}
          {warmupDone && (
            <div className="bg-green-900/40 border border-green-700 rounded-xl px-4 py-2 text-sm text-green-400 font-semibold">
              Warm-up complete!
            </div>
          )}
        </div>

        <div className="w-full px-4 pb-10 pt-3 space-y-3">
          <button
            onClick={() => { doStartMatch(); setStep('scoring'); }}
            className="w-full py-4 rounded-2xl text-lg font-bold text-white"
            style={{ background: '#16a34a' }}
          >
            {warmupDone ? 'Start Match' : 'Start Match Now'}
          </button>
          {!warmupDone && (
            <button
              onClick={() => { setWarmupRunning(false); setWarmupSeconds(0); doStartMatch(); setStep('scoring'); }}
              className="w-full py-3 rounded-2xl text-sm font-semibold text-zinc-400 bg-zinc-800"
            >
              Skip Warm-up
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── STEP 4: Scoring ───────────────────────────────────────────────
  const serviceBox = server
    ? (gs[server] % 2 === 0 ? 'Right box' : 'Left box')
    : null;

  const p1Side = leftPlayer === 'p1' ? 'L' : 'R';
  const p2Side = leftPlayer === 'p2' ? 'L' : 'R';

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col select-none">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 pt-6 pb-2">
        <Link href={`/t/${slug}/match/${matchId}`} className="text-zinc-400 p-1 -ml-1">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div className="text-center">
          <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider">
            {[match.draw, match.round].filter(Boolean).join(' · ')}
          </p>
          {match.court?.name && (
            <p className="text-xs text-zinc-600">{match.court.name}</p>
          )}
        </div>
        <div className="w-7" />
      </div>

      {/* ── Serve bar — tall, tap to switch server ── */}
      {!isCompleted && (
        <button
          onClick={() => setServer(s => s === 'p1' ? 'p2' : 'p1')}
          className="mx-4 mb-3 rounded-2xl overflow-hidden border border-zinc-700 h-14 grid grid-cols-2 cursor-pointer"
          title="Tap to switch server"
        >
          <div
            className="flex flex-col items-center justify-center transition-colors h-full"
            style={{ background: server === 'p1' ? '#1d4ed8' : '#1c1c1e' }}
          >
            <span className="text-xs font-bold truncate px-2 max-w-full"
              style={{ color: server === 'p1' ? '#fff' : '#71717a' }}>
              {server === 'p1' ? '● ' : ''}{p1?.name ?? 'P1'}
            </span>
            <span className="text-[10px] mt-0.5"
              style={{ color: server === 'p1' ? '#93c5fd' : '#52525b' }}>
              {server === 'p1' ? serviceBox : p1Side + ' side'}
            </span>
          </div>
          <div
            className="flex flex-col items-center justify-center transition-colors h-full border-l border-zinc-700"
            style={{ background: server === 'p2' ? '#1d4ed8' : '#1c1c1e' }}
          >
            <span className="text-xs font-bold truncate px-2 max-w-full"
              style={{ color: server === 'p2' ? '#fff' : '#71717a' }}>
              {server === 'p2' ? '● ' : ''}{p2?.name ?? 'P2'}
            </span>
            <span className="text-[10px] mt-0.5"
              style={{ color: server === 'p2' ? '#93c5fd' : '#52525b' }}>
              {server === 'p2' ? serviceBox : p2Side + ' side'}
            </span>
          </div>
        </button>
      )}

      {/* Completed banner */}
      {isCompleted && (
        <div className="mx-4 mb-3 bg-yellow-500/10 border border-yellow-500/30 rounded-2xl px-4 py-3 text-center">
          <Trophy className="w-5 h-5 text-yellow-400 mx-auto mb-1" />
          <p className="font-bold text-yellow-400">
            {(autoMatchWinner === 'p1' || match.winner_id === match.player1_id) ? p1?.name : p2?.name} wins!
          </p>
          <p className="text-xs text-zinc-500 mt-0.5">Match complete</p>
        </div>
      )}

      {/* Game score + player summary */}
      <div className="grid grid-cols-2 gap-2 px-4 mb-3">
        <div className="rounded-2xl p-3 text-center"
          style={{ background: (autoMatchWinner === 'p1' || match.winner_id === match.player1_id) ? 'rgba(234,179,8,0.15)' : '#27272a' }}>
          <p className="text-xs text-zinc-400 truncate">{p1?.name ?? 'Player 1'}</p>
          <p className="text-5xl font-black tabular-nums">{p1GamesWon}</p>
          <p className="text-[10px] text-zinc-500">games</p>
        </div>
        <div className="rounded-2xl p-3 text-center"
          style={{ background: (autoMatchWinner === 'p2' || match.winner_id === match.player2_id) ? 'rgba(234,179,8,0.15)' : '#27272a' }}>
          <p className="text-xs text-zinc-400 truncate">{p2?.name ?? 'Player 2'}</p>
          <p className="text-5xl font-black tabular-nums">{p2GamesWon}</p>
          <p className="text-[10px] text-zinc-500">games</p>
        </div>
      </div>

      {/* Live game scoring */}
      {!isCompleted && (
        <>
          {/* Game tabs */}
          <div className="flex items-center gap-2 px-4 mb-3 overflow-x-auto">
            {scores.map((g, i) => (
              <button key={i} onClick={() => setCurrentGame(i)}
                className="flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                style={{
                  background: currentGame === i ? '#fff' : '#27272a',
                  color: currentGame === i ? '#09090b' : gameWinner(g) ? '#4ade80' : '#a1a1aa',
                }}>
                G{i + 1}: {g.p1}–{g.p2}
                {gameWinner(g) === 'p1' ? ' ✓' : gameWinner(g) === 'p2' ? ' ✓' : ''}
              </button>
            ))}
          </div>

          {/* +/- scoring panels */}
          <div className="grid grid-cols-2 gap-3 px-4 mb-3">
            {/* P1 */}
            <div className="rounded-2xl p-4 flex flex-col items-center gap-3"
              style={{ background: server === 'p1' ? '#1e2d4a' : '#27272a', outline: server === 'p1' ? '2px solid #3b82f6' : 'none' }}>
              <p className="text-xs text-zinc-400 truncate w-full text-center">{p1?.name ?? 'P1'}</p>
              {server === 'p1' && (
                <p className="text-[10px] font-bold -mt-2" style={{ color: '#60a5fa' }}>● SERVING</p>
              )}
              <p className="text-7xl font-black tabular-nums">{gs.p1}</p>
              <div className="flex gap-2 w-full">
                <button onPointerDown={() => adjustScore('p1', -1)}
                  className="flex-1 rounded-xl py-3.5 text-xl font-bold"
                  style={{ background: '#3f3f46' }}>−</button>
                <button onPointerDown={() => adjustScore('p1', 1)}
                  className="flex-1 rounded-xl py-3.5 text-xl font-bold"
                  style={{ background: '#2563eb' }}>+</button>
              </div>
            </div>

            {/* P2 */}
            <div className="rounded-2xl p-4 flex flex-col items-center gap-3"
              style={{ background: server === 'p2' ? '#1e2d4a' : '#27272a', outline: server === 'p2' ? '2px solid #3b82f6' : 'none' }}>
              <p className="text-xs text-zinc-400 truncate w-full text-center">{p2?.name ?? 'P2'}</p>
              {server === 'p2' && (
                <p className="text-[10px] font-bold -mt-2" style={{ color: '#60a5fa' }}>● SERVING</p>
              )}
              <p className="text-7xl font-black tabular-nums">{gs.p2}</p>
              <div className="flex gap-2 w-full">
                <button onPointerDown={() => adjustScore('p2', -1)}
                  className="flex-1 rounded-xl py-3.5 text-xl font-bold"
                  style={{ background: '#3f3f46' }}>−</button>
                <button onPointerDown={() => adjustScore('p2', 1)}
                  className="flex-1 rounded-xl py-3.5 text-xl font-bold"
                  style={{ background: '#2563eb' }}>+</button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Completed: scores summary */}
      {isCompleted && scores.some(g => g.p1 > 0 || g.p2 > 0) && (
        <div className="px-4 mb-3">
          <div className="bg-zinc-900 rounded-2xl p-4">
            <p className="text-xs text-zinc-500 mb-2 font-semibold uppercase tracking-wider">Final Scores</p>
            {scores.map((g, i) => (
              <div key={i} className="flex justify-between text-sm py-0.5">
                <span className="text-zinc-500">Game {i + 1}</span>
                <span className="font-mono font-bold"
                  style={{ color: gameWinner(g) ? '#4ade80' : '#a1a1aa' }}>
                  {g.p1} – {g.p2}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer actions */}
      <div className="px-4 pb-10 pt-2 mt-auto space-y-2">
        {error && (
          <div className="bg-red-900/50 border border-red-700 rounded-xl px-3 py-2 text-sm text-red-300 text-center">
            {error}
          </div>
        )}
        {saving && <p className="text-center text-xs text-zinc-600">Saving…</p>}

        {!isCompleted && canScore && (
          <button
            onClick={() => {
              const mw = matchWinner(scores);
              if (!mw) {
                // Manual declare
                const wid = confirm(`${p1?.name ?? 'Player 1'} wins? (Cancel = ${p2?.name ?? 'Player 2'} wins)`)
                  ? match.player1_id : match.player2_id;
                saveScores(scores, 'completed', wid ?? undefined);
                setAutoMatchWinner(match.player1_id === wid ? 'p1' : 'p2');
              }
            }}
            className="w-full py-3.5 rounded-2xl font-bold text-zinc-900"
            style={{ background: '#eab308' }}
          >
            Declare Match Winner
          </button>
        )}

        {isCompleted && (
          <Link href={`/t/${slug}/match/${matchId}`}
            className="block w-full bg-zinc-800 text-white text-center font-semibold py-4 rounded-2xl">
            Back to Match
          </Link>
        )}
      </div>

      {/* ── Between-game break overlay ── */}
      {gameBreak && (
        <div className="fixed inset-0 bg-black/90 flex flex-col items-center justify-center z-50 px-6 text-center">
          <p className="text-zinc-400 text-xs uppercase tracking-widest mb-2">Game Over</p>
          <p className="text-2xl font-bold text-white mb-1">
            {breakWinner === 'p1' ? p1?.name : p2?.name} wins game {currentGame + 1}
          </p>
          <p className="text-zinc-500 text-sm mb-8">
            {p1?.name ?? 'P1'} {p1GamesWon} – {p2GamesWon} {p2?.name ?? 'P2'}
          </p>

          {/* Countdown */}
          <div className="w-32 h-32 rounded-full border-4 flex items-center justify-center mb-6"
            style={{ borderColor: breakSeconds > 20 ? '#2563eb' : '#dc2626' }}>
            <p className="text-4xl font-black tabular-nums">{fmt(breakSeconds)}</p>
          </div>
          <p className="text-xs text-zinc-600 mb-8">WSF Rule 14.1 — 90 second interval</p>

          <button
            onClick={startNextGame}
            className="w-full max-w-xs py-4 rounded-2xl font-bold text-white"
            style={{ background: '#16a34a' }}
          >
            Start Game {currentGame + 2}
          </button>
          {/* Side swap reminder */}
          <p className="text-xs text-zinc-600 mt-3">Players change ends for game {currentGame + 2}</p>
        </div>
      )}
    </div>
  );
}
