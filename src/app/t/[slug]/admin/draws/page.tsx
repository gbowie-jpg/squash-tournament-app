'use client';

import { useState, useEffect, use, useMemo, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useTournament } from '@/lib/useTournament';
import ThemeToggle from '@/components/ThemeToggle';
import RefreshButton from '@/components/RefreshButton';
import DrawPreview from '@/components/admin/DrawPreview';
import ScheduleGrid from '@/components/admin/ScheduleGrid';
import { previewSingleElimination } from '@/lib/draws/singleElimination';
import { previewRoundRobin } from '@/lib/draws/roundRobin';
import type { DrawFormat, PlayerInput } from '@/lib/draws/types';

// ── AI Bracket Builder panel ─────────────────────────────────────────────────

type AIMessage = { role: 'user' | 'assistant'; content: string };

function BracketAIPanel({
  players,
  drawName,
  onSetFormat,
}: {
  players: PlayerInput[];
  drawName: string;
  onSetFormat: (f: DrawFormat) => void;
}) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [analyzed, setAnalyzed] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const send = useCallback(async (text: string, isAuto = false) => {
    const question = text.trim();
    if (!question || loading) return;
    if (!isAuto) setInput('');

    const userMsg: AIMessage = { role: 'user', content: question };
    setMessages((prev) => isAuto ? [...prev, { role: 'assistant', content: '' }] : [...prev, userMsg, { role: 'assistant', content: '' }]);
    setLoading(true);

    try {
      const history = isAuto ? [] : messages.slice(-8);
      const res = await fetch('/api/ai/bracket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: question,
          history,
          players: players.map((p) => ({ id: p.id, name: p.name, seed: p.seed })),
          drawName,
        }),
      });

      if (!res.ok || !res.body) {
        setMessages((prev) => {
          const upd = [...prev];
          upd[upd.length - 1] = { role: 'assistant', content: 'Error reaching AI — check that ANTHROPIC_API_KEY is set.' };
          return upd;
        });
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let assembled = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        assembled += decoder.decode(value, { stream: true });
        setMessages((prev) => {
          const upd = [...prev];
          upd[upd.length - 1] = { role: 'assistant', content: assembled };
          return upd;
        });
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      }
    } catch {
      setMessages((prev) => {
        const upd = [...prev];
        upd[upd.length - 1] = { role: 'assistant', content: 'Network error — please try again.' };
        return upd;
      });
    } finally {
      setLoading(false);
    }
  }, [loading, messages, players, drawName]);

  // Auto-analyze when first opened
  const handleOpen = () => {
    setOpen(true);
    if (!analyzed) {
      setAnalyzed(true);
      send('Analyze this draw and recommend the best bracket format and structure. Be specific about bracket size, byes, and seeding.', true);
    }
  };

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') send(input);
  };

  return (
    <div className="bg-[var(--surface-card)] border border-[var(--border)] rounded-xl overflow-hidden">
      {/* Header toggle */}
      <button
        onClick={open ? () => setOpen(false) : handleOpen}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-[var(--surface)] transition-colors text-left"
      >
        <span className="flex items-center gap-2">
          <span className="text-base">🤖</span>
          <span className="font-semibold text-sm">Build Bracket with AI</span>
          {!analyzed && (
            <span className="text-xs text-[var(--text-muted)]">— get a recommendation for {players.length} players</span>
          )}
        </span>
        <span className="text-[var(--text-muted)] text-xs">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="border-t border-[var(--border)]">
          {/* Messages */}
          <div className="max-h-72 overflow-y-auto px-4 py-3 space-y-3 bg-[var(--surface)]">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[90%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                  msg.role === 'user'
                    ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900'
                    : 'bg-[var(--surface-card)] border border-[var(--border)] text-[var(--text-primary)]'
                }`}>
                  {msg.content || <span className="opacity-40 italic text-xs">Analyzing your draw…</span>}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Format action buttons */}
          <div className="px-4 py-3 border-t border-[var(--border)] bg-[var(--surface-card)] space-y-2">
            <p className="text-xs text-[var(--text-muted)] font-medium uppercase tracking-wide">Apply AI recommendation</p>
            <div className="flex gap-2">
              <button
                onClick={() => { onSetFormat('single_elimination'); setOpen(false); }}
                className="flex-1 py-2 px-3 rounded-lg text-sm font-medium border border-[var(--border)] hover:border-zinc-400 dark:hover:border-zinc-500 hover:bg-[var(--surface)] transition-colors text-[var(--text-primary)]"
              >
                Use Single Elimination
              </button>
              <button
                onClick={() => { onSetFormat('round_robin'); setOpen(false); }}
                className="flex-1 py-2 px-3 rounded-lg text-sm font-medium border border-[var(--border)] hover:border-zinc-400 dark:hover:border-zinc-500 hover:bg-[var(--surface)] transition-colors text-[var(--text-primary)]"
              >
                Use Round Robin
              </button>
            </div>
          </div>

          {/* Follow-up input */}
          <div className="px-4 py-3 border-t border-[var(--border)] flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Ask a follow-up — e.g. what if I add one more player?"
              disabled={loading}
              className="flex-1 border border-[var(--border)] rounded-lg px-3 py-2 text-sm bg-[var(--surface)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-zinc-400"
            />
            <button
              onClick={() => send(input)}
              disabled={loading || !input.trim()}
              className="px-3 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-40 transition-opacity"
            >
              Ask
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

type DrawSummary = {
  draw: string;
  playerCount: number;
  seededCount: number;
  matchCount: number;
  completedCount: number;
  hasMatches: boolean;
};

type MatchWithDetails = {
  id: string;
  match_number: number;
  draw: string | null;
  round: string | null;
  scheduled_time: string | null;
  status: string;
  player1?: { id: string; name: string; seed?: number | null } | null;
  player2?: { id: string; name: string; seed?: number | null } | null;
  court?: { id: string; name: string } | null;
  notes: string | null;
  winner_id: string | null;
};

export default function DrawsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const { tournament, loading: tournamentLoading } = useTournament(slug);

  const [draws, setDraws] = useState<DrawSummary[]>([]);
  const [selectedDraw, setSelectedDraw] = useState<string | null>(null);
  const [format, setFormat] = useState<DrawFormat>('single_elimination');
  const [players, setPlayers] = useState<PlayerInput[]>([]);
  const [matches, setMatches] = useState<MatchWithDetails[]>([]);
  const [courts, setCourts] = useState<{ id: string; name: string }[]>([]);
  const [generating, setGenerating] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Schedule config
  const [startTime, setStartTime] = useState('');
  const [matchDuration, setMatchDuration] = useState(45);
  const [restPeriod, setRestPeriod] = useState(30);

  // Fetch draws summary
  useEffect(() => {
    if (!tournament) return;
    setLoading(true);
    fetch(`/api/tournaments/${tournament.id}/draws`)
      .then((r) => r.json())
      .then((data) => {
        setDraws(data);
        if (data.length > 0 && !selectedDraw) {
          setSelectedDraw(data[0].draw);
        }
        setLoading(false);
      });
  }, [tournament]);

  // Fetch players and matches when draw selected
  useEffect(() => {
    if (!tournament || !selectedDraw) return;

    fetch(`/api/tournaments/${tournament.id}/players`)
      .then((r) => r.json())
      .then((data) => {
        setPlayers(
          data
            .filter((p: any) => (p.draw || 'Unassigned') === selectedDraw)
            .map((p: any) => ({ id: p.id, name: p.name, seed: p.seed, draw: p.draw })),
        );
      });

    fetch(`/api/tournaments/${tournament.id}/matches`)
      .then((r) => r.json())
      .then((data) => {
        setMatches(data.filter((m: any) => m.draw === selectedDraw));
      });

    fetch(`/api/tournaments/${tournament.id}/courts`)
      .then((r) => r.json())
      .then((data) => {
        setCourts(data.map((c: any) => ({ id: c.id, name: c.name })));
      });
  }, [tournament, selectedDraw]);

  // Set default start time
  useEffect(() => {
    if (!startTime && tournament?.start_date) {
      const d = new Date(tournament.start_date);
      d.setHours(9, 0, 0, 0);
      // Format for datetime-local input
      const pad = (n: number) => n.toString().padStart(2, '0');
      setStartTime(
        `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T09:00`,
      );
    }
  }, [tournament]);

  const currentDrawInfo = draws.find((d) => d.draw === selectedDraw);

  // Preview
  const preview = useMemo(() => {
    if (players.length < 2) return [];
    try {
      if (format === 'single_elimination') {
        return previewSingleElimination(players, selectedDraw || '');
      } else {
        return previewRoundRobin(players, selectedDraw || '');
      }
    } catch {
      return [];
    }
  }, [players, format, selectedDraw]);

  const handleGenerate = async () => {
    if (!tournament || !selectedDraw) return;
    if (
      currentDrawInfo?.hasMatches &&
      !confirm(
        `This will delete ${currentDrawInfo.matchCount} existing matches for "${selectedDraw}". Continue?`,
      )
    )
      return;

    setGenerating(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/tournaments/${tournament.id}/draws/generate`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ draw: selectedDraw, format }),
        },
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Generation failed');
        return;
      }
      setMatches(data.matches);
      // Refresh draw summary
      const drawsRes = await fetch(`/api/tournaments/${tournament.id}/draws`);
      setDraws(await drawsRes.json());
    } finally {
      setGenerating(false);
    }
  };

  const handleSchedule = async () => {
    if (!tournament || !startTime) return;
    setScheduling(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/tournaments/${tournament.id}/draws/schedule`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            draw: selectedDraw,
            startTime: new Date(startTime).toISOString(),
            matchDurationMinutes: matchDuration,
            restPeriodMinutes: restPeriod,
          }),
        },
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Scheduling failed');
        return;
      }
      setMatches(data.matches.filter((m: any) => m.draw === selectedDraw));
    } finally {
      setScheduling(false);
    }
  };

  if (tournamentLoading) return (
    <div className="min-h-screen bg-background p-6 space-y-4 animate-pulse">
      <div className="h-10 bg-surface rounded-xl w-1/3" />
      <div className="h-8 bg-surface rounded-xl w-1/2" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="h-64 bg-surface rounded-xl" />
        <div className="h-64 bg-surface rounded-xl" />
      </div>
    </div>
  );
  if (!tournament) return <div className="flex items-center justify-center min-h-screen text-muted-foreground">Not found</div>;

  return (
    <div className="min-h-screen bg-[var(--surface)]">
      <header className="bg-[var(--surface-card)] border-b border-[var(--border)]">
        <div className="max-w-5xl mx-auto px-4 py-6">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-1.5 text-sm text-[var(--text-muted)]">
                <Link href="/admin" className="hover:text-[var(--text-secondary)]">Admin Dashboard</Link>
                <span>›</span>
                <Link href={`/t/${slug}/admin`} className="hover:text-[var(--text-secondary)]">{tournament?.name ?? slug}</Link>
              </div>
              <h1 className="text-2xl font-bold tracking-tight mt-1">Draws & Scheduling</h1>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <ThemeToggle />
              <RefreshButton />
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        {loading ? (
          <div className="space-y-4 animate-pulse">
            <div className="flex gap-2">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-10 w-28 bg-surface rounded-lg" />
              ))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="h-64 bg-surface rounded-xl" />
              <div className="h-64 bg-surface rounded-xl" />
            </div>
          </div>
        ) : draws.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-[var(--text-secondary)] mb-2">No draws found.</p>
            <p className="text-sm text-[var(--text-secondary)]">
              Add players with a draw assigned first at{' '}
              <Link href={`/t/${slug}/admin/players`} className="text-[var(--text-primary)] underline">
                Player Management
              </Link>
            </p>
          </div>
        ) : (
          <>
            {/* Draw tabs */}
            <div className="flex gap-2 flex-wrap">
              {draws.map((d) => (
                <button
                  key={d.draw}
                  onClick={() => setSelectedDraw(d.draw)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    selectedDraw === d.draw
                      ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900'
                      : 'bg-[var(--surface-card)] border border-[var(--border)] text-[var(--text-secondary)] hover:opacity-80'
                  }`}
                >
                  {d.draw}
                  <span className="ml-2 text-xs opacity-70">
                    {d.playerCount}p
                    {d.hasMatches ? ` · ${d.matchCount}m` : ''}
                  </span>
                </button>
              ))}
            </div>

            {selectedDraw && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Left: AI Builder + Format + Preview */}
                <div className="space-y-6">
                  {/* AI Bracket Builder */}
                  {players.length >= 2 && (
                    <BracketAIPanel
                      players={players}
                      drawName={selectedDraw}
                      onSetFormat={setFormat}
                    />
                  )}

                  <div className="bg-[var(--surface-card)] border border-[var(--border)] rounded-xl p-6 space-y-4">
                    <h2 className="font-semibold">Format</h2>
                    <div className="flex gap-3">
                      <label
                        className={`flex-1 p-3 rounded-lg border cursor-pointer text-center text-sm ${
                          format === 'single_elimination'
                            ? 'border-zinc-900 dark:border-zinc-100 bg-[var(--surface)] font-medium'
                            : 'border-[var(--border)] hover:opacity-80'
                        }`}
                      >
                        <input
                          type="radio"
                          name="format"
                          value="single_elimination"
                          checked={format === 'single_elimination'}
                          onChange={() => setFormat('single_elimination')}
                          className="sr-only"
                        />
                        Single Elimination
                      </label>
                      <label
                        className={`flex-1 p-3 rounded-lg border cursor-pointer text-center text-sm ${
                          format === 'round_robin'
                            ? 'border-zinc-900 dark:border-zinc-100 bg-[var(--surface)] font-medium'
                            : 'border-[var(--border)] hover:opacity-80'
                        }`}
                      >
                        <input
                          type="radio"
                          name="format"
                          value="round_robin"
                          checked={format === 'round_robin'}
                          onChange={() => setFormat('round_robin')}
                          className="sr-only"
                        />
                        Round Robin
                      </label>
                    </div>

                    <div className="text-xs text-[var(--text-secondary)]">
                      {players.length} players · {currentDrawInfo?.seededCount || 0} seeded
                    </div>
                  </div>

                  {/* Preview */}
                  <div className="bg-[var(--surface-card)] border border-[var(--border)] rounded-xl p-6">
                    <h2 className="font-semibold mb-4">
                      Preview
                      {currentDrawInfo?.hasMatches && (
                        <span className="text-xs text-amber-600 ml-2 font-normal">
                          ⚠ {currentDrawInfo.matchCount} matches exist — generating will replace them
                        </span>
                      )}
                    </h2>
                    {players.length < 2 ? (
                      <p className="text-sm text-[var(--text-secondary)]">Need at least 2 players to preview.</p>
                    ) : (
                      <DrawPreview matches={preview} format={format} />
                    )}
                  </div>

                  {/* Generate button */}
                  {error && (
                    <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-lg px-4 py-3 text-sm">
                      {error}
                    </div>
                  )}
                  <button
                    onClick={handleGenerate}
                    disabled={generating || players.length < 2}
                    className="w-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-6 py-3 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {generating
                      ? 'Generating...'
                      : currentDrawInfo?.hasMatches
                        ? `Regenerate ${selectedDraw} Draw`
                        : `Generate ${selectedDraw} Draw`}
                  </button>
                </div>

                {/* Right: Scheduling */}
                <div className="space-y-6">
                  <div className="bg-[var(--surface-card)] border border-[var(--border)] rounded-xl p-6 space-y-4">
                    <h2 className="font-semibold">Scheduling</h2>
                    {matches.length === 0 ? (
                      <p className="text-sm text-[var(--text-secondary)]">
                        Generate matches first, then schedule them to courts and times.
                      </p>
                    ) : (
                      <>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                              Start Time
                            </label>
                            <input
                              type="datetime-local"
                              value={startTime}
                              onChange={(e) => setStartTime(e.target.value)}
                              className="w-full border border-[var(--border)] rounded-lg px-3 py-2 text-sm bg-[var(--surface)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-zinc-900"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                              Match Duration (min)
                            </label>
                            <input
                              type="number"
                              min={15}
                              max={120}
                              value={matchDuration}
                              onChange={(e) => setMatchDuration(parseInt(e.target.value) || 45)}
                              className="w-full border border-[var(--border)] rounded-lg px-3 py-2 text-sm bg-[var(--surface)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-zinc-900"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                              Rest Period (min)
                            </label>
                            <input
                              type="number"
                              min={0}
                              max={120}
                              value={restPeriod}
                              onChange={(e) => setRestPeriod(parseInt(e.target.value) || 30)}
                              className="w-full border border-[var(--border)] rounded-lg px-3 py-2 text-sm bg-[var(--surface)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-zinc-900"
                            />
                          </div>
                        </div>

                        {courts.length === 0 ? (
                          <p className="text-sm text-amber-600">
                            No courts set up.{' '}
                            <Link href={`/t/${slug}/admin/courts`} className="underline">
                              Add courts first
                            </Link>
                          </p>
                        ) : (
                          <button
                            onClick={handleSchedule}
                            disabled={scheduling || !startTime}
                            className="w-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-6 py-2.5 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {scheduling ? 'Scheduling...' : 'Auto-Schedule'}
                          </button>
                        )}
                      </>
                    )}
                  </div>

                  {/* Schedule Grid */}
                  {matches.some((m) => m.scheduled_time) && (
                    <div className="bg-[var(--surface-card)] border border-[var(--border)] rounded-xl p-6">
                      <h2 className="font-semibold mb-4">Court Schedule</h2>
                      <ScheduleGrid matches={matches} courts={courts} />
                    </div>
                  )}

                  {/* Match list */}
                  {matches.length > 0 && (
                    <div className="bg-[var(--surface-card)] border border-[var(--border)] rounded-xl p-6">
                      <h2 className="font-semibold mb-3">
                        Generated Matches ({matches.length})
                      </h2>
                      <div className="space-y-1 max-h-96 overflow-auto">
                        {matches.map((m) => {
                          const p1 = m.player1
                            ? `${m.player1.seed ? `[${m.player1.seed}] ` : ''}${m.player1.name}`
                            : 'TBD';
                          const p2 = m.player2
                            ? `${m.player2.seed ? `[${m.player2.seed}] ` : ''}${m.player2.name}`
                            : 'TBD';

                          return (
                            <div
                              key={m.id}
                              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm ${
                                m.status === 'walkover'
                                  ? 'bg-surface text-muted-foreground'
                                  : m.status === 'completed'
                                    ? 'bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-400'
                                    : 'bg-card'
                              }`}
                            >
                              <span className="text-xs text-[var(--text-secondary)] w-8">M{m.match_number}</span>
                              <span className="text-xs text-[var(--text-secondary)] w-8">{m.round}</span>
                              <span className="flex-1">
                                {m.status === 'walkover' ? (
                                  <span>{m.notes}</span>
                                ) : m.notes?.startsWith('Winner') ? (
                                  <span className="text-amber-600">{m.notes}</span>
                                ) : (
                                  <span>
                                    {p1} <span className="text-[var(--text-secondary)]">vs</span> {p2}
                                  </span>
                                )}
                              </span>
                              {m.court && (
                                <span className="text-xs text-[var(--text-secondary)]">{m.court.name}</span>
                              )}
                              {m.scheduled_time && (
                                <span className="text-xs text-[var(--text-secondary)]">
                                  {new Date(m.scheduled_time).toLocaleTimeString([], {
                                    hour: 'numeric',
                                    minute: '2-digit',
                                  })}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
