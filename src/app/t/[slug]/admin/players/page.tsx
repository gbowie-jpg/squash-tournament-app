'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useTournament } from '@/lib/useTournament';
import CsvUpload from '@/components/admin/CsvUpload';
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

  if (tournamentLoading) return <div className="flex items-center justify-center min-h-screen text-zinc-600">Loading...</div>;
  if (!tournament) return <div className="flex items-center justify-center min-h-screen text-zinc-600">Not found</div>;

  // Group by draw
  const draws = [...new Set(players.map((p) => p.draw || 'Unassigned'))].sort();

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="bg-white border-b border-zinc-200">
        <div className="max-w-4xl mx-auto px-4 py-6 flex items-center justify-between">
          <div>
            <Link href={`/t/${slug}/admin`} className="text-sm text-zinc-600 hover:text-zinc-800">&larr; Admin</Link>
            <h1 className="text-2xl font-bold tracking-tight mt-1">Players</h1>
            <p className="text-zinc-600 text-sm">{players.length} players</p>
          </div>
          <button
            onClick={() => { setShowForm(!showForm); setEditingId(null); setForm({ name: '', draw: '', seed: '', club: '', email: '' }); }}
            className="bg-zinc-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-zinc-800"
          >
            {showForm ? 'Cancel' : '+ Add Player'}
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {showForm && (
          <form onSubmit={handleSubmit} className="bg-white border border-zinc-200 rounded-xl p-6 mb-8 space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div className="col-span-2 sm:col-span-1">
                <label className="block text-sm font-medium text-zinc-700 mb-1">Name *</label>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Alex Chen"
                  className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Draw</label>
                <input
                  value={form.draw}
                  onChange={(e) => setForm({ ...form, draw: e.target.value })}
                  placeholder="Open, B, C..."
                  className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Seed</label>
                <input
                  type="number"
                  min={1}
                  value={form.seed}
                  onChange={(e) => setForm({ ...form, seed: e.target.value })}
                  placeholder="#"
                  className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Club</label>
                <input
                  value={form.club}
                  onChange={(e) => setForm({ ...form, club: e.target.value })}
                  placeholder="SAC"
                  className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="alex@example.com"
                  className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
                />
              </div>
            </div>
            <button type="submit" className="bg-zinc-900 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-zinc-800">
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
          <p className="text-zinc-600 text-center py-12">Loading...</p>
        ) : players.length === 0 ? (
          <p className="text-zinc-600 text-center py-12">No players yet. Add some to get started.</p>
        ) : (
          draws.map((draw) => (
            <div key={draw} className="mb-6">
              <h2 className="text-sm font-semibold text-zinc-600 uppercase tracking-wider mb-3">{draw} Draw</h2>
              <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
                {players
                  .filter((p) => (p.draw || 'Unassigned') === draw)
                  .map((p, i) => (
                    <div
                      key={p.id}
                      className={`flex items-center justify-between px-4 py-3 ${i > 0 ? 'border-t border-zinc-100' : ''}`}
                    >
                      <div className="flex items-center gap-3">
                        {p.seed && (
                          <span className="w-6 h-6 rounded-full bg-zinc-100 text-zinc-600 text-xs font-medium flex items-center justify-center">
                            {p.seed}
                          </span>
                        )}
                        <div>
                          <p className="text-sm font-medium">{p.name}</p>
                          {p.club && <p className="text-xs text-zinc-600">{p.club}</p>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => handleEdit(p)} className="text-xs text-zinc-600 hover:text-zinc-800">Edit</button>
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
