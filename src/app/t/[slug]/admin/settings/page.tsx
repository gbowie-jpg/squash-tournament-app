'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useTournament } from '@/lib/useTournament';
import { GRADIENT_PRESETS, TEXT_COLOR_PRESETS, heroBackground, getTextColors } from '@/lib/gradients';

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
    hero_image_url: '',
    hero_gradient: '',
    hero_text_color: '',
    hero_overlay: 'true',
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
      hero_image_url: tournament.hero_image_url || '',
      hero_gradient: tournament.hero_gradient || '',
      hero_text_color: tournament.hero_text_color || '',
      hero_overlay: tournament.hero_overlay ?? 'true',
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

          {/* Hero Appearance */}
          <section className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-zinc-100">
              <h2 className="font-semibold text-zinc-900">Hero Appearance</h2>
              <p className="text-xs text-zinc-500 mt-0.5">Banner at the top of the tournament page</p>
            </div>

            {/* Live preview */}
            {(() => {
              const activeGradient = form.hero_gradient || 'navy';
              const textColors = getTextColors(form.hero_text_color || 'white');
              return (
                <div
                  className="h-36 flex items-end overflow-hidden"
                  style={{ background: heroBackground(form.hero_image_url || null, activeGradient, form.hero_overlay !== 'false') }}
                >
                  <div className="px-5 pb-4">
                    <p className="text-xs font-semibold uppercase tracking-wider mb-0.5" style={{ color: textColors.accent }}>
                      Upcoming
                    </p>
                    <p className="text-base font-bold" style={{ color: textColors.heading }}>
                      {form.name || 'Tournament Name'}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: textColors.body }}>
                      {form.venue || 'Venue'} · {form.start_date || 'Date'}
                    </p>
                  </div>
                </div>
              );
            })()}

            <div className="p-6 space-y-5">
              {/* Gradient picker */}
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-2">Background Gradient</label>
                <div className="grid grid-cols-6 gap-2">
                  {GRADIENT_PRESETS.map((g) => (
                    <button
                      key={g.key}
                      type="button"
                      onClick={() => set('hero_gradient', g.key)}
                      title={g.label}
                      className={`relative rounded-lg overflow-hidden h-10 transition-all ${
                        (form.hero_gradient || 'navy') === g.key
                          ? 'ring-2 ring-offset-2 ring-zinc-900 scale-105'
                          : 'hover:scale-105 hover:shadow-md'
                      }`}
                      style={{ background: g.css }}
                    >
                      {(form.hero_gradient || 'navy') === g.key && (
                        <span className="absolute inset-0 flex items-center justify-center text-white text-xs font-bold">✓</span>
                      )}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-zinc-500 mt-1.5">
                  {GRADIENT_PRESETS.find((g) => g.key === (form.hero_gradient || 'navy'))?.label ?? 'Navy Blue'} selected
                </p>
              </div>

              {/* Text color picker */}
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-2">Text Color</label>
                <div className="flex flex-wrap gap-2">
                  {TEXT_COLOR_PRESETS.map((t) => (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => set('hero_text_color', t.key)}
                      title={t.label}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                        (form.hero_text_color || 'white') === t.key
                          ? 'border-zinc-900 bg-zinc-900 text-white scale-105 shadow'
                          : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-400'
                      }`}
                    >
                      <span className="w-3 h-3 rounded-full border border-black/10 shrink-0" style={{ background: t.swatch }} />
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Hero background image */}
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">
                  Hero Background Image
                  <span className="text-xs font-normal text-zinc-500 ml-2">full-width photo behind the text — overrides gradient</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={form.hero_image_url}
                    onChange={(e) => set('hero_image_url', e.target.value)}
                    placeholder="https://... (leave blank to use gradient)"
                    className="flex-1 border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
                  />
                  {form.hero_image_url && (
                    <button type="button" onClick={() => set('hero_image_url', '')}
                      className="px-3 py-2 text-xs text-red-500 hover:text-red-700 border border-zinc-200 rounded-lg hover:bg-red-50 transition-colors">
                      Clear
                    </button>
                  )}
                </div>
                {form.hero_image_url && (
                  <div className="mt-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={form.hero_image_url} alt="Hero background preview"
                      className="w-full h-24 rounded-lg object-cover border border-zinc-200" />
                  </div>
                )}
              </div>

              {/* Tournament graphic (logo/icon) */}
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">
                  Tournament Graphic
                  <span className="text-xs font-normal text-zinc-500 ml-2">small logo shown in the hero corner and on cards</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={form.image_url}
                    onChange={(e) => set('image_url', e.target.value)}
                    placeholder="https://..."
                    className="flex-1 border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
                  />
                  {form.image_url && (
                    <button type="button" onClick={() => set('image_url', '')}
                      className="px-3 py-2 text-xs text-red-500 hover:text-red-700 border border-zinc-200 rounded-lg hover:bg-red-50 transition-colors">
                      Clear
                    </button>
                  )}
                </div>
                {form.image_url && (
                  <div className="mt-2 flex items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={form.image_url} alt="Graphic preview"
                      className="w-14 h-14 rounded-lg object-cover border border-zinc-200" />
                    <p className="text-xs text-zinc-500">Appears as the icon in the top-left of the hero and on tournament listing cards.</p>
                  </div>
                )}
              </div>

              {/* Overlay toggle — only relevant when a hero background image is set */}
              {form.hero_image_url && (
                <div className="flex items-center justify-between py-3 border-t border-zinc-100">
                  <div>
                    <p className="text-sm font-medium text-zinc-700">Dark overlay over image</p>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      {form.hero_overlay !== 'false'
                        ? 'On — dark tint over background image keeps text readable'
                        : 'Off — background image shown as-is (ensure it has enough contrast for your text color)'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => set('hero_overlay', form.hero_overlay === 'false' ? 'true' : 'false')}
                    className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
                      form.hero_overlay !== 'false' ? 'bg-zinc-900' : 'bg-zinc-200'
                    }`}
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform duration-200 ${
                        form.hero_overlay !== 'false' ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              )}
            </div>
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
