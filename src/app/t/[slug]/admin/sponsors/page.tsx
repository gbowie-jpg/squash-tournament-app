'use client';

import { use, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useTournament } from '@/lib/useTournament';
import type { Sponsor, SponsorTier, Court } from '@/lib/supabase/types';

const TIER_INFO: Record<SponsorTier, { label: string; sizeHint: string; description: string }> = {
  title: {
    label: 'Title / Presenting',
    sizeHint: '800 × 400 px',
    description: 'Headline sponsor. Appears on the splash screen, landing hero, and email footers.',
  },
  court: {
    label: 'Court Sponsor',
    sizeHint: '600 × 300 px',
    description: 'Assigned to a specific court. Logo shown on that court\'s card.',
  },
  supporting: {
    label: 'Supporting',
    sizeHint: '400 × 200 px',
    description: 'Rotates in the footer strip on the court board, landing page, etc.',
  },
};

type FormState = {
  name: string;
  url: string;
  tier: SponsorTier;
  court_id: string;
  logo_url: string;
  active: boolean;
};

const emptyForm: FormState = {
  name: '',
  url: '',
  tier: 'supporting',
  court_id: '',
  logo_url: '',
  active: true,
};

export default function SponsorsAdminPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const { tournament, loading: tLoading } = useTournament(slug);

  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [courts, setCourts] = useState<Court[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!tournament) return;
    Promise.all([
      fetch(`/api/tournaments/${tournament.id}/sponsors`).then((r) => r.json()),
      fetch(`/api/tournaments/${tournament.id}/courts`).then((r) => r.json()),
    ]).then(([s, c]) => {
      setSponsors(Array.isArray(s) ? s : []);
      setCourts(Array.isArray(c) ? c : []);
      setLoading(false);
    });
  }, [tournament]);

  const handleUpload = async (file: File) => {
    if (!tournament) return;
    setUploading(true);
    setError(null);
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await fetch(`/api/tournaments/${tournament.id}/sponsors/upload`, {
        method: 'POST',
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      setForm((f) => ({ ...f, logo_url: data.url }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tournament) return;
    setError(null);

    const payload = {
      name: form.name.trim(),
      url: form.url.trim() || null,
      tier: form.tier,
      court_id: form.tier === 'court' ? (form.court_id || null) : null,
      logo_url: form.logo_url || null,
      active: form.active,
    };
    if (!payload.name) { setError('Name required'); return; }

    const isEdit = !!editingId;
    const res = await fetch(`/api/tournaments/${tournament.id}/sponsors`, {
      method: isEdit ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(isEdit ? { id: editingId, ...payload } : payload),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error || 'Save failed'); return; }

    if (isEdit) {
      setSponsors((prev) => prev.map((s) => (s.id === editingId ? data : s)));
    } else {
      setSponsors((prev) => [...prev, data]);
    }
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(false);
  };

  const handleEdit = (s: Sponsor) => {
    setForm({
      name: s.name,
      url: s.url || '',
      tier: s.tier,
      court_id: s.court_id || '',
      logo_url: s.logo_url || '',
      active: s.active,
    });
    setEditingId(s.id);
    setShowForm(true);
    setError(null);
  };

  const handleDelete = async (id: string) => {
    if (!tournament) return;
    if (!confirm('Delete this sponsor?')) return;
    const res = await fetch(`/api/tournaments/${tournament.id}/sponsors`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sponsorId: id }),
    });
    if (res.ok) setSponsors((prev) => prev.filter((s) => s.id !== id));
  };

  const toggleActive = async (s: Sponsor) => {
    if (!tournament) return;
    const res = await fetch(`/api/tournaments/${tournament.id}/sponsors`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: s.id, active: !s.active }),
    });
    if (res.ok) {
      const data = await res.json();
      setSponsors((prev) => prev.map((x) => (x.id === s.id ? data : x)));
    }
  };

  /** Swap display_order with neighbor (within the same tier). */
  const move = async (s: Sponsor, direction: 'up' | 'down') => {
    if (!tournament) return;
    const peers = sponsors
      .filter((x) => x.tier === s.tier)
      .sort((a, b) => (a.display_order - b.display_order) || a.name.localeCompare(b.name));
    const idx = peers.findIndex((x) => x.id === s.id);
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= peers.length) return;

    const a = peers[idx];
    const b = peers[targetIdx];
    // Use position-based order so ties don't lock us up
    const aNew = b.display_order;
    const bNew = a.display_order;
    const finalA = aNew === bNew ? targetIdx : aNew;
    const finalB = aNew === bNew ? idx : bNew;

    // Optimistic update
    setSponsors((prev) => prev.map((x) => {
      if (x.id === a.id) return { ...x, display_order: finalA };
      if (x.id === b.id) return { ...x, display_order: finalB };
      return x;
    }));

    await Promise.all([
      fetch(`/api/tournaments/${tournament.id}/sponsors`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: a.id, display_order: finalA }),
      }),
      fetch(`/api/tournaments/${tournament.id}/sponsors`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: b.id, display_order: finalB }),
      }),
    ]);
  };

  if (tLoading || loading) {
    return <div className="flex items-center justify-center min-h-screen text-[var(--text-secondary)]">Loading…</div>;
  }
  if (!tournament) {
    return <div className="flex items-center justify-center min-h-screen">Not found</div>;
  }

  const byTier: Record<SponsorTier, Sponsor[]> = {
    title: sponsors.filter((s) => s.tier === 'title'),
    court: sponsors.filter((s) => s.tier === 'court'),
    supporting: sponsors.filter((s) => s.tier === 'supporting'),
  };

  return (
    <div className="min-h-screen bg-[var(--surface)]">
      <header className="bg-[var(--surface-card)] border-b border-[var(--border)]">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <Link href={`/t/${slug}/admin`} className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]">&larr; Tournament Admin</Link>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)] mt-0.5">Sponsors</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">Logos, tiers, and on/off switches. Upload PNGs with transparent backgrounds for the cleanest look.</p>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-8">

        <SplashDurationCard />

        {!showForm && (
          <button
            onClick={() => { setForm(emptyForm); setEditingId(null); setShowForm(true); setError(null); }}
            className="bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-5 py-2.5 rounded-lg text-sm font-medium hover:opacity-90"
          >
            + Add Sponsor
          </button>
        )}

        {showForm && (
          <form onSubmit={handleSubmit} className="bg-[var(--surface-card)] border border-[var(--border)] rounded-xl p-6 space-y-5">
            <h2 className="font-semibold text-lg text-[var(--text-primary)]">
              {editingId ? 'Edit Sponsor' : 'New Sponsor'}
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Name</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full border border-[var(--border)] rounded-lg px-3 py-2 text-sm bg-[var(--surface)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Website URL (optional)</label>
                <input
                  type="url"
                  value={form.url}
                  onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
                  placeholder="https://example.com"
                  className="w-full border border-[var(--border)] rounded-lg px-3 py-2 text-sm bg-[var(--surface)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Tier</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {(Object.keys(TIER_INFO) as SponsorTier[]).map((t) => {
                  const info = TIER_INFO[t];
                  const selected = form.tier === t;
                  return (
                    <button
                      type="button"
                      key={t}
                      onClick={() => setForm((f) => ({ ...f, tier: t }))}
                      className={`text-left p-3 rounded-lg border-2 transition-colors ${selected ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30' : 'border-[var(--border)] hover:border-[var(--text-muted)]'}`}
                    >
                      <p className="font-semibold text-sm text-[var(--text-primary)]">{info.label}</p>
                      <p className="text-xs text-[var(--text-muted)] mt-1">Recommended: {info.sizeHint}</p>
                      <p className="text-xs text-[var(--text-secondary)] mt-1">{info.description}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {form.tier === 'court' && (
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Court</label>
                <select
                  value={form.court_id}
                  onChange={(e) => setForm((f) => ({ ...f, court_id: e.target.value }))}
                  className="w-full border border-[var(--border)] rounded-lg px-3 py-2 text-sm bg-[var(--surface)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">— No court assigned —</option>
                  {courts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                Logo <span className="text-xs font-normal text-[var(--text-muted)]">— PNG (transparent bg) at {TIER_INFO[form.tier].sizeHint}, max 2 MB</span>
              </label>

              {form.logo_url && (
                <div className="mb-3 p-4 bg-[var(--surface)] border border-[var(--border)] rounded-lg flex items-center justify-center min-h-[120px]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={form.logo_url} alt="logo preview" className="max-h-[100px] w-auto object-contain" />
                </div>
              )}

              <div className="flex gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); }}
                  className="text-sm text-[var(--text-secondary)]"
                  disabled={uploading}
                />
                {form.logo_url && (
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, logo_url: '' }))}
                    className="text-xs text-red-600 hover:text-red-700 underline"
                  >
                    Clear
                  </button>
                )}
              </div>
              {uploading && <p className="text-xs text-[var(--text-muted)] mt-1">Uploading…</p>}
            </div>

            <div className="flex items-center gap-2 pt-2">
              <input
                type="checkbox"
                id="active"
                checked={form.active}
                onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
              />
              <label htmlFor="active" className="text-sm text-[var(--text-primary)]">Active (visible to public)</label>
            </div>

            {error && (
              <div className="text-sm text-red-600 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">{error}</div>
            )}

            <div className="flex items-center gap-3 pt-2">
              <button type="submit" className="bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-6 py-2 rounded-lg text-sm font-medium hover:opacity-90">
                {editingId ? 'Save Changes' : 'Add Sponsor'}
              </button>
              <button type="button" onClick={() => { setShowForm(false); setEditingId(null); setForm(emptyForm); }} className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                Cancel
              </button>
            </div>
          </form>
        )}

        {(Object.keys(TIER_INFO) as SponsorTier[]).map((tier) => (
          <section key={tier}>
            <h2 className="font-semibold text-lg text-[var(--text-primary)] mb-1">{TIER_INFO[tier].label}</h2>
            <p className="text-xs text-[var(--text-muted)] mb-3">{TIER_INFO[tier].description}</p>
            {byTier[tier].length === 0 ? (
              <p className="text-sm text-[var(--text-muted)] italic">None yet.</p>
            ) : (
              <ul className="space-y-2">
                {byTier[tier]
                  .slice()
                  .sort((a, b) => (a.display_order - b.display_order) || a.name.localeCompare(b.name))
                  .map((s, i, arr) => (
                  <li key={s.id} className={`bg-[var(--surface-card)] border border-[var(--border)] rounded-xl p-4 flex items-center gap-4 ${!s.active ? 'opacity-50' : ''}`}>
                    <div className="flex flex-col gap-0.5 shrink-0">
                      <button
                        onClick={() => move(s, 'up')}
                        disabled={i === 0}
                        title="Move up"
                        className="w-6 h-6 flex items-center justify-center rounded text-[var(--text-secondary)] hover:bg-[var(--surface)] hover:text-[var(--text-primary)] disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="18 15 12 9 6 15" /></svg>
                      </button>
                      <button
                        onClick={() => move(s, 'down')}
                        disabled={i === arr.length - 1}
                        title="Move down"
                        className="w-6 h-6 flex items-center justify-center rounded text-[var(--text-secondary)] hover:bg-[var(--surface)] hover:text-[var(--text-primary)] disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9" /></svg>
                      </button>
                    </div>
                    {s.logo_url ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={s.logo_url} alt={s.name} className="h-12 w-24 object-contain shrink-0 bg-white/50 dark:bg-zinc-900/50 rounded" />
                    ) : (
                      <div className="h-12 w-24 shrink-0 bg-zinc-100 dark:bg-zinc-800 rounded flex items-center justify-center text-xs text-[var(--text-muted)]">No logo</div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-[var(--text-primary)]">{s.name}</p>
                      {s.url && <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline truncate block">{s.url}</a>}
                      {s.tier === 'court' && s.court_id && (
                        <p className="text-xs text-[var(--text-muted)] mt-0.5">
                          Court: {courts.find((c) => c.id === s.court_id)?.name || '—'}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => toggleActive(s)}
                        className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${s.active ? 'border-green-500 text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/30' : 'border-[var(--border)] text-[var(--text-muted)]'}`}
                      >
                        {s.active ? 'Active' : 'Inactive'}
                      </button>
                      <button onClick={() => handleEdit(s)} className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] underline">Edit</button>
                      <button onClick={() => handleDelete(s.id)} className="text-xs text-red-600 hover:text-red-700 underline">Delete</button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </main>
    </div>
  );
}

function SplashDurationCard() {
  const [seconds, setSeconds] = useState(3);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch('/api/site-settings')
      .then((r) => r.json())
      .then((data: Record<string, string | null>) => {
        const ms = parseInt(data.sponsor_splash_duration_ms || '');
        if (!isNaN(ms) && ms > 0) setSeconds(Math.round(ms / 1000));
        setLoaded(true);
      });
  }, []);

  const save = async () => {
    setSaving(true); setSaved(false);
    const ms = Math.max(500, Math.min(15000, Math.round(seconds * 1000)));
    await fetch('/api/site-settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sponsor_splash_duration_ms: String(ms) }),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  // Reset session-storage flag so admins can re-trigger the splash for preview
  const previewAgain = () => {
    if (typeof window === 'undefined') return;
    Object.keys(sessionStorage)
      .filter((k) => k.startsWith('sponsor-splash-'))
      .forEach((k) => sessionStorage.removeItem(k));
    window.location.reload();
  };

  if (!loaded) return null;

  return (
    <div className="bg-[var(--surface-card)] border border-[var(--border)] rounded-xl p-5">
      <h2 className="font-semibold text-[var(--text-primary)] mb-1">Splash Settings</h2>
      <p className="text-xs text-[var(--text-muted)] mb-4">
        How long the &quot;Presented by&quot; screen shows on first visit. Applies to all tournaments.
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Duration (seconds)</label>
          <input
            type="number"
            min={1}
            max={15}
            step={0.5}
            value={seconds}
            onChange={(e) => setSeconds(parseFloat(e.target.value) || 3)}
            className="border border-[var(--border)] rounded-lg px-3 py-2 text-sm bg-[var(--surface)] text-[var(--text-primary)] w-24 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button
          onClick={save}
          disabled={saving}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${saved ? 'bg-green-600 text-white' : 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:opacity-90'}`}
        >
          {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save'}
        </button>
        <button
          onClick={previewAgain}
          className="px-4 py-2 rounded-lg text-sm text-[var(--text-secondary)] border border-[var(--border)] hover:text-[var(--text-primary)] transition-colors"
          title="Clears session flag and reloads — splash will show again"
        >
          Preview splash
        </button>
      </div>
    </div>
  );
}
