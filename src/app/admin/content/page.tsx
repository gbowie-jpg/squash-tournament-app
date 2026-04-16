'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import type { Tournament } from '@/lib/supabase/types';
import { GRADIENT_PRESETS, TEXT_COLOR_PRESETS, heroBackground, getTextColors } from '@/lib/gradients';

type Settings = Record<string, string>;

function LoadingSkeleton() {
  return (
    <div className="min-h-screen bg-surface">
      <header className="bg-card border-b border-border sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-5 flex items-center justify-between">
          <div>
            <div className="h-4 w-24 bg-surface rounded animate-pulse" />
            <div className="h-6 w-32 bg-surface rounded animate-pulse mt-1" />
          </div>
          <div className="h-9 w-28 bg-surface rounded-lg animate-pulse" />
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-4 py-8 space-y-8">
        {[1, 2].map((i) => (
          <div key={i} className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-border">
              <div className="h-5 w-40 bg-surface rounded animate-pulse" />
              <div className="h-3 w-64 bg-surface rounded animate-pulse mt-2" />
            </div>
            <div className="p-6 space-y-4">
              {[1, 2, 3].map((j) => (
                <div key={j} className="h-10 bg-surface rounded-lg animate-pulse" />
              ))}
            </div>
          </div>
        ))}
      </main>
    </div>
  );
}

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

  if (!loaded) return <LoadingSkeleton />;

  const upcomingTournaments = tournaments.filter((t) => t.status !== 'completed');
  const pastTournaments = tournaments.filter((t) => t.status === 'completed');

  const activeGradient = settings.homepage_hero_gradient || 'navy';
  const activeTextColor = settings.homepage_hero_text_color || 'white';
  const activeOverlay = settings.homepage_hero_overlay !== 'false';
  const textColors = getTextColors(activeTextColor);

  return (
    <div className="min-h-screen bg-surface">
      <header className="bg-card border-b border-border sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-5 flex items-center justify-between">
          <div>
            <Link href="/admin" className="text-sm text-muted-foreground hover:text-foreground">&larr; Dashboard</Link>
            <h1 className="text-xl font-bold tracking-tight mt-0.5 text-foreground">Site Content</h1>
          </div>
          <div className="flex items-center gap-3">
            {saveError && <span className="text-xs text-red-600 font-medium">⚠ {saveError}</span>}
            <a href="/" target="_blank" rel="noopener noreferrer"
              className="text-sm text-muted-foreground hover:text-foreground underline">Preview</a>
            <button
              onClick={handleSave}
              disabled={saving}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
                saved ? 'bg-green-600 text-white' : 'bg-foreground text-background hover:opacity-90'
              }`}
            >
              {saving ? 'Saving...' : saved ? '✓ Saved' : 'Save Changes'}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-8">

        {/* Homepage Hero */}
        <section className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-border flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-foreground">Homepage Hero</h2>
              <p className="text-xs text-muted-foreground mt-0.5">The large banner at the top of the homepage</p>
            </div>
            <a href="/" target="_blank" rel="noopener noreferrer"
              className="text-xs text-blue-600 hover:underline">View →</a>
          </div>

          {/* Live preview */}
          <div
            className="relative h-44 flex items-end overflow-hidden"
            style={{ background: heroBackground(settings.homepage_hero_image, activeGradient, activeOverlay) }}
          >
            <div className="px-5 pb-4">
              <p className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: textColors.accent }}>
                Seattle Squash Racquets Association
              </p>
              <p className="text-sm font-bold leading-snug line-clamp-2" style={{ color: textColors.heading }}>
                {settings.homepage_hero_title || 'Your headline here'}
              </p>
              <p className="text-xs mt-1 line-clamp-1 opacity-90" style={{ color: textColors.body }}>
                {settings.homepage_hero_subtitle || 'Subheading text preview'}
              </p>
            </div>
          </div>

          <div className="p-6 space-y-5">

            {/* Gradient picker */}
            <fieldset>
              <legend className="block text-sm font-medium text-foreground mb-2">
                Background Gradient
                <span className="text-xs font-normal text-muted-foreground ml-2">(used when no image is set, or as image overlay base)</span>
              </legend>
              <div className="grid grid-cols-6 gap-2" role="radiogroup" aria-label="Background gradient selection">
                {GRADIENT_PRESETS.map((g) => (
                  <button
                    key={g.key}
                    type="button"
                    onClick={() => set('homepage_hero_gradient', g.key)}
                    aria-label={`${g.label} gradient`}
                    aria-pressed={activeGradient === g.key}
                    className={`group relative rounded-lg overflow-hidden h-10 transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
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
              <div className="mt-1.5 text-xs text-muted-foreground">
                {GRADIENT_PRESETS.find((g) => g.key === activeGradient)?.label ?? 'Navy Blue'} selected
              </div>
            </fieldset>

            {/* Text color picker */}
            <fieldset>
              <legend className="block text-sm font-medium text-foreground mb-2">Text Color</legend>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Text color selection">
                {TEXT_COLOR_PRESETS.map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => set('homepage_hero_text_color', t.key)}
                    aria-label={`${t.label} text color`}
                    aria-pressed={activeTextColor === t.key}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                      activeTextColor === t.key
                        ? 'border-foreground bg-foreground text-background scale-105 shadow'
                        : 'border-border bg-card text-foreground hover:border-border'
                    }`}
                  >
                    <span
                      className="w-3 h-3 rounded-full border border-black/10 shrink-0"
                      style={{ background: t.swatch }}
                    />
                    {t.label}
                  </button>
                ))}
              </div>
            </fieldset>

            {/* Hero image */}
            <div>
              <label htmlFor="hero-image-url" className="block text-sm font-medium text-foreground mb-1">
                Hero Background Image URL
                <span className="text-xs font-normal text-muted-foreground ml-2">(optional — overrides gradient)</span>
              </label>
              <div className="flex gap-2">
                <input
                  id="hero-image-url"
                  type="url"
                  value={settings.homepage_hero_image || ''}
                  onChange={(e) => set('homepage_hero_image', e.target.value)}
                  placeholder="https://... leave blank to use gradient only"
                  className="flex-1 border border-border rounded-lg px-3 py-2 text-sm bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {settings.homepage_hero_image && (
                  <button
                    type="button"
                    onClick={() => set('homepage_hero_image', '')}
                    aria-label="Clear hero background image"
                    className="px-3 py-2 text-xs text-red-500 hover:text-red-700 border border-border rounded-lg hover:bg-red-50 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500"
                  >
                    Clear
                  </button>
                )}
              </div>
              <p className="text-xs text-dim mt-1">
                Upload to Supabase Storage → tournament-images bucket, paste public URL here.
              </p>
            </div>

            {/* Overlay toggle — only shown when image is set */}
            {settings.homepage_hero_image && (
              <div className="flex items-center justify-between py-3 border-t border-border">
                <div>
                  <p className="text-sm font-medium text-foreground">Dark overlay over image</p>
                  <p className="text-xs text-dim mt-0.5">
                    {activeOverlay
                      ? 'On — dark tint applied so text stays readable'
                      : 'Off — image shown as-is'}
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={activeOverlay}
                  aria-label="Toggle dark overlay over image"
                  onClick={() => set('homepage_hero_overlay', activeOverlay ? 'false' : 'true')}
                  className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                    activeOverlay ? 'bg-foreground' : 'bg-border'
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-background shadow transition-transform duration-200 ${
                      activeOverlay ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            )}

            {/* Title */}
            <div>
              <label htmlFor="hero-headline" className="block text-sm font-medium text-foreground mb-1">Headline</label>
              <textarea
                id="hero-headline"
                value={settings.homepage_hero_title || ''}
                onChange={(e) => set('homepage_hero_title', e.target.value)}
                rows={2}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Subtitle */}
            <div>
              <label htmlFor="hero-subheading" className="block text-sm font-medium text-foreground mb-1">Subheading</label>
              <textarea
                id="hero-subheading"
                value={settings.homepage_hero_subtitle || ''}
                onChange={(e) => set('homepage_hero_subtitle', e.target.value)}
                rows={2}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* CTAs */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="cta1-label" className="block text-sm font-medium text-foreground mb-1">Button 1 Label</label>
                <input
                  id="cta1-label"
                  value={settings.homepage_cta1_label || ''}
                  onChange={(e) => set('homepage_cta1_label', e.target.value)}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label htmlFor="cta1-link" className="block text-sm font-medium text-foreground mb-1">Button 1 Link</label>
                <input
                  id="cta1-link"
                  value={settings.homepage_cta1_href || ''}
                  onChange={(e) => set('homepage_cta1_href', e.target.value)}
                  placeholder="#tournaments"
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label htmlFor="cta2-label" className="block text-sm font-medium text-foreground mb-1">Button 2 Label</label>
                <input
                  id="cta2-label"
                  value={settings.homepage_cta2_label || ''}
                  onChange={(e) => set('homepage_cta2_label', e.target.value)}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label htmlFor="cta2-link" className="block text-sm font-medium text-foreground mb-1">Button 2 Link</label>
                <input
                  id="cta2-link"
                  value={settings.homepage_cta2_href || ''}
                  onChange={(e) => set('homepage_cta2_href', e.target.value)}
                  placeholder="/donate"
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Tournament Hero Images */}
        <section className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-border">
            <h2 className="font-semibold text-foreground">Tournament Hero Images</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Each tournament has its own graphic — click to edit</p>
          </div>
          <div className="divide-y divide-border">
            {[...upcomingTournaments, ...pastTournaments].map((t) => (
              <div key={t.id} className="flex items-center gap-4 px-6 py-4">
                <div className="w-14 h-14 rounded-lg overflow-hidden shrink-0 bg-surface flex items-center justify-center border border-border">
                  {t.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={t.image_url} alt={t.name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-2xl">🏆</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground truncate">{t.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {new Date(t.start_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    {t.hero_image_url && <span className="ml-2 text-green-600">✓ Hero bg</span>}
                    {t.image_url && <span className="ml-2 text-blue-600">✓ Graphic</span>}
                    {!t.hero_image_url && !t.image_url && <span className="ml-2 text-dim">No images</span>}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Link
                    href={`/t/${t.slug}/admin/settings`}
                    className="text-xs bg-surface hover:bg-surface text-foreground px-3 py-1.5 rounded-lg transition-colors font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    Edit Image
                  </Link>
                  <a href={`/t/${t.slug}`} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:underline">View →</a>
                </div>
              </div>
            ))}
            {tournaments.length === 0 && (
              <div className="px-6 py-10 text-center">
                <p className="text-2xl mb-2">🏟️</p>
                <p className="text-sm text-muted-foreground">No tournaments yet.</p>
                <p className="text-xs text-dim mt-1">Create a tournament to manage its hero images here.</p>
              </div>
            )}
          </div>
        </section>

      </main>
    </div>
  );
}
