'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useTournament } from '@/lib/useTournament';
import CsvUpload from '@/components/admin/CsvUpload';
import ThemeToggle from '@/components/ThemeToggle';
import RefreshButton from '@/components/RefreshButton';
import type { Player } from '@/lib/supabase/types';

export default function PlayerManagement({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const { tournament, loading: tournamentLoading } = useTournament(slug);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', draw: '', seed: '', club: '', email: '' });

  useEffect(() => {
    if (!tournament) return;
    fetch(`/api/tournaments/${tournament.id}/players`)
      .then((r) => r.json())
      .then((data) => { setPlayers(data); setLoading(false); });
  }, [tournament]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tournament) return;
    const payload = {
      name: form.name,
      draw: form.draw || null,
      seed: form.seed ? parseInt(form.seed) : null,
      club: form.club || null,
      email: form.email || null,
    };

    if (editingId) {
      const res = await fetch(`/api/tournaments/${tournament.id}/players`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editingId, ...payload }),
      });
      if (res.ok) {
        const updated = await res.json();
        setPlayers((prev) => prev.map((p) => (p.id === editingId ? updated : p)));
        setEditingId(null);
      }
    } else {
      const res = await fetch(`/api/tournaments/${tournament.id}/players`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const player = await res.json();
        setPlayers((prev) => [...prev, player]);
      }
    }
    setForm({ name: '', draw: '', seed: '', club: '', email: '' });
    setShowForm(false);
  };

  const handleEdit = (p: Player) => {
    setForm({
      name: p.name,
      draw: p.draw || '',
      seed: p.seed?.toString() || '',
      club: p.club || '',
      email: p.email || '',
    });
    setEditingId(p.id);
    setShowForm(true);
  };

  const handleDelete = async (playerId: string) => {
    if (!tournament || !confirm('Delete this player?')) return;
    await fetch(`/api/tournaments/${tournament.id}/players`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId }),
    });
    setPlayers((prev) => prev.filter((p) => p.id !== playerId));
  };

  if (tournamentLoading) return (
    <div className="min-h-screen bg-background p-6 space-y-4 animate-pulse">
      <div className="h-10 bg-surface rounded-xl w-1/3" />
      <div className="h-8 bg-surface rounded-xl w-1/4" />
      {[...Array(4)].map((_, i) => (
        <div key={i} className="h-12 bg-surface rounded-xl" />
      ))}
    </div>
  );
  if (!tournament) return <div className="flex items-center justify-center min-h-screen text-muted-foreground">Not found</div>;

  // Group by draw
  const draws = [...new Set(players.map((p) => p.draw || 'Unassigned'))].sort();

  return (
    <div className="min-h-screen bg-[var(--surface)]">
      <header className="bg-[var(--surface-card)] border-b border-[var(--border)]">
        <div className="max-w-4xl mx-auto px-4 py-6 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5 text-sm text-[var(--text-muted)]">
              <Link href="/admin" className="hover:text-[var(--text-secondary)]">Admin Dashboard</Link>
              <span>›</span>
              <Link href={`/t/${slug}/admin`} className="hover:text-[var(--text-secondary)]">{tournament?.name ?? slug}</Link>
            </div>
            <h1 className="text-2xl font-bold tracking-tight mt-1">Players</h1>
            <p className="text-[var(--text-secondary)] text-sm">{players.length} players</p>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <RefreshButton />
            <button
              onClick={() => { setShowForm(!showForm); setEditingId(null); setForm({ name: '', draw: '', seed: '', club: '', email: '' }); }}
              className="bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90"
            >
              {showForm ? 'Cancel' : '+ Add Player'}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {showForm && (
          <form onSubmit={handleSubmit} className="bg-[var(--surface-card)] border border-[var(--border)] rounded-xl p-6 mb-8 space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div className="col-span-2 sm:col-span-1">
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Name *</label>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Alex Chen"
                  className="w-full border border-[var(--border)] rounded-lg px-3 py-2 text-sm bg-[var(--surface)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-zinc-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Draw</label>
                <input
                  value={form.draw}
                  onChange={(e) => setForm({ ...form, draw: e.target.value })}
                  placeholder="Open, B, C..."
                  className="w-full border border-[var(--border)] rounded-lg px-3 py-2 text-sm bg-[var(--surface)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-zinc-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Seed</label>
                <input
                  type="number"
                  min={1}
                  value={form.seed}
                  onChange={(e) => setForm({ ...form, seed: e.target.value })}
                  placeholder="#"
                  className="w-full border border-[var(--border)] rounded-lg px-3 py-2 text-sm bg-[var(--surface)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-zinc-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Club</label>
                <input
                  value={form.club}
                  onChange={(e) => setForm({ ...form, club: e.target.value })}
                  placeholder="SAC"
                  className="w-full border border-[var(--border)] rounded-lg px-3 py-2 text-sm bg-[var(--surface)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-zinc-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="alex@example.com"
                  className="w-full border border-[var(--border)] rounded-lg px-3 py-2 text-sm bg-[var(--surface)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-zinc-900"
                />
              </div>
            </div>
            <button type="submit" className="bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-6 py-2 rounded-lg text-sm font-medium hover:opacity-90">
              {editingId ? 'Update Player' : 'Add Player'}
            </button>
          </form>
        )}

        {/* CSV Upload */}
        {!showForm && tournament && (
          <div className="mb-8">
            <CsvUpload
              tournamentId={tournament.id}
              onImport={(imported) => setPlayers((prev) => [...prev, ...imported as unknown as Player[]])}
            />
          </div>
        )}

        {loading ? (
          <div className="space-y-4 animate-pulse">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-surface rounded-xl h-32" />
            ))}
          </div>
        ) : players.length === 0 ? (
          <p className="text-[var(--text-secondary)] text-center py-12">No players yet. Add some to get started.</p>
        ) : (
          draws.map((draw) => (
            <div key={draw} className="mb-6">
              <h2 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3">{draw} Draw</h2>
              <div className="bg-[var(--surface-card)] border border-[var(--border)] rounded-xl overflow-hidden">
                {players
                  .filter((p) => (p.draw || 'Unassigned') === draw)
                  .map((p, i) => (
                    <div
                      key={p.id}
                      className={`flex items-center justify-between px-4 py-3 ${i > 0 ? 'border-t border-[var(--border)]' : ''}`}
                    >
                      <div className="flex items-center gap-3">
                        {p.seed && (
                          <span className="w-6 h-6 rounded-full bg-surface text-muted-foreground text-xs font-medium flex items-center justify-center">
                            {p.seed}
                          </span>
                        )}
                        <div>
                          <p className="text-sm font-medium text-[var(--text-primary)]">{p.name}</p>
                          {p.club && <p className="text-xs text-[var(--text-secondary)]">{p.club}</p>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => handleEdit(p)} className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]">Edit</button>
                        <button onClick={() => handleDelete(p.id)} className="text-xs text-red-400 hover:text-red-600">Delete</button>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          ))
        )}
      </main>
    </div>
  );
}
