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
  const [customDraw, setCustomDraw] = useState(false);
  const [customClub, setCustomClub] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [addError, setAddError] = useState<string | null>(null);
  const [importSkipped, setImportSkipped] = useState<{ name: string; email: string; existingName: string }[]>([]);

  useEffect(() => {
    if (!tournament) return;
    fetch(`/api/tournaments/${tournament.id}/players`)
      .then((r) => r.json())
      .then((data) => { setPlayers(data); setLoading(false); });
  }, [tournament]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tournament) return;
    setAddError(null);
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
      } else {
        const err = await res.json().catch(() => ({}));
        setAddError(err.error || 'Update failed');
        return;
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
      } else {
        const err = await res.json().catch(() => ({}));
        setAddError(err.error || 'Add failed');
        return;
      }
    }
    setForm({ name: '', draw: '', seed: '', club: '', email: '' });
    setShowForm(false);
  };

  const handleEdit = (p: Player) => {
    const draw = p.draw || '';
    const club = p.club || '';
    setForm({ name: p.name, draw, seed: p.seed?.toString() || '', club, email: p.email || '' });
    setEditingId(p.id);
    setShowForm(true);
    // Will be resolved after drawNames/clubNames are computed below, but set conservatively
    setCustomDraw(false);
    setCustomClub(false);
  };

  const moveDraw = async (playerId: string, newDraw: string) => {
    if (!tournament) return;
    const res = await fetch(`/api/tournaments/${tournament.id}/players`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: playerId, draw: newDraw || null }),
    });
    if (res.ok) {
      const updated = await res.json();
      setPlayers((prev) => prev.map((p) => (p.id === playerId ? updated : p)));
    }
  };

  const handleDelete = async (playerId: string) => {
    if (!tournament || !confirm('Delete this player?')) return;
    await fetch(`/api/tournaments/${tournament.id}/players`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId }),
    });
    setPlayers((prev) => prev.filter((p) => p.id !== playerId));
    setSelected((prev) => { const s = new Set(prev); s.delete(playerId); return s; });
  };

  const handleBulkDelete = async () => {
    if (!tournament || selected.size === 0) return;
    if (!confirm(`Delete ${selected.size} player${selected.size !== 1 ? 's' : ''}? This cannot be undone.`)) return;
    setBulkDeleting(true);
    setBulkError(null);
    const res = await fetch(`/api/tournaments/${tournament.id}/players`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerIds: [...selected] }),
    });
    if (res.ok) {
      setPlayers((prev) => prev.filter((p) => !selected.has(p.id)));
      setSelected(new Set());
    } else {
      const err = await res.json().catch(() => ({}));
      setBulkError(err.error || 'Delete failed — try again');
    }
    setBulkDeleting(false);
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  };

  const toggleDraw = (drawName: string) => {
    const drawIds = players.filter((p) => (p.draw || 'Unassigned') === drawName).map((p) => p.id);
    const allSelected = drawIds.every((id) => selected.has(id));
    setSelected((prev) => {
      const s = new Set(prev);
      drawIds.forEach((id) => allSelected ? s.delete(id) : s.add(id));
      return s;
    });
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
  const drawNames = [...new Set(players.map((p) => p.draw).filter(Boolean) as string[])].sort();
  const clubNames = [...new Set(players.map((p) => p.club).filter(Boolean) as string[])].sort();

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
              onClick={() => { setShowForm(!showForm); setEditingId(null); setForm({ name: '', draw: '', seed: '', club: '', email: '' }); setCustomDraw(false); setCustomClub(false); }}
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
                {customDraw ? (
                  <div className="flex gap-1">
                    <input
                      autoFocus
                      value={form.draw}
                      onChange={(e) => setForm({ ...form, draw: e.target.value })}
                      placeholder="New draw name"
                      className="flex-1 border border-[var(--border)] rounded-lg px-3 py-2 text-sm bg-[var(--surface)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-zinc-900"
                    />
                    <button type="button" onClick={() => { setCustomDraw(false); setForm({ ...form, draw: '' }); }} className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] px-2">✕</button>
                  </div>
                ) : (
                  <select
                    value={form.draw}
                    onChange={(e) => {
                      if (e.target.value === '__new__') { setCustomDraw(true); setForm({ ...form, draw: '' }); }
                      else setForm({ ...form, draw: e.target.value });
                    }}
                    className="w-full border border-[var(--border)] rounded-lg px-3 py-2 text-sm bg-[var(--surface)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-zinc-900"
                  >
                    <option value="">— None —</option>
                    {drawNames.map((d) => <option key={d} value={d}>{d}</option>)}
                    <option value="__new__">+ New draw…</option>
                  </select>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Seed</label>
                <select
                  value={form.seed}
                  onChange={(e) => setForm({ ...form, seed: e.target.value })}
                  className="w-full border border-[var(--border)] rounded-lg px-3 py-2 text-sm bg-[var(--surface)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-zinc-900"
                >
                  <option value="">— None —</option>
                  {Array.from(
                    { length: Math.max(players.filter((p) => p.draw === form.draw && p.id !== editingId).length + 1, 16) },
                    (_, i) => i + 1
                  ).map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Club</label>
                {customClub ? (
                  <div className="flex gap-1">
                    <input
                      autoFocus
                      value={form.club}
                      onChange={(e) => setForm({ ...form, club: e.target.value })}
                      placeholder="Club name"
                      className="flex-1 border border-[var(--border)] rounded-lg px-3 py-2 text-sm bg-[var(--surface)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-zinc-900"
                    />
                    <button type="button" onClick={() => { setCustomClub(false); setForm({ ...form, club: '' }); }} className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] px-2">✕</button>
                  </div>
                ) : (
                  <select
                    value={form.club}
                    onChange={(e) => {
                      if (e.target.value === '__new__') { setCustomClub(true); setForm({ ...form, club: '' }); }
                      else setForm({ ...form, club: e.target.value });
                    }}
                    className="w-full border border-[var(--border)] rounded-lg px-3 py-2 text-sm bg-[var(--surface)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-zinc-900"
                  >
                    <option value="">— None —</option>
                    {clubNames.map((c) => <option key={c} value={c}>{c}</option>)}
                    <option value="__new__">+ New club…</option>
                  </select>
                )}
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
            {addError && (
              <div className="mt-2 text-sm text-red-600 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">
                ⚠ {addError}
              </div>
            )}
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
              existingPlayers={players}
              onImport={(imported, skipped) => {
                setPlayers((prev) => [...prev, ...imported as unknown as Player[]]);
                setImportSkipped(skipped ?? []);
              }}
            />
            {importSkipped.length > 0 && (
              <div className="mt-3 text-sm bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 rounded-lg px-4 py-3">
                <p className="font-medium mb-1">⚠ {importSkipped.length} duplicate{importSkipped.length !== 1 ? 's' : ''} skipped — email already in tournament:</p>
                <ul className="space-y-0.5 text-xs">
                  {importSkipped.map((s) => (
                    <li key={s.email}><span className="font-medium">{s.name}</span> ({s.email}) — already listed as <span className="font-medium">{s.existingName}</span></li>
                  ))}
                </ul>
                <button onClick={() => setImportSkipped([])} className="mt-2 text-xs underline opacity-70 hover:opacity-100">Dismiss</button>
              </div>
            )}
          </div>
        )}

        {/* Bulk action bar */}
        {selected.size > 0 && (
          <div className="sticky top-0 z-10 mb-4 flex items-center gap-3 bg-zinc-900 text-white px-4 py-3 rounded-xl shadow-lg flex-wrap">
            <span className="text-sm font-medium">{selected.size} player{selected.size !== 1 ? 's' : ''} selected</span>
            <button
              onClick={() => setSelected(new Set())}
              className="text-xs text-zinc-400 hover:text-white underline"
            >
              Clear
            </button>
            <div className="flex-1" />
            {bulkError && <span className="text-xs text-red-400">{bulkError}</span>}
            <button
              onClick={handleBulkDelete}
              disabled={bulkDeleting}
              className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-1.5 rounded-lg"
            >
              {bulkDeleting ? 'Deleting…' : `Delete ${selected.size}`}
            </button>
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
          draws.map((draw) => {
            const drawPlayers = players.filter((p) => (p.draw || 'Unassigned') === draw);
            const allDrawSelected = drawPlayers.every((p) => selected.has(p.id));
            return (
            <div key={draw} className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <input
                  type="checkbox"
                  checked={allDrawSelected && drawPlayers.length > 0}
                  onChange={() => toggleDraw(draw)}
                  className="w-4 h-4 rounded border-[var(--border)] cursor-pointer"
                  title={allDrawSelected ? 'Deselect all in this draw' : 'Select all in this draw'}
                />
                <h2 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider">{draw} Draw <span className="font-normal normal-case">({drawPlayers.length})</span></h2>
              </div>
              <div className="bg-[var(--surface-card)] border border-[var(--border)] rounded-xl overflow-hidden">
                {drawPlayers
                  .map((p, i) => (
                    <div
                      key={p.id}
                      className={`flex items-center justify-between px-4 py-3 ${i > 0 ? 'border-t border-[var(--border)]' : ''} ${selected.has(p.id) ? 'bg-blue-50 dark:bg-blue-950/20' : ''}`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={selected.has(p.id)}
                          onChange={() => toggleSelect(p.id)}
                          className="w-4 h-4 rounded border-[var(--border)] cursor-pointer shrink-0"
                        />
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
                        <select
                          value={p.draw || ''}
                          onChange={(e) => moveDraw(p.id, e.target.value)}
                          className="text-xs border border-[var(--border)] rounded-lg px-2 py-1 bg-[var(--surface)] text-[var(--text-primary)] focus:outline-none"
                        >
                          <option value="">Unassigned</option>
                          {drawNames.map((d) => <option key={d} value={d}>{d}</option>)}
                          {p.draw && !drawNames.includes(p.draw) && (
                            <option value={p.draw}>{p.draw}</option>
                          )}
                        </select>
                        <button onClick={() => handleEdit(p)} className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]">Edit</button>
                        <button onClick={() => handleDelete(p.id)} className="text-xs text-red-400 hover:text-red-600">Delete</button>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
            );
          })
        )}
      </main>
    </div>
  );
}
