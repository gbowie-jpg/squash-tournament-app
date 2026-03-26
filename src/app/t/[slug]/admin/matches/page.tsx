'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useTournament } from '@/lib/useTournament';
import { formatScore } from '@/lib/utils';
import type { Player, Court, MatchWithDetails } from '@/lib/supabase/types';

const STATUS_OPTIONS = ['scheduled', 'on_deck', 'in_progress', 'completed', 'walkover', 'cancelled'] as const;
const STATUS_COLORS: Record<string, string> = {
  scheduled: 'bg-zinc-100 text-zinc-600',
  on_deck: 'bg-amber-100 text-amber-700',
  in_progress: 'bg-green-100 text-green-700',
  completed: 'bg-blue-100 text-blue-600',
  walkover: 'bg-purple-100 text-purple-600',
  cancelled: 'bg-red-100 text-red-600',
};

export default function MatchManagement({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const { tournament } = useTournament(slug);
  const [matches, setMatches] = useState<MatchWithDetails[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [courts, setCourts] = useState<Court[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState('all');
  const [scoringMatch, setScoringMatch] = useState<string | null>(null);
  const [scoreInput, setScoreInput] = useState({ p1: '', p2: '' });
  const [form, setForm] = useState({
    player1_id: '',
    player2_id: '',
    draw: '',
    round: '',
    court_id: '',
    scheduled_time: '',
  });

  useEffect(() => {
    if (!tournament) return;
    Promise.all([
      fetch(`/api/tournaments/${tournament.id}/matches`).then((r) => r.json()),
      fetch(`/api/tournaments/${tournament.id}/players`).then((r) => r.json()),
      fetch(`/api/tournaments/${tournament.id}/courts`).then((r) => r.json()),
    ]).then(([m, p, c]) => {
      setMatches(m);
      setPlayers(p);
      setCourts(c);
      setLoading(false);
    });
  }, [tournament]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tournament) return;
    const payload = {
      player1_id: form.player1_id || null,
      player2_id: form.player2_id || null,
      draw: form.draw || null,
      round: form.round || null,
      court_id: form.court_id || null,
      scheduled_time: form.scheduled_time || null,
      sort_order: matches.length,
    };
    const res = await fetch(`/api/tournaments/${tournament.id}/matches`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      const match = await res.json();
      setMatches((prev) => [...prev, match]);
      setShowForm(false);
      setForm({ player1_id: '', player2_id: '', draw: '', round: '', court_id: '', scheduled_time: '' });
    }
  };

  const handleUpdate = async (matchId: string, updates: Record<string, unknown>) => {
    if (!tournament) return;
    const res = await fetch(`/api/tournaments/${tournament.id}/matches`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: matchId, ...updates }),
    });
    if (res.ok) {
      const updated = await res.json();
      setMatches((prev) => prev.map((m) => (m.id === matchId ? updated : m)));
      // Re-fetch all to pick up on_deck changes
      const allRes = await fetch(`/api/tournaments/${tournament.id}/matches`);
      if (allRes.ok) setMatches(await allRes.json());
    }
  };

  const handleAddGame = async (matchId: string) => {
    const p1 = parseInt(scoreInput.p1);
    const p2 = parseInt(scoreInput.p2);
    if (isNaN(p1) || isNaN(p2)) return;
    const match = matches.find((m) => m.id === matchId);
    if (!match) return;
    const newScores = [...(match.scores || []), { p1, p2 }];
    await handleUpdate(matchId, { scores: newScores });
    setScoreInput({ p1: '', p2: '' });
  };

  const handleDelete = async (matchId: string) => {
    if (!tournament || !confirm('Delete this match?')) return;
    await fetch(`/api/tournaments/${tournament.id}/matches`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ matchId }),
    });
    setMatches((prev) => prev.filter((m) => m.id !== matchId));
  };

  if (!tournament || loading) {
    return <div className="flex items-center justify-center min-h-screen text-zinc-600">Loading...</div>;
  }

  const filtered = filter === 'all' ? matches : matches.filter((m) => m.status === filter);

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="bg-white border-b border-zinc-200">
        <div className="max-w-4xl mx-auto px-4 py-6 flex items-center justify-between">
          <div>
            <Link href={`/t/${slug}/admin`} className="text-sm text-zinc-600 hover:text-zinc-800">&larr; Admin</Link>
            <h1 className="text-2xl font-bold tracking-tight mt-1">Matches</h1>
            <p className="text-zinc-600 text-sm">{matches.length} matches</p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-zinc-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-zinc-800"
          >
            {showForm ? 'Cancel' : '+ New Match'}
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {showForm && (
          <form onSubmit={handleCreate} className="bg-white border border-zinc-200 rounded-xl p-6 mb-8 space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Player 1</label>
                <select
                  value={form.player1_id}
                  onChange={(e) => setForm({ ...form, player1_id: e.target.value })}
                  className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">Select player...</option>
                  {players.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}{p.draw ? ` (${p.draw})` : ''}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Player 2</label>
                <select
                  value={form.player2_id}
                  onChange={(e) => setForm({ ...form, player2_id: e.target.value })}
                  className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">Select player...</option>
                  {players.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}{p.draw ? ` (${p.draw})` : ''}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Court</label>
                <select
                  value={form.court_id}
                  onChange={(e) => setForm({ ...form, court_id: e.target.value })}
                  className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">Unassigned</option>
                  {courts.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Draw</label>
                <input
                  value={form.draw}
                  onChange={(e) => setForm({ ...form, draw: e.target.value })}
                  placeholder="Open, B..."
                  className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Round</label>
                <input
                  value={form.round}
                  onChange={(e) => setForm({ ...form, round: e.target.value })}
                  placeholder="QF, SF, F..."
                  className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Scheduled Time</label>
                <input
                  type="datetime-local"
                  value={form.scheduled_time}
                  onChange={(e) => setForm({ ...form, scheduled_time: e.target.value })}
                  className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
            </div>
            <button type="submit" className="bg-zinc-900 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-zinc-800">
              Create Match
            </button>
          </form>
        )}

        {/* Filters */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {['all', ...STATUS_OPTIONS].map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filter === s ? 'bg-zinc-900 text-white' : 'bg-white border border-zinc-200 text-zinc-600 hover:bg-zinc-50'
              }`}
            >
              {s === 'all' ? `All (${matches.length})` : `${s.replace('_', ' ')} (${matches.filter((m) => m.status === s).length})`}
            </button>
          ))}
        </div>

        {/* Match list */}
        {filtered.length === 0 ? (
          <p className="text-zinc-600 text-center py-12">No matches found.</p>
        ) : (
          <div className="space-y-3">
            {filtered.map((m) => (
              <div key={m.id} className="bg-white border border-zinc-200 rounded-xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[m.status]}`}>
                        {m.status.replace('_', ' ')}
                      </span>
                      {m.draw && <span className="text-xs text-zinc-600">{m.draw}</span>}
                      {m.round && <span className="text-xs text-zinc-600">&middot; {m.round}</span>}
                    </div>
                    <p className="font-semibold">
                      {m.player1?.name || 'TBD'} vs {m.player2?.name || 'TBD'}
                    </p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-zinc-600">
                      {m.court && <span>📍 {m.court.name}</span>}
                      {m.scheduled_time && (
                        <span>🕐 {new Date(m.scheduled_time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
                      )}
                      {m.referee && (
                        <span>🏁 {m.referee.name}</span>
                      )}
                      {m.scores && m.scores.length > 0 && (
                        <span className="font-medium text-zinc-600">{formatScore(m.scores)}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <select
                      value={m.court_id || ''}
                      onChange={(e) => handleUpdate(m.id, { court_id: e.target.value || null })}
                      className="border border-zinc-200 rounded px-2 py-1 text-xs"
                    >
                      <option value="">No court</option>
                      {courts.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-2 mt-3 flex-wrap">
                  {m.status === 'scheduled' && (
                    <button
                      onClick={() => handleUpdate(m.id, { status: 'on_deck' })}
                      className="text-xs bg-amber-50 text-amber-700 px-3 py-1.5 rounded-lg hover:bg-amber-100"
                    >
                      Set On Deck
                    </button>
                  )}
                  {(m.status === 'scheduled' || m.status === 'on_deck') && (
                    <button
                      onClick={() => handleUpdate(m.id, { status: 'in_progress' })}
                      className="text-xs bg-green-50 text-green-700 px-3 py-1.5 rounded-lg hover:bg-green-100"
                    >
                      Start Match
                    </button>
                  )}
                  {m.status === 'in_progress' && (
                    <>
                      <button
                        onClick={() => setScoringMatch(scoringMatch === m.id ? null : m.id)}
                        className="text-xs bg-blue-50 text-blue-700 px-3 py-1.5 rounded-lg hover:bg-blue-100"
                      >
                        {scoringMatch === m.id ? 'Hide Scoring' : 'Add Score'}
                      </button>
                      <button
                        onClick={() => {
                          const winnerId = m.scores && m.scores.length > 0
                            ? (() => {
                                let p1g = 0, p2g = 0;
                                m.scores.forEach((g) => { if (g.p1 > g.p2) p1g++; else p2g++; });
                                return p1g > p2g ? m.player1_id : m.player2_id;
                              })()
                            : null;
                          handleUpdate(m.id, { status: 'completed', winner_id: winnerId });
                        }}
                        className="text-xs bg-blue-50 text-blue-700 px-3 py-1.5 rounded-lg hover:bg-blue-100"
                      >
                        Complete
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => handleDelete(m.id)}
                    className="text-xs text-red-400 hover:text-red-600 ml-auto"
                  >
                    Delete
                  </button>
                </div>

                {/* Scoring panel */}
                {scoringMatch === m.id && (
                  <div className="mt-3 pt-3 border-t border-zinc-100">
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={0}
                        placeholder={m.player1?.name?.split(' ')[0] || 'P1'}
                        value={scoreInput.p1}
                        onChange={(e) => setScoreInput({ ...scoreInput, p1: e.target.value })}
                        className="w-20 border border-zinc-300 rounded px-2 py-1.5 text-sm text-center"
                      />
                      <span className="text-zinc-600 text-sm">—</span>
                      <input
                        type="number"
                        min={0}
                        placeholder={m.player2?.name?.split(' ')[0] || 'P2'}
                        value={scoreInput.p2}
                        onChange={(e) => setScoreInput({ ...scoreInput, p2: e.target.value })}
                        className="w-20 border border-zinc-300 rounded px-2 py-1.5 text-sm text-center"
                      />
                      <button
                        onClick={() => handleAddGame(m.id)}
                        className="bg-zinc-900 text-white px-3 py-1.5 rounded text-xs font-medium hover:bg-zinc-800"
                      >
                        Add Game
                      </button>
                    </div>
                    {m.scores && m.scores.length > 0 && (
                      <p className="text-xs text-zinc-500 mt-2">Games: {formatScore(m.scores)}</p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
