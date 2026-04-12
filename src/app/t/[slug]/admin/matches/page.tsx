'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useTournament } from '@/lib/useTournament';
import { formatScore } from '@/lib/utils';
import ThemeToggle from '@/components/ThemeToggle';
import RefreshButton from '@/components/RefreshButton';
import type { Player, Court, MatchWithDetails } from '@/lib/supabase/types';
import { List, LayoutGrid, Clock, MapPin, ArrowRight, Pencil, Check, X } from 'lucide-react';

const STATUS_OPTIONS = ['scheduled', 'on_deck', 'in_progress', 'completed', 'walkover', 'cancelled'] as const;
const STATUS_COLORS: Record<string, string> = {
  scheduled:   'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400',
  on_deck:     'bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400',
  in_progress: 'bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-400',
  completed:   'bg-blue-100 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400',
  walkover:    'bg-purple-100 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400',
  cancelled:   'bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400',
};

function fmt(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

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
  const [view, setView] = useState<'list' | 'schedule'>('list');
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState('all');
  const [scoringMatch, setScoringMatch] = useState<string | null>(null);
  const [scoreInput, setScoreInput] = useState({ p1: '', p2: '' });

  // Inline editing state
  const [editingTime, setEditingTime] = useState<string | null>(null);   // matchId
  const [timeInput, setTimeInput] = useState('');
  const [savingTime, setSavingTime] = useState<string | null>(null);

  const [form, setForm] = useState({
    player1_id: '',
    player2_id: '',
    draw: '',
    round: '',
    court_id: '',
    scheduled_time: '',
  });

  const loadAll = async (tournamentId: string) => {
    const [m, p, c] = await Promise.all([
      fetch(`/api/tournaments/${tournamentId}/matches`).then((r) => r.json()),
      fetch(`/api/tournaments/${tournamentId}/players`).then((r) => r.json()),
      fetch(`/api/tournaments/${tournamentId}/courts`).then((r) => r.json()),
    ]);
    setMatches(m);
    setPlayers(p);
    setCourts(c);
    setLoading(false);
  };

  useEffect(() => {
    if (!tournament) return;
    loadAll(tournament.id);
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
      // Re-fetch all to pick up on_deck and progression changes
      const allRes = await fetch(`/api/tournaments/${tournament.id}/matches`);
      if (allRes.ok) setMatches(await allRes.json());
    }
  };

  const handleSaveTime = async (matchId: string) => {
    if (!tournament) return;
    setSavingTime(matchId);
    await handleUpdate(matchId, {
      scheduled_time: timeInput ? new Date(timeInput).toISOString() : null,
    });
    setSavingTime(null);
    setEditingTime(null);
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
    return <div className="flex items-center justify-center min-h-screen text-[var(--text-secondary)]">Loading...</div>;
  }

  const filtered = filter === 'all' ? matches : matches.filter((m) => m.status === filter);

  // --- Schedule view helpers ---
  const courtsWithMatches = courts.map((court) => ({
    court,
    matches: matches
      .filter((m) => m.court_id === court.id)
      .sort((a, b) => {
        const statusOrder = ['in_progress', 'on_deck', 'scheduled', 'completed', 'walkover', 'cancelled'];
        const so = statusOrder.indexOf(a.status) - statusOrder.indexOf(b.status);
        if (so !== 0) return so;
        if (a.scheduled_time && b.scheduled_time) return new Date(a.scheduled_time).getTime() - new Date(b.scheduled_time).getTime();
        return a.sort_order - b.sort_order;
      }),
  }));
  const unassigned = matches.filter((m) => !m.court_id && m.status !== 'completed' && m.status !== 'cancelled');

  return (
    <div className="min-h-screen bg-[var(--surface)]">
      <header className="bg-[var(--surface-card)] border-b border-[var(--border)] sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] mb-1">
              <Link href="/admin" className="hover:text-[var(--text-secondary)]">Admin</Link>
              <span>›</span>
              <Link href={`/t/${slug}/admin`} className="hover:text-[var(--text-secondary)]">{tournament.name}</Link>
            </div>
            <h1 className="text-xl font-bold tracking-tight text-[var(--text-primary)]">Matches</h1>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">{matches.length} matches</p>
          </div>
          <div className="flex items-center gap-2">
            {/* View toggle */}
            <div className="flex rounded-lg border border-[var(--border)] overflow-hidden">
              <button
                onClick={() => setView('list')}
                className={`p-2 ${view === 'list' ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900' : 'bg-[var(--surface-card)] text-[var(--text-secondary)] hover:opacity-70'} transition-colors`}
                title="List view"
              >
                <List className="w-4 h-4" />
              </button>
              <button
                onClick={() => setView('schedule')}
                className={`p-2 ${view === 'schedule' ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900' : 'bg-[var(--surface-card)] text-[var(--text-secondary)] hover:opacity-70'} transition-colors`}
                title="Schedule view"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
            </div>
            <ThemeToggle />
            <RefreshButton />
            <button
              onClick={() => setShowForm(!showForm)}
              className="bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-3 py-2 rounded-lg text-sm font-medium hover:opacity-90"
            >
              {showForm ? 'Cancel' : '+ Match'}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        {/* Create form */}
        {showForm && (
          <form onSubmit={handleCreate} className="bg-[var(--surface-card)] border border-[var(--border)] rounded-xl p-6 mb-6 space-y-4">
            <h3 className="font-semibold text-[var(--text-primary)]">New Match</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Player 1</label>
                <select value={form.player1_id} onChange={(e) => setForm({ ...form, player1_id: e.target.value })}
                  className="w-full border border-[var(--border)] rounded-lg px-3 py-2 text-sm bg-[var(--surface)] text-[var(--text-primary)]">
                  <option value="">Select player...</option>
                  {players.map((p) => <option key={p.id} value={p.id}>{p.name}{p.draw ? ` (${p.draw})` : ''}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Player 2</label>
                <select value={form.player2_id} onChange={(e) => setForm({ ...form, player2_id: e.target.value })}
                  className="w-full border border-[var(--border)] rounded-lg px-3 py-2 text-sm bg-[var(--surface)] text-[var(--text-primary)]">
                  <option value="">Select player...</option>
                  {players.map((p) => <option key={p.id} value={p.id}>{p.name}{p.draw ? ` (${p.draw})` : ''}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Court</label>
                <select value={form.court_id} onChange={(e) => setForm({ ...form, court_id: e.target.value })}
                  className="w-full border border-[var(--border)] rounded-lg px-3 py-2 text-sm bg-[var(--surface)] text-[var(--text-primary)]">
                  <option value="">Unassigned</option>
                  {courts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Draw</label>
                <input value={form.draw} onChange={(e) => setForm({ ...form, draw: e.target.value })}
                  placeholder="Open, B..." className="w-full border border-[var(--border)] rounded-lg px-3 py-2 text-sm bg-[var(--surface)] text-[var(--text-primary)]" />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Round</label>
                <input value={form.round} onChange={(e) => setForm({ ...form, round: e.target.value })}
                  placeholder="QF, SF, F..." className="w-full border border-[var(--border)] rounded-lg px-3 py-2 text-sm bg-[var(--surface)] text-[var(--text-primary)]" />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Scheduled Time</label>
                <input type="datetime-local" value={form.scheduled_time} onChange={(e) => setForm({ ...form, scheduled_time: e.target.value })}
                  className="w-full border border-[var(--border)] rounded-lg px-3 py-2 text-sm bg-[var(--surface)] text-[var(--text-primary)]" />
              </div>
            </div>
            <button type="submit" className="bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-6 py-2 rounded-lg text-sm font-medium hover:opacity-90">
              Create Match
            </button>
          </form>
        )}

        {view === 'list' && (
          <>
            {/* Status filter */}
            <div className="flex gap-2 mb-5 flex-wrap">
              {['all', ...STATUS_OPTIONS].map((s) => (
                <button key={s} onClick={() => setFilter(s)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    filter === s ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900'
                      : 'bg-[var(--surface-card)] border border-[var(--border)] text-[var(--text-secondary)] hover:opacity-80'}`}>
                  {s === 'all' ? `All (${matches.length})` : `${s.replace('_', ' ')} (${matches.filter((m) => m.status === s).length})`}
                </button>
              ))}
            </div>

            {filtered.length === 0 ? (
              <p className="text-[var(--text-secondary)] text-center py-12">No matches found.</p>
            ) : (
              <div className="space-y-3">
                {filtered.map((m) => (
                  <MatchCard
                    key={m.id}
                    m={m}
                    courts={courts}
                    editingTime={editingTime}
                    timeInput={timeInput}
                    savingTime={savingTime}
                    scoringMatch={scoringMatch}
                    scoreInput={scoreInput}
                    onUpdate={handleUpdate}
                    onDelete={handleDelete}
                    onAddGame={handleAddGame}
                    onSetScoringMatch={setScoringMatch}
                    onSetScoreInput={setScoreInput}
                    onStartEditTime={(id, cur) => {
                      setEditingTime(id);
                      setTimeInput(cur ? cur.slice(0, 16) : '');
                    }}
                    onSaveTime={handleSaveTime}
                    onCancelEditTime={() => setEditingTime(null)}
                    onSetTimeInput={setTimeInput}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {view === 'schedule' && (
          <ScheduleView
            courtsWithMatches={courtsWithMatches}
            unassigned={unassigned}
            courts={courts}
            editingTime={editingTime}
            timeInput={timeInput}
            savingTime={savingTime}
            scoringMatch={scoringMatch}
            scoreInput={scoreInput}
            onUpdate={handleUpdate}
            onDelete={handleDelete}
            onAddGame={handleAddGame}
            onSetScoringMatch={setScoringMatch}
            onSetScoreInput={setScoreInput}
            onStartEditTime={(id, cur) => {
              setEditingTime(id);
              setTimeInput(cur ? cur.slice(0, 16) : '');
            }}
            onSaveTime={handleSaveTime}
            onCancelEditTime={() => setEditingTime(null)}
            onSetTimeInput={setTimeInput}
          />
        )}
      </main>
    </div>
  );
}

// ─── Schedule View ─────────────────────────────────────────────────────────────
interface ScheduleViewProps {
  courtsWithMatches: { court: Court; matches: MatchWithDetails[] }[];
  unassigned: MatchWithDetails[];
  courts: Court[];
  editingTime: string | null;
  timeInput: string;
  savingTime: string | null;
  scoringMatch: string | null;
  scoreInput: { p1: string; p2: string };
  onUpdate: (id: string, updates: Record<string, unknown>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onAddGame: (id: string) => Promise<void>;
  onSetScoringMatch: (id: string | null) => void;
  onSetScoreInput: (v: { p1: string; p2: string }) => void;
  onStartEditTime: (id: string, cur: string | null) => void;
  onSaveTime: (id: string) => Promise<void>;
  onCancelEditTime: () => void;
  onSetTimeInput: (v: string) => void;
}

function ScheduleView({
  courtsWithMatches, unassigned, courts, ...rest
}: ScheduleViewProps) {
  return (
    <div className="space-y-6">
      {/* Court columns */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {courtsWithMatches.map(({ court, matches }) => {
          const liveMatch = matches.find((m) => m.status === 'in_progress');
          return (
            <div key={court.id} className="bg-[var(--surface-card)] border border-[var(--border)] rounded-2xl overflow-hidden">
              {/* Court header */}
              <div className={`px-4 py-3 border-b border-[var(--border)] ${liveMatch ? 'bg-green-600' : 'bg-[var(--surface-card)]'}`}>
                <div className="flex items-center justify-between">
                  <h3 className={`font-bold text-sm ${liveMatch ? 'text-white' : 'text-[var(--text-primary)]'}`}>
                    {court.name}
                  </h3>
                  <span className={`text-xs ${liveMatch ? 'text-white/80' : 'text-[var(--text-muted)]'}`}>
                    {matches.length} match{matches.length !== 1 ? 'es' : ''}
                  </span>
                </div>
                {liveMatch && (
                  <p className="text-white/90 text-xs mt-0.5 truncate">
                    🎾 {liveMatch.player1?.name?.split(' ')[0]} vs {liveMatch.player2?.name?.split(' ')[0]}
                  </p>
                )}
              </div>

              {/* Match stack */}
              {matches.length === 0 ? (
                <p className="text-xs text-[var(--text-muted)] text-center py-6">No matches assigned</p>
              ) : (
                <div className="divide-y divide-[var(--border)]">
                  {matches.map((m, idx) => (
                    <ScheduleMatchCard
                      key={m.id}
                      m={m}
                      courts={courts}
                      position={idx}
                      {...rest}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Unassigned matches */}
      {unassigned.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3">
            Unassigned ({unassigned.length})
          </h3>
          <div className="bg-[var(--surface-card)] border border-[var(--border)] rounded-2xl overflow-hidden divide-y divide-[var(--border)]">
            {unassigned.map((m) => (
              <ScheduleMatchCard key={m.id} m={m} courts={courts} position={0} {...rest} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Schedule match card (compact, inside column) ──────────────────────────
interface ScheduleMatchCardProps {
  m: MatchWithDetails;
  courts: Court[];
  position: number;
  editingTime: string | null;
  timeInput: string;
  savingTime: string | null;
  scoringMatch: string | null;
  scoreInput: { p1: string; p2: string };
  onUpdate: (id: string, updates: Record<string, unknown>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onAddGame: (id: string) => Promise<void>;
  onSetScoringMatch: (id: string | null) => void;
  onSetScoreInput: (v: { p1: string; p2: string }) => void;
  onStartEditTime: (id: string, cur: string | null) => void;
  onSaveTime: (id: string) => Promise<void>;
  onCancelEditTime: () => void;
  onSetTimeInput: (v: string) => void;
}

function ScheduleMatchCard({ m, courts, ...rest }: ScheduleMatchCardProps) {
  const isLive = m.status === 'in_progress';
  const isOnDeck = m.status === 'on_deck';
  const otherCourts = courts.filter((c) => c.id !== m.court_id);

  return (
    <div className={`px-3 py-3 ${isLive ? 'bg-green-50 dark:bg-green-950/20' : isOnDeck ? 'bg-amber-50 dark:bg-amber-950/20' : ''}`}>
      {/* Status + draw/round */}
      <div className="flex items-center gap-2 mb-1.5">
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[m.status]}`}>
          {m.status.replace('_', ' ')}
        </span>
        {m.draw && <span className="text-xs text-[var(--text-muted)]">{m.draw}</span>}
        {m.round && <span className="text-xs text-[var(--text-muted)]">· {m.round}</span>}
      </div>

      {/* Players */}
      <p className="text-sm font-semibold text-[var(--text-primary)] leading-tight">
        {m.player1?.name || 'TBD'}
        <span className="font-normal text-[var(--text-muted)]"> vs </span>
        {m.player2?.name || 'TBD'}
      </p>

      {/* Time + score */}
      <div className="flex items-center gap-3 mt-1">
        {/* Inline time edit */}
        {rest.editingTime === m.id ? (
          <div className="flex items-center gap-1">
            <input
              type="datetime-local"
              value={rest.timeInput}
              onChange={(e) => rest.onSetTimeInput(e.target.value)}
              className="border border-[var(--border)] rounded px-2 py-0.5 text-xs bg-[var(--surface)] text-[var(--text-primary)] w-40"
            />
            <button onClick={() => rest.onSaveTime(m.id)} disabled={rest.savingTime === m.id}
              className="p-1 text-green-600 hover:text-green-700 disabled:opacity-50">
              <Check className="w-3.5 h-3.5" />
            </button>
            <button onClick={rest.onCancelEditTime} className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)]">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => rest.onStartEditTime(m.id, m.scheduled_time)}
            className="flex items-center gap-1 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] group"
          >
            <Clock className="w-3 h-3" strokeWidth={1.5} />
            {m.scheduled_time ? fmt(m.scheduled_time) : <span className="italic">Set time</span>}
            <Pencil className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>
        )}
        {m.scores && m.scores.length > 0 && (
          <span className="text-xs font-mono text-[var(--text-secondary)]">{formatScore(m.scores)}</span>
        )}
      </div>

      {/* Court assignment inline */}
      <div className="mt-2 flex items-center gap-2 flex-wrap">
        <select
          value={m.court_id || ''}
          onChange={(e) => rest.onUpdate(m.id, { court_id: e.target.value || null })}
          className="border border-[var(--border)] rounded px-2 py-1 text-xs bg-[var(--surface)] text-[var(--text-primary)] flex-1 min-w-0"
        >
          <option value="">No court</option>
          {courts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>

        {/* Quick move buttons */}
        {otherCourts.length > 0 && m.status !== 'completed' && m.status !== 'cancelled' && (
          <div className="flex gap-1">
            {otherCourts.slice(0, 3).map((c) => (
              <button
                key={c.id}
                onClick={() => rest.onUpdate(m.id, { court_id: c.id })}
                title={`Move to ${c.name}`}
                className="flex items-center gap-0.5 text-xs bg-zinc-100 dark:bg-zinc-800 text-[var(--text-secondary)] hover:bg-blue-100 dark:hover:bg-blue-950/40 hover:text-blue-700 dark:hover:text-blue-400 px-2 py-1 rounded transition-colors"
              >
                <ArrowRight className="w-2.5 h-2.5" />
                {c.name.replace(/court\s*/i, 'C')}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 mt-2 pt-2 border-t border-[var(--border)]">
        {m.status === 'scheduled' && (
          <button onClick={() => rest.onUpdate(m.id, { status: 'on_deck' })}
            className="text-xs bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 px-2 py-1 rounded hover:opacity-80">
            On Deck
          </button>
        )}
        {(m.status === 'scheduled' || m.status === 'on_deck') && (
          <button onClick={() => rest.onUpdate(m.id, { status: 'in_progress' })}
            className="text-xs bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400 px-2 py-1 rounded hover:opacity-80">
            Start
          </button>
        )}
        {m.status === 'in_progress' && (
          <button onClick={() => rest.onSetScoringMatch(rest.scoringMatch === m.id ? null : m.id)}
            className="text-xs bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 px-2 py-1 rounded hover:opacity-80">
            Score
          </button>
        )}
        <button onClick={() => rest.onDelete(m.id)} className="text-xs text-red-400 hover:text-red-600 ml-auto">
          Delete
        </button>
      </div>

      {/* Score input */}
      {rest.scoringMatch === m.id && (
        <div className="mt-2 flex items-center gap-2">
          <input type="number" min={0} placeholder="P1" value={rest.scoreInput.p1}
            onChange={(e) => rest.onSetScoreInput({ ...rest.scoreInput, p1: e.target.value })}
            className="w-14 border border-[var(--border)] rounded px-2 py-1 text-xs text-center bg-[var(--surface)] text-[var(--text-primary)]" />
          <span className="text-[var(--text-muted)] text-xs">—</span>
          <input type="number" min={0} placeholder="P2" value={rest.scoreInput.p2}
            onChange={(e) => rest.onSetScoreInput({ ...rest.scoreInput, p2: e.target.value })}
            className="w-14 border border-[var(--border)] rounded px-2 py-1 text-xs text-center bg-[var(--surface)] text-[var(--text-primary)]" />
          <button onClick={() => rest.onAddGame(m.id)}
            className="bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-2 py-1 rounded text-xs font-medium hover:opacity-90">
            + Game
          </button>
        </div>
      )}
    </div>
  );
}

// ─── List view match card ───────────────────────────────────────────────────
interface MatchCardProps extends Omit<ScheduleMatchCardProps, 'position'> {}

function MatchCard({ m, courts, ...rest }: MatchCardProps) {
  return (
    <div className="bg-[var(--surface-card)] border border-[var(--border)] rounded-xl p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[m.status]}`}>
              {m.status.replace('_', ' ')}
            </span>
            {m.draw && <span className="text-xs text-[var(--text-secondary)]">{m.draw}</span>}
            {m.round && <span className="text-xs text-[var(--text-secondary)]">&middot; {m.round}</span>}
          </div>
          <p className="font-semibold text-[var(--text-primary)]">
            {m.player1?.name || 'TBD'} vs {m.player2?.name || 'TBD'}
          </p>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            {m.court && (
              <span className="flex items-center gap-1 text-xs text-[var(--text-secondary)]">
                <MapPin className="w-3 h-3" strokeWidth={1.5} /> {m.court.name}
              </span>
            )}
            {/* Inline time edit */}
            {rest.editingTime === m.id ? (
              <div className="flex items-center gap-1">
                <input type="datetime-local" value={rest.timeInput}
                  onChange={(e) => rest.onSetTimeInput(e.target.value)}
                  className="border border-[var(--border)] rounded px-2 py-0.5 text-xs bg-[var(--surface)] text-[var(--text-primary)]" />
                <button onClick={() => rest.onSaveTime(m.id)} disabled={rest.savingTime === m.id}
                  className="p-1 text-green-600 disabled:opacity-50"><Check className="w-3.5 h-3.5" /></button>
                <button onClick={rest.onCancelEditTime} className="p-1 text-[var(--text-muted)]"><X className="w-3.5 h-3.5" /></button>
              </div>
            ) : (
              <button onClick={() => rest.onStartEditTime(m.id, m.scheduled_time)}
                className="flex items-center gap-1 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] group">
                <Clock className="w-3 h-3" strokeWidth={1.5} />
                {m.scheduled_time ? fmt(m.scheduled_time) : <span className="italic text-[var(--text-muted)]">Set time</span>}
                <Pencil className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            )}
            {m.referee && <span className="text-xs text-[var(--text-secondary)]">🏁 {m.referee.name}</span>}
            {m.scores && m.scores.length > 0 && (
              <span className="text-xs font-mono font-medium text-[var(--text-secondary)]">{formatScore(m.scores)}</span>
            )}
          </div>
        </div>

        {/* Court selector */}
        <div className="flex items-center gap-1">
          <select value={m.court_id || ''} onChange={(e) => rest.onUpdate(m.id, { court_id: e.target.value || null })}
            className="border border-[var(--border)] rounded px-2 py-1 text-xs bg-[var(--surface)] text-[var(--text-primary)]">
            <option value="">No court</option>
            {courts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-2 mt-3 flex-wrap">
        {m.status === 'scheduled' && (
          <button onClick={() => rest.onUpdate(m.id, { status: 'on_deck' })}
            className="text-xs bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 px-3 py-1.5 rounded-lg hover:opacity-80">
            Set On Deck
          </button>
        )}
        {(m.status === 'scheduled' || m.status === 'on_deck') && (
          <button onClick={() => rest.onUpdate(m.id, { status: 'in_progress' })}
            className="text-xs bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400 px-3 py-1.5 rounded-lg hover:opacity-80">
            Start Match
          </button>
        )}
        {m.status === 'in_progress' && (
          <>
            <button onClick={() => rest.onSetScoringMatch(rest.scoringMatch === m.id ? null : m.id)}
              className="text-xs bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 px-3 py-1.5 rounded-lg hover:opacity-80">
              {rest.scoringMatch === m.id ? 'Hide Scoring' : 'Add Score'}
            </button>
            <button
              onClick={() => {
                const winnerId = m.scores?.length
                  ? (() => { let p1g = 0, p2g = 0; m.scores.forEach((g) => { if (g.p1 > g.p2) p1g++; else p2g++; }); return p1g > p2g ? m.player1_id : m.player2_id; })()
                  : null;
                rest.onUpdate(m.id, { status: 'completed', winner_id: winnerId });
              }}
              className="text-xs bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 px-3 py-1.5 rounded-lg hover:opacity-80">
              Complete
            </button>
          </>
        )}
        <button onClick={() => rest.onDelete(m.id)} className="text-xs text-red-400 hover:text-red-600 ml-auto">
          Delete
        </button>
      </div>

      {/* Scoring panel */}
      {rest.scoringMatch === m.id && (
        <div className="mt-3 pt-3 border-t border-[var(--border)]">
          <div className="flex items-center gap-2">
            <input type="number" min={0} placeholder={m.player1?.name?.split(' ')[0] || 'P1'} value={rest.scoreInput.p1}
              onChange={(e) => rest.onSetScoreInput({ ...rest.scoreInput, p1: e.target.value })}
              className="w-20 border border-[var(--border)] rounded px-2 py-1.5 text-sm text-center bg-[var(--surface)] text-[var(--text-primary)]" />
            <span className="text-[var(--text-secondary)] text-sm">—</span>
            <input type="number" min={0} placeholder={m.player2?.name?.split(' ')[0] || 'P2'} value={rest.scoreInput.p2}
              onChange={(e) => rest.onSetScoreInput({ ...rest.scoreInput, p2: e.target.value })}
              className="w-20 border border-[var(--border)] rounded px-2 py-1.5 text-sm text-center bg-[var(--surface)] text-[var(--text-primary)]" />
            <button onClick={() => rest.onAddGame(m.id)}
              className="bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-3 py-1.5 rounded text-xs font-medium hover:opacity-90">
              Add Game
            </button>
          </div>
          {m.scores && m.scores.length > 0 && (
            <p className="text-xs text-[var(--text-secondary)] mt-2">Games: {formatScore(m.scores)}</p>
          )}
        </div>
      )}
    </div>
  );
}
