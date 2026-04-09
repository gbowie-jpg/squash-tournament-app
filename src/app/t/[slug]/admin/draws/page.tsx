'use client';

import { useState, useEffect, use, useMemo } from 'react';
import Link from 'next/link';
import { useTournament } from '@/lib/useTournament';
import DrawPreview from '@/components/admin/DrawPreview';
import ScheduleGrid from '@/components/admin/ScheduleGrid';
import { previewSingleElimination } from '@/lib/draws/singleElimination';
import { previewRoundRobin } from '@/lib/draws/roundRobin';
import type { DrawFormat, PlayerInput } from '@/lib/draws/types';

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

  if (tournamentLoading) return <div className="flex items-center justify-center min-h-screen text-zinc-600">Loading...</div>;
  if (!tournament) return <div className="flex items-center justify-center min-h-screen text-zinc-600">Not found</div>;

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="bg-white border-b border-zinc-200">
        <div className="max-w-5xl mx-auto px-4 py-6">
          <div className="flex items-center gap-1.5 text-sm text-zinc-500">
            <Link href="/admin" className="hover:text-zinc-700">Admin Dashboard</Link>
            <span>›</span>
            <Link href={`/t/${slug}/admin`} className="hover:text-zinc-700">{tournament?.name ?? slug}</Link>
          </div>
          <h1 className="text-2xl font-bold tracking-tight mt-1">Draws & Scheduling</h1>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        {loading ? (
          <p className="text-zinc-600 text-center py-12">Loading...</p>
        ) : draws.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-zinc-600 mb-2">No draws found.</p>
            <p className="text-sm text-zinc-600">
              Add players with a draw assigned first at{' '}
              <Link href={`/t/${slug}/admin/players`} className="text-zinc-900 underline">
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
                      ? 'bg-zinc-900 text-white'
                      : 'bg-white border border-zinc-200 text-zinc-600 hover:bg-zinc-50'
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
                {/* Left: Format + Preview */}
                <div className="space-y-6">
                  <div className="bg-white border border-zinc-200 rounded-xl p-6 space-y-4">
                    <h2 className="font-semibold">Format</h2>
                    <div className="flex gap-3">
                      <label
                        className={`flex-1 p-3 rounded-lg border cursor-pointer text-center text-sm ${
                          format === 'single_elimination'
                            ? 'border-zinc-900 bg-zinc-50 font-medium'
                            : 'border-zinc-200 hover:bg-zinc-50'
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
                            ? 'border-zinc-900 bg-zinc-50 font-medium'
                            : 'border-zinc-200 hover:bg-zinc-50'
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

                    <div className="text-xs text-zinc-600">
                      {players.length} players · {currentDrawInfo?.seededCount || 0} seeded
                    </div>
                  </div>

                  {/* Preview */}
                  <div className="bg-white border border-zinc-200 rounded-xl p-6">
                    <h2 className="font-semibold mb-4">
                      Preview
                      {currentDrawInfo?.hasMatches && (
                        <span className="text-xs text-amber-600 ml-2 font-normal">
                          ⚠ {currentDrawInfo.matchCount} matches exist — generating will replace them
                        </span>
                      )}
                    </h2>
                    {players.length < 2 ? (
                      <p className="text-sm text-zinc-600">Need at least 2 players to preview.</p>
                    ) : (
                      <DrawPreview matches={preview} format={format} />
                    )}
                  </div>

                  {/* Generate button */}
                  {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
                      {error}
                    </div>
                  )}
                  <button
                    onClick={handleGenerate}
                    disabled={generating || players.length < 2}
                    className="w-full bg-zinc-900 text-white px-6 py-3 rounded-lg text-sm font-medium hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed"
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
                  <div className="bg-white border border-zinc-200 rounded-xl p-6 space-y-4">
                    <h2 className="font-semibold">Scheduling</h2>
                    {matches.length === 0 ? (
                      <p className="text-sm text-zinc-600">
                        Generate matches first, then schedule them to courts and times.
                      </p>
                    ) : (
                      <>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-zinc-600 mb-1">
                              Start Time
                            </label>
                            <input
                              type="datetime-local"
                              value={startTime}
                              onChange={(e) => setStartTime(e.target.value)}
                              className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-zinc-600 mb-1">
                              Match Duration (min)
                            </label>
                            <input
                              type="number"
                              min={15}
                              max={120}
                              value={matchDuration}
                              onChange={(e) => setMatchDuration(parseInt(e.target.value) || 45)}
                              className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-zinc-600 mb-1">
                              Rest Period (min)
                            </label>
                            <input
                              type="number"
                              min={0}
                              max={120}
                              value={restPeriod}
                              onChange={(e) => setRestPeriod(parseInt(e.target.value) || 30)}
                              className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
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
                            className="w-full bg-zinc-900 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {scheduling ? 'Scheduling...' : 'Auto-Schedule'}
                          </button>
                        )}
                      </>
                    )}
                  </div>

                  {/* Schedule Grid */}
                  {matches.some((m) => m.scheduled_time) && (
                    <div className="bg-white border border-zinc-200 rounded-xl p-6">
                      <h2 className="font-semibold mb-4">Court Schedule</h2>
                      <ScheduleGrid matches={matches} courts={courts} />
                    </div>
                  )}

                  {/* Match list */}
                  {matches.length > 0 && (
                    <div className="bg-white border border-zinc-200 rounded-xl p-6">
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
                                  ? 'bg-zinc-50 text-zinc-600'
                                  : m.status === 'completed'
                                    ? 'bg-green-50 text-green-700'
                                    : 'bg-white'
                              }`}
                            >
                              <span className="text-xs text-zinc-600 w-8">M{m.match_number}</span>
                              <span className="text-xs text-zinc-600 w-8">{m.round}</span>
                              <span className="flex-1">
                                {m.status === 'walkover' ? (
                                  <span>{m.notes}</span>
                                ) : m.notes?.startsWith('Winner') ? (
                                  <span className="text-amber-600">{m.notes}</span>
                                ) : (
                                  <span>
                                    {p1} <span className="text-zinc-600">vs</span> {p2}
                                  </span>
                                )}
                              </span>
                              {m.court && (
                                <span className="text-xs text-zinc-600">{m.court.name}</span>
                              )}
                              {m.scheduled_time && (
                                <span className="text-xs text-zinc-600">
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
