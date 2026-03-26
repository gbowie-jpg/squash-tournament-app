'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { slugify } from '@/lib/utils';
import { useAuth } from '@/lib/useAuth';
import type { Tournament } from '@/lib/supabase/types';

export default function TournamentSetup() {
  const { user, signOut } = useAuth();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [isSuperadmin, setIsSuperadmin] = useState(false);
  const [form, setForm] = useState({
    name: '',
    venue: '',
    address: '',
    start_date: '',
    end_date: '',
    court_count: 4,
    description: '',
  });

  useEffect(() => {
    fetch('/api/tournaments')
      .then((r) => r.json())
      .then((data) => { setTournaments(data); setLoading(false); });
    fetch('/api/auth/me')
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data?.role === 'superadmin') setIsSuperadmin(true); })
      .catch(() => {});
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const slug = slugify(form.name);
    const res = await fetch('/api/tournaments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, slug }),
    });
    if (res.ok) {
      const tournament = await res.json();
      setTournaments((prev) => [tournament, ...prev]);
      setShowForm(false);
      setForm({ name: '', venue: '', address: '', start_date: '', end_date: '', court_count: 4, description: '' });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this tournament and all its data?')) return;
    await fetch(`/api/tournaments/${id}`, { method: 'DELETE' });
    setTournaments((prev) => prev.filter((t) => t.id !== id));
  };

  const handleStatusChange = async (id: string, status: string) => {
    const res = await fetch(`/api/tournaments/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      const updated = await res.json();
      setTournaments((prev) => prev.map((t) => (t.id === id ? updated : t)));
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="bg-white border-b border-zinc-200">
        <div className="max-w-4xl mx-auto px-4 py-6 flex items-center justify-between">
          <div>
            <Link href="/admin" className="text-sm text-zinc-600 hover:text-zinc-800">&larr; Dashboard</Link>
            <h1 className="text-2xl font-bold tracking-tight mt-1">Tournament Setup</h1>
          </div>
          <div className="flex items-center gap-3">
            {isSuperadmin && (
              <Link
                href="/admin/users"
                className="text-zinc-500 hover:text-zinc-700 text-sm font-medium transition-colors"
              >
                Users
              </Link>
            )}
            <button
              onClick={() => setShowForm(!showForm)}
              className="bg-zinc-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-zinc-800 transition-colors"
            >
              {showForm ? 'Cancel' : '+ New Tournament'}
            </button>
            <button
              onClick={signOut}
              className="text-zinc-600 hover:text-zinc-800 text-sm transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {showForm && (
          <form onSubmit={handleCreate} className="bg-white border border-zinc-200 rounded-xl p-6 mb-8 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Tournament Name *</label>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="SSRA Spring Open 2026"
                  className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Venue</label>
                <input
                  value={form.venue}
                  onChange={(e) => setForm({ ...form, venue: e.target.value })}
                  placeholder="Seattle Athletic Club"
                  className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Start Date *</label>
                <input
                  required
                  type="date"
                  value={form.start_date}
                  onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                  className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">End Date</label>
                <input
                  type="date"
                  value={form.end_date}
                  onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                  className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Number of Courts</label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={form.court_count}
                  onChange={(e) => setForm({ ...form, court_count: parseInt(e.target.value) || 4 })}
                  className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Address</label>
                <input
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  placeholder="123 Main St, Seattle WA"
                  className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">Description</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={2}
                placeholder="Optional description..."
                className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
              />
            </div>
            <button
              type="submit"
              className="bg-zinc-900 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-zinc-800 transition-colors"
            >
              Create Tournament
            </button>
          </form>
        )}

        {loading ? (
          <p className="text-zinc-600 text-center py-12">Loading...</p>
        ) : tournaments.length === 0 ? (
          <p className="text-zinc-600 text-center py-12">No tournaments yet. Create one to get started.</p>
        ) : (
          <div className="space-y-3">
            {tournaments.map((t) => (
              <div key={t.id} className="bg-white border border-zinc-200 rounded-xl p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-semibold text-lg">{t.name}</h3>
                    <p className="text-zinc-600 text-sm">
                      {t.venue} &middot; {new Date(t.start_date + 'T00:00:00').toLocaleDateString()}
                      {t.end_date && ` – ${new Date(t.end_date + 'T00:00:00').toLocaleDateString()}`}
                    </p>
                    <p className="text-zinc-300 text-xs mt-1">/{t.slug}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={t.status}
                      onChange={(e) => handleStatusChange(t.id, e.target.value)}
                      className="border border-zinc-300 rounded-lg px-2 py-1 text-xs focus:outline-none"
                    >
                      <option value="upcoming">Upcoming</option>
                      <option value="active">Active</option>
                      <option value="completed">Completed</option>
                    </select>
                  </div>
                </div>
                <div className="flex gap-2 mt-4">
                  <Link
                    href={`/t/${t.slug}/admin`}
                    className="bg-zinc-100 text-zinc-700 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-zinc-200 transition-colors"
                  >
                    Manage
                  </Link>
                  <Link
                    href={`/t/${t.slug}`}
                    className="bg-zinc-100 text-zinc-700 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-zinc-200 transition-colors"
                  >
                    Public View
                  </Link>
                  <button
                    onClick={() => handleDelete(t.id)}
                    className="text-red-500 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-red-50 transition-colors ml-auto"
                  >
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
