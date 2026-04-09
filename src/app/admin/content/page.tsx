'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import type { Tournament } from '@/lib/supabase/types';
import { GRADIENT_PRESETS, heroBackground } from '@/lib/gradients';

type Settings = Record<string, string>;

export default function ContentAdmin() {
  const [settings, setSettings] = useState<Settings>({});
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch('/api/site-settings').then((r) => r.json()),
      fetch('/api/tournaments').then((r) => r.json()),
    ]).then(([s, t]) => {
      setSettings(s);
      setTournaments(t);
      setLoaded(true);
    });
  }, []);

  const set = (key: string, val: string) =>
    setSettings((prev) => ({ ...prev, [key]: val }));

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch('/api/site-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      } else {
        const err = await res.json().catch(() => ({}));
        setSaveError(err.error || `Save failed (${res.status})`);
      }
    } catch {
      setSaveError('Network error');
    } finally {
      setSaving(false);
    }
  };

  if (!loaded) return <div className="flex items-center justify-center min-h-screen text-zinc-600">Loading...</div>;

  const upcomingTournaments = tournaments.filter((t) => t.status !== 'completed');
  const pastTournaments = tournaments.filter((t) => t.status === 'completed');

  const activeGradient = settings.homepage_hero_gradient || 'navy';

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="bg-white border-b border-zinc-200 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-5 flex items-center justify-between">
          <div>
            <Link href="/admin" className="text-sm text-zinc-500 hover:text-zinc-700">&larr; Dashboard</Link>
            <h1 className="text-xl font-bold tracking-tight mt-0.5">Site Content</h1>
          </div>
          <div className="flex items-center gap-3">
            {saveError && <span className="text-xs text-red-600 font-medium">⚠ {saveError}</span>}
            <a href="/" target="_blank" rel="noopener noreferrer"
              className="text-sm text-zinc-500 hover:text-zinc-700 underline">Preview</a>
            <button
              onClick={handleSave}
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

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-8">

        {/* Homepage Hero */}
        <section className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-zinc-900">Homepage Hero</h2>
              <p className="text-xs text-zinc-500 mt-0.5">The large banner at the top of the homepage</p>
            </div>
            <a href="/" target="_blank" rel="noopener noreferrer"
              className="text-xs text-blue-600 hover:underline">View →</a>
          </div>

          {/* Live preview */}
          <div
            className="relative h-44 flex items-end overflow-hidden"
            style={{ background: heroBackground(settings.homepage_hero_image, activeGradient) }}
          >
            <div className="px-5 pb-4 text-white">
              <p className="text-xs text-blue-200 font-medium uppercase tracking-wider mb-1">
                Seattle Squash Racquets Association
              </p>
              <p className="text-sm font-bold leading-snug line-clamp-2">
                {settings.homepage_hero_title || 'Your headline here'}
              </p>
            </div>
          </div>

          <div className="p-6 space-y-5">

            {/* Gradient picker */}
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-2">
                Background Gradient
                <span className="text-xs font-normal text-zinc-500 ml-2">(used when no image is set, or as image overlay base)</span>
              </label>
              <div className="grid grid-cols-6 gap-2">
                {GRADIENT_PRESETS.map((g) => (
                  <button
                    key={g.key}
                    type="button"
                    onClick={() => set('homepage_hero_gradient', g.key)}
                    title={g.label}
                    className={`group relative rounded-lg overflow-hidden h-10 transition-all ${
                      activeGradient === g.key
                        ? 'ring-2 ring-offset-2 ring-zinc-900 scale-105'
                        : 'hover:scale-105 hover:shadow-md'
                    }`}
                    style={{ background: g.css }}
                  >
                    {activeGradient === g.key && (
                      <span className="absolute inset-0 flex items-center justify-center text-white text-xs font-bold">✓</span>
                    )}
                    <span className="sr-only">{g.label}</span>
                  </button>
                ))}
              </div>
              <div className="mt-1.5 text-xs text-zinc-500">
                {GRADIENT_PRESETS.find((g) => g.key === activeGradient)?.label ?? 'Navy Blue'} selected
              </div>
            </div>

            {/* Hero image */}
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">
                Hero Background Image URL
                <span className="text-xs font-normal text-zinc-500 ml-2">(optional — overrides gradient)</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={settings.homepage_hero_image || ''}
                  onChange={(e) => set('homepage_hero_image', e.target.value)}
                  placeholder="https://... leave blank to use gradient only"
                  className="flex-1 border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
                />
                {settings.homepage_hero_image && (
                  <button
                    type="button"
                    onClick={() => set('homepage_hero_image', '')}
                    className="px-3 py-2 text-xs text-red-500 hover:text-red-700 border border-zinc-200 rounded-lg hover:bg-red-50 transition-colors"
                  >
                    Clear
                  </button>
                )}
              </div>
              <p className="text-xs text-zinc-400 mt-1">
                Upload to Supabase Storage → tournament-images bucket, paste public URL here.
              </p>
            </div>

            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">Headline</label>
              <textarea
                value={settings.homepage_hero_title || ''}
                onChange={(e) => set('homepage_hero_title', e.target.value)}
                rows={2}
                className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
              />
            </div>

            {/* Subtitle */}
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">Subheading</label>
              <textarea
                value={settings.homepage_hero_subtitle || ''}
                onChange={(e) => set('homepage_hero_subtitle', e.target.value)}
                rows={2}
                className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
              />
            </div>

            {/* CTAs */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Button 1 Label</label>
                <input
                  value={settings.homepage_cta1_label || ''}
                  onChange={(e) => set('homepage_cta1_label', e.target.value)}
                  className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Button 1 Link</label>
                <input
                  value={settings.homepage_cta1_href || ''}
                  onChange={(e) => set('homepage_cta1_href', e.target.value)}
                  placeholder="#tournaments"
                  className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Button 2 Label</label>
                <input
                  value={settings.homepage_cta2_label || ''}
                  onChange={(e) => set('homepage_cta2_label', e.target.value)}
                  className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Button 2 Link</label>
                <input
                  value={settings.homepage_cta2_href || ''}
                  onChange={(e) => set('homepage_cta2_href', e.target.value)}
                  placeholder="/donate"
                  className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Tournament Hero Images */}
        <section className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-zinc-100">
            <h2 className="font-semibold text-zinc-900">Tournament Hero Images</h2>
            <p className="text-xs text-zinc-500 mt-0.5">Each tournament has its own graphic — click to edit</p>
          </div>
          <div className="divide-y divide-zinc-100">
            {[...upcomingTournaments, ...pastTournaments].map((t) => (
              <div key={t.id} className="flex items-center gap-4 px-6 py-4">
                <div className="w-14 h-14 rounded-lg overflow-hidden shrink-0 bg-zinc-100 flex items-center justify-center border border-zinc-200">
                  {t.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={t.image_url} alt={t.name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-2xl">🏆</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-zinc-900 truncate">{t.name}</p>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    {new Date(t.start_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    {t.image_url
                      ? <span className="ml-2 text-green-600">✓ Image set</span>
                      : <span className="ml-2 text-zinc-400">No image</span>}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Link
                    href={`/t/${t.slug}/admin/settings`}
                    className="text-xs bg-zinc-100 hover:bg-zinc-200 text-zinc-700 px-3 py-1.5 rounded-lg transition-colors font-medium"
                  >
                    Edit Image
                  </Link>
                  <a href={`/t/${t.slug}`} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:underline">View →</a>
                </div>
              </div>
            ))}
            {tournaments.length === 0 && (
              <p className="px-6 py-6 text-sm text-zinc-500">No tournaments yet.</p>
            )}
          </div>
        </section>

      </main>
    </div>
  );
}
