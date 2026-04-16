'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { slugify } from '@/lib/utils';
import { useAuth } from '@/lib/useAuth';
import ThemeToggle from '@/components/ThemeToggle';
import type { Tournament } from '@/lib/supabase/types';
import { ChevronLeft, Trophy, ExternalLink, Settings2, Trash2 } from 'lucide-react';

const STATUS_COLORS: Record<string, string> = {
  upcoming: 'bg-blue-100 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300',
  active:   'bg-green-100 dark:bg-green-950/50 text-green-700 dark:text-green-300',
  completed:'bg-surface text-muted-foreground',
};

export default function TournamentSetup() {
  const { signOut } = useAuth();
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
    <div className="min-h-screen bg-[var(--surface)]">
      <header className="bg-[var(--surface-card)] border-b border-[var(--border)] sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <Link
              href="/admin"
              className="text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] flex items-center gap-1 mb-1"
            >
              <ChevronLeft className="w-3.5 h-3.5" /> Dashboard
            </Link>
            <h1 className="text-xl font-bold tracking-tight text-[var(--text-primary)]">Tournaments</h1>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            {isSuperadmin && (
              <Link
                href="/admin/users"
                className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors px-2 py-1"
              >
                Users
              </Link>
            )}
            <button
              onClick={() => setShowForm(!showForm)}
              className="bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
            >
              {showForm ? 'Cancel' : '+ New Tournament'}
            </button>
            <button
              onClick={signOut}
              className="text-sm text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Create form */}
        {showForm && (
          <form
            onSubmit={handleCreate}
            className="bg-[var(--surface-card)] border border-[var(--border)] rounded-xl p-6 mb-8 space-y-4"
          >
            <h2 className="font-semibold text-[var(--text-primary)]">New Tournament</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Tournament Name *</label>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="SSRA Spring Open 2026"
                  className="w-full border border-[var(--border)] rounded-lg px-3 py-2 text-sm bg-[var(--surface)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Venue</label>
                <input
                  value={form.venue}
                  onChange={(e) => setForm({ ...form, venue: e.target.value })}
                  placeholder="Seattle Athletic Club"
                  className="w-full border border-[var(--border)] rounded-lg px-3 py-2 text-sm bg-[var(--surface)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Start Date *</label>
                <input
                  required
                  type="date"
                  value={form.start_date}
                  onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                  className="w-full border border-[var(--border)] rounded-lg px-3 py-2 text-sm bg-[var(--surface)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">End Date</label>
                <input
                  type="date"
                  value={form.end_date}
                  onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                  className="w-full border border-[var(--border)] rounded-lg px-3 py-2 text-sm bg-[var(--surface)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Number of Courts</label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={form.court_count}
                  onChange={(e) => setForm({ ...form, court_count: parseInt(e.target.value) || 4 })}
                  className="w-full border border-[var(--border)] rounded-lg px-3 py-2 text-sm bg-[var(--surface)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Address</label>
                <input
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  placeholder="123 Main St, Seattle WA"
                  className="w-full border border-[var(--border)] rounded-lg px-3 py-2 text-sm bg-[var(--surface)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Description</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={2}
                placeholder="Optional description..."
                className="w-full border border-[var(--border)] rounded-lg px-3 py-2 text-sm bg-[var(--surface)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>
            <button
              type="submit"
              className="bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-6 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
            >
              Create Tournament
            </button>
          </form>
        )}

        {loading ? (
          <div className="space-y-3 animate-pulse">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-[var(--surface-card)] border border-[var(--border)] rounded-xl h-28" />
            ))}
          </div>
        ) : tournaments.length === 0 ? (
          <div className="text-center py-16">
            <Trophy className="w-10 h-10 text-[var(--text-muted)] mx-auto mb-3" strokeWidth={1.5} />
            <p className="text-[var(--text-secondary)]">No tournaments yet. Create one to get started.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {tournaments.map((t) => (
              <div key={t.id} className="bg-[var(--surface-card)] border border-[var(--border)] rounded-xl p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-lg text-[var(--text-primary)] truncate">{t.name}</h3>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[t.status] ?? STATUS_COLORS.upcoming}`}>
                        {t.status}
                      </span>
                    </div>
                    <p className="text-[var(--text-secondary)] text-sm mt-0.5">
                      {t.venue && <>{t.venue} · </>}
                      {new Date(t.start_date + 'T00:00:00').toLocaleDateString()}
                      {t.end_date && ` – ${new Date(t.end_date + 'T00:00:00').toLocaleDateString()}`}
                    </p>
                    <p className="text-[var(--text-muted)] text-xs mt-0.5 font-mono">/{t.slug}</p>
                  </div>
                  <select
                    value={t.status}
                    onChange={(e) => handleStatusChange(t.id, e.target.value)}
                    className="border border-[var(--border)] rounded-lg px-2 py-1 text-xs bg-[var(--surface)] text-[var(--text-primary)] focus:outline-none flex-shrink-0"
                  >
                    <option value="upcoming">Upcoming</option>
                    <option value="active">Active</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>

                <div className="flex items-center gap-2 mt-4 flex-wrap">
                  <Link
                    href={`/t/${t.slug}/admin`}
                    className="flex items-center gap-1.5 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-3 py-1.5 rounded-lg text-xs font-medium hover:opacity-90 transition-opacity"
                  >
                    <Settings2 className="w-3.5 h-3.5" />
                    Manage
                  </Link>
                  <Link
                    href={`/t/${t.slug}`}
                    className="flex items-center gap-1.5 bg-[var(--surface)] border border-[var(--border)] text-[var(--text-secondary)] px-3 py-1.5 rounded-lg text-xs font-medium hover:opacity-80 transition-opacity"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Public Page
                  </Link>
                  <button
                    onClick={() => handleDelete(t.id)}
                    className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-600 dark:hover:text-red-400 px-3 py-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors ml-auto"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
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
