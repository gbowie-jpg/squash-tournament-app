'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useTournament } from '@/lib/useTournament';
import type { Court } from '@/lib/supabase/types';

const STATUS_COLORS: Record<string, string> = {
  available: 'bg-green-100 text-green-700',
  in_use: 'bg-amber-100 text-amber-700',
  maintenance: 'bg-zinc-100 text-zinc-500',
};

export default function CourtManagement({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const { tournament } = useTournament(slug);
  const [courts, setCourts] = useState<Court[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');

  useEffect(() => {
    if (!tournament) return;
    fetch(`/api/tournaments/${tournament.id}/courts`)
      .then((r) => r.json())
      .then((data) => { setCourts(data); setLoading(false); });
  }, [tournament]);

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
      setCourts((prev) => [...prev, court]);
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
      setCourts((prev) => prev.map((c) => (c.id === courtId ? updated : c)));
    }
  };

  const handleDelete = async (courtId: string) => {
    if (!tournament || !confirm('Delete this court?')) return;
    await fetch(`/api/tournaments/${tournament.id}/courts`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ courtId }),
    });
    setCourts((prev) => prev.filter((c) => c.id !== courtId));
  };

  if (!tournament) return <div className="flex items-center justify-center min-h-screen text-zinc-400">Loading...</div>;

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="bg-white border-b border-zinc-200">
        <div className="max-w-3xl mx-auto px-4 py-6">
          <Link href={`/t/${slug}/admin`} className="text-sm text-zinc-400 hover:text-zinc-600">&larr; Admin</Link>
          <h1 className="text-2xl font-bold tracking-tight mt-1">Courts</h1>
          <p className="text-zinc-400 text-sm">{courts.length} courts</p>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        <form onSubmit={handleAdd} className="flex gap-2 mb-6">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Court name (e.g. Court 5, Show Court)"
            className="flex-1 border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
          />
          <button type="submit" className="bg-zinc-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-zinc-800">
            Add
          </button>
        </form>

        {loading ? (
          <p className="text-zinc-400 text-center py-12">Loading...</p>
        ) : courts.length === 0 ? (
          <p className="text-zinc-400 text-center py-12">No courts. Add one above.</p>
        ) : (
          <div className="space-y-3">
            {courts.map((c) => (
              <div key={c.id} className="bg-white border border-zinc-200 rounded-xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_COLORS[c.status]}`}>
                    {c.status.replace('_', ' ')}
                  </span>
                  <p className="font-medium">{c.name}</p>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={c.status}
                    onChange={(e) => handleStatusChange(c.id, e.target.value)}
                    className="border border-zinc-200 rounded px-2 py-1 text-xs"
                  >
                    <option value="available">Available</option>
                    <option value="in_use">In Use</option>
                    <option value="maintenance">Maintenance</option>
                  </select>
                  <button onClick={() => handleDelete(c.id)} className="text-xs text-red-400 hover:text-red-600">
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
