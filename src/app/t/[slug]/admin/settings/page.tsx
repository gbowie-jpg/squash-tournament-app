'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useTournament } from '@/lib/useTournament';

export default function TournamentSettings({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const { tournament, loading } = useTournament(slug);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    venue: '',
    address: '',
    location_city: '',
    category: '',
    start_date: '',
    end_date: '',
    description: '',
    image_url: '',
    contact_name: '',
    contact_email: '',
    contact_phone: '',
    registration_opens: '',
    registration_deadline: '',
    draw_lock_date: '',
    entry_close_date: '',
    info_latest: '',
    info_accommodations: '',
    info_entry: '',
    info_rules: '',
  });

  useEffect(() => {
    if (!tournament) return;
    setForm({
      name: tournament.name || '',
      venue: tournament.venue || '',
      address: tournament.address || '',
      location_city: tournament.location_city || '',
      category: tournament.category || '',
      start_date: tournament.start_date || '',
      end_date: tournament.end_date || '',
      description: tournament.description || '',
      image_url: tournament.image_url || '',
      contact_name: tournament.contact_name || '',
      contact_email: tournament.contact_email || '',
      contact_phone: tournament.contact_phone || '',
      registration_opens: tournament.registration_opens || '',
      registration_deadline: tournament.registration_deadline || '',
      draw_lock_date: tournament.draw_lock_date || '',
      entry_close_date: tournament.entry_close_date || '',
      info_latest: tournament.info_latest || '',
      info_accommodations: tournament.info_accommodations || '',
      info_entry: tournament.info_entry || '',
      info_rules: tournament.info_rules || '',
    });
  }, [tournament]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tournament) return;
    setSaving(true);
    setSaveError(null);
    try {
      // Convert empty strings to null so Supabase stores null, not ""
      const payload = Object.fromEntries(
        Object.entries(form).map(([k, v]) => [k, v === '' ? null : v])
      );
      const res = await fetch(`/api/tournaments/${tournament.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      } else {
        const err = await res.json().catch(() => ({}));
        setSaveError(err.error || `Save failed (${res.status})`);
      }
    } catch (err) {
      setSaveError('Network error — check your connection');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const set = (key: string, val: string) => setForm((f) => ({ ...f, [key]: val }));

  if (loading) return <div className="flex items-center justify-center min-h-screen text-zinc-600">Loading...</div>;
  if (!tournament) return <div className="flex items-center justify-center min-h-screen text-zinc-600">Tournament not found</div>;

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="bg-white border-b border-zinc-200 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-5 flex items-center justify-between">
          <div>
            <Link href={`/t/${slug}/admin`} className="text-sm text-zinc-500 hover:text-zinc-700">&larr; Admin</Link>
            <h1 className="text-xl font-bold tracking-tight mt-0.5">Tournament Settings</h1>
          </div>
          <div className="flex items-center gap-3">
            {saveError && (
              <span className="text-xs text-red-600 font-medium">⚠ {saveError}</span>
            )}
            <Link href={`/t/${slug}`} target="_blank" className="text-sm text-zinc-500 hover:text-zinc-700 underline">
              Preview
            </Link>
            <button
              form="settings-form"
              type="submit"
              disabled={saving}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${
                saved ? 'bg-green-600 text-white' : 'bg-zinc-900 text-white hover:bg-zinc-800'
              }`}
            >
              {saving ? 'Saving...' : saved ? '✓ Saved' : 'Save Changes'}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        <form id="settings-form" onSubmit={handleSave} className="space-y-8">

          {/* Tournament Graphic */}
          <section className="bg-white border border-zinc-200 rounded-xl p-6 space-y-4">
            <h2 className="font-semibold text-zinc-900">Tournament Graphic</h2>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">Image URL</label>
              <input
                type="url"
                value={form.image_url}
                onChange={(e) => set('image_url', e.target.value)}
                placeholder="https://..."
                className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
              />
              <p className="text-xs text-zinc-500 mt-1">
                Upload your image to Supabase Storage or any image host, then paste the URL here.
              </p>
            </div>
            {form.image_url && (
              <div className="mt-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={form.image_url}
                  alt="Preview"
                  className="w-[120px] h-[120px] rounded-xl object-cover border border-zinc-200"
                />
              </div>
            )}
          </section>

          {/* Basic Info */}
          <section className="bg-white border border-zinc-200 rounded-xl p-6 space-y-4">
            <h2 className="font-semibold text-zinc-900">Basic Info</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-zinc-700 mb-1">Tournament Name *</label>
                <input
                  required
                  value={form.name}
                  onChange={(e) => set('name', e.target.value)}
                  className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Category</label>
                <input
                  value={form.category}
                  onChange={(e) => set('category', e.target.value)}
                  placeholder="Open/Adult, Junior, etc."
                  className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Location City</label>
                <input
                  value={form.location_city}
                  onChange={(e) => set('location_city', e.target.value)}
                  placeholder="Seattle, Washington"
                  className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Venue</label>
                <input
                  value={form.venue}
                  onChange={(e) => set('venue', e.target.value)}
                  placeholder="Seattle Athletic Club"
                  className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Address</label>
                <input
                  value={form.address}
                  onChange={(e) => set('address', e.target.value)}
                  placeholder="123 Main St, Seattle WA"
                  className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Start Date *</label>
                <input
                  required
                  type="date"
                  value={form.start_date}
                  onChange={(e) => set('start_date', e.target.value)}
                  className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">End Date</label>
                <input
                  type="date"
                  value={form.end_date}
                  onChange={(e) => set('end_date', e.target.value)}
                  className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">Description</label>
              <textarea
                value={form.description}
                onChange={(e) => set('description', e.target.value)}
                rows={3}
                className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
              />
            </div>
          </section>

          {/* Schedule */}
          <section className="bg-white border border-zinc-200 rounded-xl p-6 space-y-4">
            <h2 className="font-semibold text-zinc-900">Schedule Dates</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { key: 'registration_opens', label: 'Entry Open' },
                { key: 'registration_deadline', label: 'Registration Deadline' },
                { key: 'draw_lock_date', label: 'Draw Lock Date' },
                { key: 'entry_close_date', label: 'Entry Closed' },
              ].map(({ key, label }) => (
                <div key={key}>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">{label}</label>
                  <input
                    type="date"
                    value={form[key as keyof typeof form]}
                    onChange={(e) => set(key, e.target.value)}
                    className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
                  />
                </div>
              ))}
            </div>
          </section>

          {/* Contact */}
          <section className="bg-white border border-zinc-200 rounded-xl p-6 space-y-4">
            <h2 className="font-semibold text-zinc-900">Contact</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Contact Name</label>
                <input
                  value={form.contact_name}
                  onChange={(e) => set('contact_name', e.target.value)}
                  placeholder="Peter Gregory"
                  className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Contact Email</label>
                <input
                  type="email"
                  value={form.contact_email}
                  onChange={(e) => set('contact_email', e.target.value)}
                  placeholder="info@seattlesquash.com"
                  className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Contact Phone</label>
                <input
                  type="tel"
                  value={form.contact_phone}
                  onChange={(e) => set('contact_phone', e.target.value)}
                  placeholder="206-555-0100"
                  className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
                />
              </div>
            </div>
          </section>

          {/* Info Sections */}
          <section className="bg-white border border-zinc-200 rounded-xl p-6 space-y-4">
            <h2 className="font-semibold text-zinc-900">Info Sections</h2>
            <p className="text-xs text-zinc-500">These appear as expandable accordions on the public page.</p>
            {[
              { key: 'info_latest', label: 'Latest Information' },
              { key: 'info_accommodations', label: 'Accommodations' },
              { key: 'info_entry', label: 'Entry Info' },
              { key: 'info_rules', label: 'Rules' },
            ].map(({ key, label }) => (
              <div key={key}>
                <label className="block text-sm font-medium text-zinc-700 mb-1">{label}</label>
                <textarea
                  value={form[key as keyof typeof form]}
                  onChange={(e) => set(key, e.target.value)}
                  rows={3}
                  placeholder={`${label} text...`}
                  className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
                />
              </div>
            ))}
          </section>

        </form>
      </main>
    </div>
  );
}
