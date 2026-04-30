'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/useAuth';
import { GRADIENT_PRESETS, TEXT_COLOR_PRESETS, heroBackground, getTextColors } from '@/lib/gradients';

function SettingsSkeleton() {
  return (
    <div className="min-h-screen bg-surface">
      <header className="bg-card border-b border-border">
        <div className="max-w-3xl mx-auto px-4 py-6 flex items-center justify-between">
          <div>
            <div className="h-4 w-24 bg-surface rounded animate-pulse" />
            <div className="h-7 w-56 bg-surface rounded animate-pulse mt-1" />
          </div>
          <div className="h-4 w-16 bg-surface rounded animate-pulse" />
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-card border border-border rounded-xl p-6">
            <div className="h-5 w-40 bg-surface rounded animate-pulse mb-4" />
            <div className="space-y-3">
              {[1, 2, 3].map((j) => (
                <div key={j} className="h-4 w-full bg-surface rounded animate-pulse" />
              ))}
            </div>
          </div>
        ))}
      </main>
    </div>
  );
}

export default function AdminSettings() {
  const { signOut } = useAuth();
  const [vapidStatus, setVapidStatus] = useState<'checking' | 'ok' | 'missing'>('checking');
  const [resendStatus, setResendStatus] = useState<'checking' | 'ok' | 'missing'>('checking');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.allSettled([
      fetch('/api/push/send', { method: 'GET' }).then((r) => {
        setVapidStatus(r.status === 405 ? 'ok' : 'missing');
      }).catch(() => setVapidStatus('missing')),

      fetch('/api/email/status').then((r) => {
        setResendStatus(r.ok ? 'ok' : 'missing');
      }).catch(() => setResendStatus('missing')),
    ]).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <SettingsSkeleton />;
  }

  return (
    <div className="min-h-screen bg-surface">
      <header className="bg-card border-b border-border">
        <div className="max-w-3xl mx-auto px-4 py-6 flex items-center justify-between">
          <div>
            <Link href="/admin" className="text-sm text-muted-foreground hover:text-foreground">&larr; Dashboard</Link>
            <h1 className="text-2xl font-bold tracking-tight mt-0.5 text-foreground">Settings & Integrations</h1>
          </div>
          <button onClick={signOut} className="text-sm text-muted-foreground hover:text-foreground">Sign Out</button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">

        {/* Integration Status */}
        <div className="bg-card border border-border rounded-xl p-6">
          <h2 className="font-semibold text-foreground mb-4">Integration Status</h2>
          <div className="space-y-3">
            <IntegrationRow
              label="Resend (Email)"
              description="Required for email marketing campaigns"
              status={resendStatus}
              helpUrl="https://resend.com/api-keys"
              envVar="RESEND_API_KEY"
            />
            <IntegrationRow
              label="Push Notifications (VAPID)"
              description="Required for browser push announcements"
              status={vapidStatus}
              envVar="NEXT_PUBLIC_VAPID_PUBLIC_KEY + VAPID_PRIVATE_KEY"
            />
            <IntegrationRow
              label="Supabase"
              description="Database — always required"
              status="ok"
            />
          </div>
        </div>

        {/* URL Structure */}
        <div className="bg-card border border-border rounded-xl p-6">
          <h2 className="font-semibold text-foreground mb-1">URL Structure</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Tournaments live at <code className="bg-surface px-1 rounded">/t/[slug]</code> — the{' '}
            <code className="bg-surface px-1 rounded">/t/</code> prefix keeps tournament URLs short and separate from
            admin and marketing pages.
          </p>
          <div className="space-y-2 text-sm">
            {[
              ['/t/seattle-city-championships', 'Public landing page'],
              ['/t/[slug]/courts', 'Live court board'],
              ['/t/[slug]/players', 'Player lookup'],
              ['/t/[slug]/volunteer', 'Volunteer signup'],
              ['/t/[slug]/admin', 'Tournament admin dashboard'],
              ['/t/[slug]/admin/settings', 'Tournament details editor'],
              ['/admin', 'Top-level admin'],
              ['/admin/email', 'Global email marketing'],
            ].map(([path, label]) => (
              <div key={path} className="flex items-center gap-3">
                <code className="text-xs bg-surface text-foreground px-2 py-1 rounded font-mono w-72 shrink-0">{path}</code>
                <span className="text-muted-foreground">{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Vercel Env Vars */}
        <div className="bg-card border border-border rounded-xl p-6">
          <h2 className="font-semibold text-foreground mb-1">Vercel Environment Variables</h2>
          <p className="text-sm text-muted-foreground mb-4">Add these in your Vercel project &rarr; Settings &rarr; Environment Variables.</p>
          <div className="space-y-2">
            {[
              { key: 'NEXT_PUBLIC_SUPABASE_URL', note: 'Supabase project URL' },
              { key: 'NEXT_PUBLIC_SUPABASE_ANON_KEY', note: 'Supabase anon key' },
              { key: 'SUPABASE_SERVICE_ROLE_KEY', note: 'Supabase service role (server-only)' },
              { key: 'RESEND_API_KEY', note: 'From resend.com/api-keys' },
              { key: 'RESEND_FROM_EMAIL', note: 'e.g. noreply@seattlesquash.com' },
              { key: 'NEXT_PUBLIC_VAPID_PUBLIC_KEY', note: 'Push notification public key' },
              { key: 'VAPID_PRIVATE_KEY', note: 'Push notification private key (server-only)' },
            ].map(({ key, note }) => (
              <div key={key} className="flex items-start gap-3 text-sm">
                <code className="text-xs bg-surface text-foreground px-2 py-1 rounded font-mono shrink-0">{key}</code>
                <span className="text-muted-foreground mt-0.5">{note}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Stripe / Payment Processing */}
        <StripeSettingsPanel />

        {/* Scholarship Applications */}
        <ScholarshipPanel />

        {/* Quick Links */}
        <div className="bg-card border border-border rounded-xl p-6">
          <h2 className="font-semibold text-foreground mb-4">Quick Links</h2>
          <div className="flex flex-wrap gap-3">
            {[
              { href: 'https://supabase.com/dashboard', label: 'Supabase Dashboard' },
              { href: 'https://vercel.com/dashboard', label: 'Vercel Dashboard' },
              { href: 'https://resend.com/emails', label: 'Resend Dashboard' },
              { href: 'https://github.com/gbowie-jpg/squash-tournament-app', label: 'GitHub Repo' },
            ].map(({ href, label }) => (
              <a
                key={href}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm bg-surface hover:bg-surface/70 text-foreground px-3 py-2 rounded-lg transition-colors"
              >
                {label} ↗
              </a>
            ))}
          </div>
        </div>

      </main>
    </div>
  );
}

function StripeSettingsPanel() {
  const [fields, setFields] = useState({
    stripe_publishable_key: '',
    stripe_secret_key: '',
    stripe_webhook_secret: '',
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    // Load publishable key only (secret keys are never returned by the API)
    fetch('/api/site-settings')
      .then((r) => r.json())
      .then((data) => {
        setFields((prev) => ({
          ...prev,
          stripe_publishable_key: data.stripe_publishable_key || '',
        }));
        setLoaded(true);
      });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const body: Record<string, string | null> = {
        stripe_publishable_key: fields.stripe_publishable_key || null,
      };
      // Only send secret fields if they were filled in (non-empty = user entered a new value)
      if (fields.stripe_secret_key) body.stripe_secret_key = fields.stripe_secret_key;
      if (fields.stripe_webhook_secret) body.stripe_webhook_secret = fields.stripe_webhook_secret;

      const res = await fetch('/api/site-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Save failed');
      setSaved(true);
      // Clear secret fields after save (they're write-only)
      setFields((prev) => ({ ...prev, stripe_secret_key: '', stripe_webhook_secret: '' }));
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const inputCls = 'w-full border border-border rounded-lg px-3 py-2 text-sm bg-surface text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-blue-500';

  if (!loaded) return null;

  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <div className="flex items-center justify-between mb-1">
        <h2 className="font-semibold text-foreground">Payment Processing (Stripe)</h2>
        <a href="https://dashboard.stripe.com/apikeys" target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline">Stripe Dashboard ↗</a>
      </div>
      <p className="text-sm text-muted-foreground mb-5">
        Enter your Stripe keys to enable entry fee collection on registrations. Secret keys are write-only — they&apos;re stored securely and never shown again.
      </p>

      {error && (
        <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>
      )}
      {saved && (
        <div className="mb-4 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">✓ Saved</div>
      )}

      <div className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-foreground mb-1">Publishable Key <span className="text-muted-foreground font-normal">(starts with pk_)</span></label>
          <input
            type="text"
            value={fields.stripe_publishable_key}
            onChange={(e) => setFields((p) => ({ ...p, stripe_publishable_key: e.target.value }))}
            placeholder="pk_live_..."
            className={inputCls}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-foreground mb-1">
            Secret Key <span className="text-muted-foreground font-normal">(starts with sk_ — write-only, leave blank to keep existing)</span>
          </label>
          <input
            type="password"
            value={fields.stripe_secret_key}
            onChange={(e) => setFields((p) => ({ ...p, stripe_secret_key: e.target.value }))}
            placeholder="sk_live_... (leave blank to keep existing)"
            className={inputCls}
            autoComplete="new-password"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-foreground mb-1">
            Webhook Secret <span className="text-muted-foreground font-normal">(starts with whsec_ — for confirming payments)</span>
          </label>
          <input
            type="password"
            value={fields.stripe_webhook_secret}
            onChange={(e) => setFields((p) => ({ ...p, stripe_webhook_secret: e.target.value }))}
            placeholder="whsec_... (leave blank to keep existing)"
            className={inputCls}
            autoComplete="new-password"
          />
          <p className="text-xs text-muted-foreground mt-1.5">
            Add webhook endpoint in Stripe: <code className="bg-surface px-1 rounded">POST /api/webhooks/stripe</code> — listen for <code className="bg-surface px-1 rounded">checkout.session.completed</code>
          </p>
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="mt-5 bg-foreground text-card text-sm font-medium px-5 py-2 rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity"
      >
        {saving ? 'Saving…' : 'Save Stripe Credentials'}
      </button>
    </div>
  );
}

function ScholarshipPanel() {
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState({
    scholarship_hero_gradient: 'navy',
    scholarship_hero_text_color: 'white',
    scholarship_hero_image_url: '',
    scholarship_hero_overlay: 'true',
    scholarship_hero_subtitle: 'Seattle Squash Racquets Association',
  });

  const set = (key: string, val: string) => setForm((f) => ({ ...f, [key]: val }));

  useEffect(() => {
    fetch('/api/site-settings')
      .then((r) => r.json())
      .then((data: Record<string, string | null>) => {
        setIsOpen(data.scholarship_open === 'true');
        setForm({
          scholarship_hero_gradient: data.scholarship_hero_gradient || 'navy',
          scholarship_hero_text_color: data.scholarship_hero_text_color || 'white',
          scholarship_hero_image_url: data.scholarship_hero_image_url || '',
          scholarship_hero_overlay: data.scholarship_hero_overlay || 'true',
          scholarship_hero_subtitle: data.scholarship_hero_subtitle || 'Seattle Squash Racquets Association',
        });
        setLoaded(true);
      });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    await fetch('/api/site-settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scholarship_open: isOpen ? 'true' : 'false',
        ...form,
        scholarship_hero_image_url: form.scholarship_hero_image_url || null,
      }),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  if (!loaded) return null;

  const textColors = getTextColors(form.scholarship_hero_text_color);

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="px-6 py-4 border-b border-border flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-foreground">Scholarship Page</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            <a href="/scholarship" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
              /scholarship ↗
            </a>
            {' '}— hero design + applications open/closed
          </p>
        </div>
      </div>

      {/* Live preview */}
      <div
        className="h-32 flex items-end overflow-hidden"
        style={{ background: heroBackground(form.scholarship_hero_image_url || null, form.scholarship_hero_gradient, form.scholarship_hero_overlay !== 'false') }}
      >
        <div className="px-5 pb-4">
          <p className="text-xs font-semibold uppercase tracking-wider mb-0.5" style={{ color: textColors.accent }}>
            2026 Scholarship Award
          </p>
          <p className="text-base font-bold" style={{ color: textColors.heading }}>
            Seattle Squash Racquets Association
          </p>
          <p className="text-xs mt-0.5" style={{ color: textColors.body }}>
            {form.scholarship_hero_subtitle || 'Subtitle preview'}
          </p>
        </div>
      </div>

      <div className="p-6 space-y-5">
        {/* Applications open/closed toggle */}
        <div className="flex items-center justify-between py-3 border border-border rounded-lg px-4">
          <div>
            <p className="text-sm font-medium text-foreground">Applications Open</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Show the form or a &quot;closed&quot; notice
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`text-xs font-medium ${isOpen ? 'text-green-600' : 'text-muted-foreground'}`}>
              {isOpen ? 'Open' : 'Closed'}
            </span>
            <button
              type="button"
              onClick={() => setIsOpen((v) => !v)}
              role="switch"
              aria-checked={isOpen}
              className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors ${
                isOpen ? 'bg-green-500' : 'bg-border'
              }`}
            >
              <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${isOpen ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </div>
        </div>

        {/* Subtitle */}
        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-1">Hero Subtitle</label>
          <input
            type="text"
            value={form.scholarship_hero_subtitle}
            onChange={(e) => set('scholarship_hero_subtitle', e.target.value)}
            placeholder="Seattle Squash Racquets Association"
            className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-zinc-900"
          />
        </div>

        {/* Gradient picker */}
        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-2">Background Gradient</label>
          <div className="grid grid-cols-6 gap-2">
            {GRADIENT_PRESETS.map((g) => (
              <button
                key={g.key}
                type="button"
                onClick={() => set('scholarship_hero_gradient', g.key)}
                title={g.label}
                className={`relative rounded-lg overflow-hidden h-10 transition-all ${
                  form.scholarship_hero_gradient === g.key
                    ? 'ring-2 ring-offset-2 ring-zinc-900 scale-105'
                    : 'hover:scale-105 hover:shadow-md'
                }`}
                style={{ background: g.css }}
              >
                {form.scholarship_hero_gradient === g.key && (
                  <span className="absolute inset-0 flex items-center justify-center text-white text-xs font-bold">✓</span>
                )}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-1.5">
            {GRADIENT_PRESETS.find((g) => g.key === form.scholarship_hero_gradient)?.label ?? 'Navy Blue'} selected
          </p>
        </div>

        {/* Text color picker */}
        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-2">Text Color</label>
          <div className="flex flex-wrap gap-2">
            {TEXT_COLOR_PRESETS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => set('scholarship_hero_text_color', t.key)}
                title={t.label}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                  form.scholarship_hero_text_color === t.key
                    ? 'border-foreground bg-foreground text-background scale-105 shadow'
                    : 'border-border bg-card text-foreground hover:opacity-80'
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
          <label className="block text-sm font-medium text-muted-foreground mb-1">
            Hero Background Image
            <span className="text-xs font-normal ml-2">full-width photo — overrides gradient</span>
          </label>
          <div className="flex gap-2">
            <input
              type="url"
              value={form.scholarship_hero_image_url}
              onChange={(e) => set('scholarship_hero_image_url', e.target.value)}
              placeholder="https://... (leave blank to use gradient)"
              className="flex-1 border border-border rounded-lg px-3 py-2 text-sm bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-zinc-900"
            />
            {form.scholarship_hero_image_url && (
              <button type="button" onClick={() => set('scholarship_hero_image_url', '')}
                className="px-3 py-2 text-xs text-red-500 hover:text-red-700 border border-border rounded-lg">
                Clear
              </button>
            )}
          </div>
          {form.scholarship_hero_image_url && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={form.scholarship_hero_image_url} alt="Hero preview"
              className="mt-2 w-full h-20 rounded-lg object-cover border border-border" />
          )}
        </div>

        {/* Overlay toggle */}
        {form.scholarship_hero_image_url && (
          <div className="flex items-center justify-between py-3 border-t border-border">
            <div>
              <p className="text-sm font-medium text-foreground">Dark overlay over image</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {form.scholarship_hero_overlay !== 'false'
                  ? 'On — dark tint keeps text readable'
                  : 'Off — image shown as-is'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => set('scholarship_hero_overlay', form.scholarship_hero_overlay === 'false' ? 'true' : 'false')}
              className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors ${
                form.scholarship_hero_overlay !== 'false' ? 'bg-foreground' : 'bg-border'
              }`}
            >
              <span className={`inline-block h-5 w-5 transform rounded-full bg-background shadow transition-transform ${
                form.scholarship_hero_overlay !== 'false' ? 'translate-x-5' : 'translate-x-0'
              }`} />
            </button>
          </div>
        )}

        <div className="flex items-center gap-3 pt-1">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${
              saved ? 'bg-green-600 text-white' : 'bg-foreground text-background hover:opacity-90'
            }`}
          >
            {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save Scholarship Settings'}
          </button>
          <a href="/scholarship" target="_blank" rel="noopener noreferrer"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            Preview page ↗
          </a>
        </div>
      </div>
    </div>
  );
}

function IntegrationRow({
  label,
  description,
  status,
  helpUrl,
  envVar,
}: {
  label: string;
  description: string;
  status: 'checking' | 'ok' | 'missing';
  helpUrl?: string;
  envVar?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 border-b border-border last:border-0">
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        {envVar && <code className="text-xs text-dim mt-1 block">{envVar}</code>}
      </div>
      <div className="shrink-0 flex items-center gap-2">
        {status === 'checking' && (
          <span className="text-xs text-dim animate-pulse" role="status" aria-label={`Checking ${label} status`}>checking...</span>
        )}
        {status === 'ok' && (
          <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium" role="status" aria-label={`${label} connected`}>
            <span aria-hidden="true">✓</span> Connected
          </span>
        )}
        {status === 'missing' && (
          <div className="flex items-center gap-2" role="status" aria-label={`${label} not configured`}>
            <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
              <span aria-hidden="true">⚠</span> Not set
            </span>
            {helpUrl && (
              <a href={helpUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline">Setup →</a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
