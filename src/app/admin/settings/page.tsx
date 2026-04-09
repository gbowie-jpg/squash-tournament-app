'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/useAuth';

export default function AdminSettings() {
  const { signOut } = useAuth();
  const [vapidStatus, setVapidStatus] = useState<'checking' | 'ok' | 'missing'>('checking');
  const [resendStatus, setResendStatus] = useState<'checking' | 'ok' | 'missing'>('checking');

  useEffect(() => {
    // Quick ping to push/send to check VAPID env
    fetch('/api/push/send', { method: 'GET' }).then((r) => {
      setVapidStatus(r.status === 405 ? 'ok' : 'missing');
    }).catch(() => setVapidStatus('missing'));

    // Quick ping to email to check Resend config
    fetch('/api/email/status').then((r) => {
      setResendStatus(r.ok ? 'ok' : 'missing');
    }).catch(() => setResendStatus('missing'));
  }, []);

  const sections = [
    {
      title: 'URL Structure',
      items: [
        { label: 'Tournament URLs', value: '/t/[slug]', note: 'e.g. /t/seattle-city-championships' },
        { label: 'Admin base', value: '/t/[slug]/admin', note: '' },
        { label: 'Public court board', value: '/t/[slug]/courts', note: '' },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="bg-white border-b border-zinc-200">
        <div className="max-w-3xl mx-auto px-4 py-6 flex items-center justify-between">
          <div>
            <Link href="/admin" className="text-sm text-zinc-500 hover:text-zinc-700">&larr; Dashboard</Link>
            <h1 className="text-2xl font-bold tracking-tight mt-0.5">Settings & Integrations</h1>
          </div>
          <button onClick={signOut} className="text-sm text-zinc-500 hover:text-zinc-700">Sign Out</button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">

        {/* Integration Status */}
        <div className="bg-white border border-zinc-200 rounded-xl p-6">
          <h2 className="font-semibold text-zinc-900 mb-4">Integration Status</h2>
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
        <div className="bg-white border border-zinc-200 rounded-xl p-6">
          <h2 className="font-semibold text-zinc-900 mb-1">URL Structure</h2>
          <p className="text-sm text-zinc-500 mb-4">
            Tournaments live at <code className="bg-zinc-100 px-1 rounded">/t/[slug]</code> — the{' '}
            <code className="bg-zinc-100 px-1 rounded">/t/</code> prefix keeps tournament URLs short and separate from
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
                <code className="text-xs bg-zinc-100 text-zinc-700 px-2 py-1 rounded font-mono w-72 shrink-0">{path}</code>
                <span className="text-zinc-600">{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Vercel Env Vars */}
        <div className="bg-white border border-zinc-200 rounded-xl p-6">
          <h2 className="font-semibold text-zinc-900 mb-1">Vercel Environment Variables</h2>
          <p className="text-sm text-zinc-500 mb-4">Add these in your Vercel project → Settings → Environment Variables.</p>
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
                <code className="text-xs bg-zinc-100 text-zinc-700 px-2 py-1 rounded font-mono shrink-0">{key}</code>
                <span className="text-zinc-500 mt-0.5">{note}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Links */}
        <div className="bg-white border border-zinc-200 rounded-xl p-6">
          <h2 className="font-semibold text-zinc-900 mb-4">Quick Links</h2>
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
                className="text-sm bg-zinc-100 hover:bg-zinc-200 text-zinc-700 px-3 py-2 rounded-lg transition-colors"
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
    <div className="flex items-start justify-between gap-4 py-3 border-b border-zinc-100 last:border-0">
      <div>
        <p className="text-sm font-medium text-zinc-800">{label}</p>
        <p className="text-xs text-zinc-500 mt-0.5">{description}</p>
        {envVar && <code className="text-xs text-zinc-400 mt-1 block">{envVar}</code>}
      </div>
      <div className="shrink-0 flex items-center gap-2">
        {status === 'checking' && (
          <span className="text-xs text-zinc-400">checking...</span>
        )}
        {status === 'ok' && (
          <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">✓ Connected</span>
        )}
        {status === 'missing' && (
          <div className="flex items-center gap-2">
            <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">⚠ Not set</span>
            {helpUrl && (
              <a href={helpUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline">Setup →</a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
