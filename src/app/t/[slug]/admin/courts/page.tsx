'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useTournament } from '@/lib/useTournament';
import type { Court, MatchWithDetails } from '@/lib/supabase/types';
import { Zap } from 'lucide-react';

const STATUS_COLORS: Record<string, string> = {
  available: 'bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-400',
  in_use: 'bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400',
  maintenance: 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400',
};

export default function CourtManagement({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const { tournament } = useTournament(slug);
  const [courts, setCourts] = useState<Court[]>([]);
  const [matches, setMatches] = useState<MatchWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [assigning, setAssigning] = useState<Record<string, string>>({}); // courtId → selected matchId

  useEffect(() => {
    if (!tournament) return;
    Promise.all([
      fetch(`/api/tournaments/${tournament.id}/courts`).then(r => r.json()),
      fetch(`/api/tournaments/${tournament.id}/matches`).then(r => r.json()),
    ]).then(([c, m]) => {
      setCourts(c);
      setMatches(m);
      setLoading(false);
    });
  }, [tournament]);

  const patchMatch = async (matchId: string, updates: Record<string, unknown>) => {
    if (!tournament) return;
    const res = await fetch(`/api/tournaments/${tournament.id}/matches`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: matchId, ...updates }),
    });
    if (res.ok) {
      const updated = await res.json();
      setMatches(prev => prev.map(m => m.id === matchId ? updated : m));
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tournament || !newName.trim()) return;
    const res = await fetch(`/api/tournaments/${tournament.id}/courts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName.trim(), sort_order: courts.length }),
    });
    if (res.ok) {
      const court = await res.json();
      setCourts(prev => [...prev, court]);
      setNewName('');
    }
  };

  const handleStatusChange = async (courtId: string, status: string) => {
    if (!tournament) return;
    const res = await fetch(`/api/tournaments/${tournament.id}/courts`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: courtId, status }),
    });
    if (res.ok) {
      const updated = await res.json();
      setCourts(prev => prev.map(c => c.id === courtId ? updated : c));
    }
  };

  const handleDelete = async (courtId: string) => {
    if (!tournament || !confirm('Delete this court?')) return;
    await fetch(`/api/tournaments/${tournament.id}/courts`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ courtId }),
    });
    setCourts(prev => prev.filter(c => c.id !== courtId));
  };

  const handleAssign = async (courtId: string) => {
    const matchId = assigning[courtId];
    if (!matchId) return;
    await patchMatch(matchId, { court_id: courtId });
    setAssigning(prev => { const n = { ...prev }; delete n[courtId]; return n; });
  };

  const handleUnassign = async (matchId: string) => {
    await patchMatch(matchId, { court_id: null });
  };

  const handleAutoAssign = async () => {
    if (!tournament) return;
    const available = courts.filter(c => c.status === 'available');
    const unassigned = matches.filter(m => !m.court_id && (m.status === 'scheduled' || m.status === 'on_deck'));
    const pairs = available.slice(0, unassigned.length).map((c, i) => ({ court: c, match: unassigned[i] }));
    for (const { court, match } of pairs) {
      await patchMatch(match.id, { court_id: court.id });
    }
  };

  if (!tournament) return <div className="flex items-center justify-center min-h-screen text-[var(--text-secondary)]">Loading...</div>;

  const unassignedMatches = matches.filter(m => !m.court_id && (m.status === 'scheduled' || m.status === 'on_deck'));

  return (
    <div className="min-h-screen bg-[var(--surface)]">
      <header className="bg-[var(--surface-card)] border-b border-[var(--border)] sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <div className="flex items-center gap-1.5 text-sm text-[var(--text-secondary)]">
            <Link href="/admin" className="hover:text-[var(--text-primary)]">Admin</Link>
            <span>›</span>
            <Link href={`/t/${slug}/admin`} className="hover:text-[var(--text-primary)]">{tournament.name}</Link>
          </div>
          <div className="flex items-center justify-between mt-1">
            <div>
              <h1 className="text-xl font-bold text-[var(--text-primary)]">Courts</h1>
              <p className="text-xs text-[var(--text-secondary)]">{courts.length} courts · {unassignedMatches.length} unassigned matches</p>
            </div>
            {unassignedMatches.length > 0 && courts.some(c => c.status === 'available') && (
              <button
                onClick={handleAutoAssign}
                className="flex items-center gap-1.5 bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-blue-500"
              >
                <Zap className="w-3.5 h-3.5" strokeWidth={2} />
                Auto-Assign
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        {/* Add court */}
        <form onSubmit={handleAdd} className="flex gap-2">
          <input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="Court name (e.g. Court 5, Show Court)"
            className="flex-1 border border-[var(--border)] rounded-xl px-3 py-2 text-sm bg-[var(--surface)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button type="submit" className="bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-4 py-2 rounded-xl text-sm font-medium hover:opacity-90">
            Add
          </button>
        </form>

        {loading ? (
          <p className="text-[var(--text-secondary)] text-center py-12">Loading…</p>
        ) : courts.length === 0 ? (
          <p className="text-[var(--text-secondary)] text-center py-12">No courts yet. Add one above.</p>
        ) : (
          courts.map(c => {
            const assignedMatches = matches.filter(m => m.court_id === c.id && m.status !== 'completed' && m.status !== 'cancelled');
            const currentMatch = assignedMatches.find(m => m.status === 'in_progress');
            const nextMatch = assignedMatches.find(m => m.status === 'on_deck' || m.status === 'scheduled');

            return (
              <div key={c.id} className="bg-[var(--surface-card)] border border-[var(--border)] rounded-2xl overflow-hidden">
                {/* Court header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_COLORS[c.status]}`}>
                      {c.status.replace('_', ' ')}
                    </span>
                    <p className="font-semibold text-[var(--text-primary)]">{c.name}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={c.status}
                      onChange={e => handleStatusChange(c.id, e.target.value)}
                      className="border border-[var(--border)] rounded-lg px-2 py-1 text-xs bg-[var(--surface)] text-[var(--text-primary)]"
                    >
                      <option value="available">Available</option>
                      <option value="in_use">In Use</option>
                      <option value="maintenance">Maintenance</option>
                    </select>
                    <button onClick={() => handleDelete(c.id)} className="text-xs text-red-400 hover:text-red-500">
                      Delete
                    </button>
                  </div>
                </div>

                <div className="p-4 space-y-3">
                  {/* Current match */}
                  {currentMatch && (
                    <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-xl p-3">
                      <p className="text-xs font-semibold text-green-700 dark:text-green-400 uppercase tracking-wider mb-1">Now Playing</p>
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-[var(--text-primary)]">
                          {currentMatch.player1?.name ?? 'TBD'} <span className="text-[var(--text-muted)]">vs</span> {currentMatch.player2?.name ?? 'TBD'}
                        </p>
                        <button onClick={() => handleUnassign(currentMatch.id)} className="text-xs text-[var(--text-muted)] hover:text-red-500">
                          Unassign
                        </button>
                      </div>
                      {currentMatch.draw && <p className="text-xs text-[var(--text-secondary)] mt-0.5">{currentMatch.draw}{currentMatch.round ? ` · ${currentMatch.round}` : ''}</p>}
                    </div>
                  )}

                  {/* Next match */}
                  {nextMatch && (
                    <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3">
                      <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider mb-1">Up Next</p>
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-[var(--text-primary)]">
                          {nextMatch.player1?.name ?? 'TBD'} <span className="text-[var(--text-muted)]">vs</span> {nextMatch.player2?.name ?? 'TBD'}
                        </p>
                        <button onClick={() => handleUnassign(nextMatch.id)} className="text-xs text-[var(--text-muted)] hover:text-red-500">
                          Unassign
                        </button>
                      </div>
                      {nextMatch.draw && <p className="text-xs text-[var(--text-secondary)] mt-0.5">{nextMatch.draw}{nextMatch.round ? ` · ${nextMatch.round}` : ''}</p>}
                    </div>
                  )}

                  {/* Assign match dropdown */}
                  {unassignedMatches.length > 0 && (
                    <div className="flex gap-2">
                      <select
                        value={assigning[c.id] ?? ''}
                        onChange={e => setAssigning(prev => ({ ...prev, [c.id]: e.target.value }))}
                        className="flex-1 border border-[var(--border)] rounded-xl px-3 py-2 text-sm bg-[var(--surface)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Assign match…</option>
                        {unassignedMatches.map(m => (
                          <option key={m.id} value={m.id}>
                            {m.player1?.name ?? 'TBD'} vs {m.player2?.name ?? 'TBD'}{m.draw ? ` (${m.draw})` : ''}{m.round ? ` · ${m.round}` : ''}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => handleAssign(c.id)}
                        disabled={!assigning[c.id]}
                        className="bg-blue-600 text-white px-3 py-2 rounded-xl text-sm font-medium hover:bg-blue-500 disabled:opacity-40"
                      >
                        Assign
                      </button>
                    </div>
                  )}

                  {!currentMatch && !nextMatch && unassignedMatches.length === 0 && (
                    <p className="text-xs text-[var(--text-muted)] text-center py-1">No matches to assign</p>
                  )}
                </div>
              </div>
            );
          })
        )}
      </main>
    </div>
  );
}
