'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/useAuth';

export default function AdminDashboard() {
  const { user, signOut } = useAuth();
  const [isSuperadmin, setIsSuperadmin] = useState(false);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.role === 'superadmin') setIsSuperadmin(true);
      })
      .catch(() => {});
  }, []);

  const cards = [
    {
      href: '/admin/tournaments',
      label: 'Tournaments',
      desc: 'Create and manage tournament draws, scheduling, and scoring',
      emoji: '🏆',
      ready: true,
    },
    {
      href: '/admin/content',
      label: 'Site Content',
      desc: 'Homepage hero image, headline, and tournament graphics',
      emoji: '🖼️',
      ready: true,
    },
    {
      href: '#',
      label: 'Recordings',
      desc: 'Match recordings and video management',
      emoji: '🎥',
      ready: false,
    },
    {
      href: '#',
      label: 'SSRA Events',
      desc: 'League nights, clinics, and community events',
      emoji: '📅',
      ready: false,
    },
    {
      href: '/admin/email',
      label: 'Email Marketing',
      desc: 'Send newsletters and updates to members and the community',
      emoji: '📧',
      ready: true,
    },
    {
      href: '/admin/settings',
      label: 'Settings',
      desc: 'Integrations, env vars, and URL structure reference',
      emoji: '⚙️',
      ready: true,
    },
    ...(isSuperadmin ? [{
      href: '/admin/users',
      label: 'Users',
      desc: 'Manage user accounts, roles, and tournament access',
      emoji: '👤',
      ready: true,
    }] : []),
  ];

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="bg-white border-b border-zinc-200">
        <div className="max-w-4xl mx-auto px-4 py-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Seattle Squash</h1>
            <p className="text-sm text-zinc-600">Admin Dashboard</p>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/account"
              className="text-sm text-zinc-600 hover:text-zinc-800 transition-colors"
            >
              My Profile
            </Link>
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {cards.map((card) =>
            card.ready ? (
              <Link
                key={card.label}
                href={card.href}
                className="bg-white border border-zinc-200 rounded-xl p-6 hover:border-zinc-300 hover:shadow-sm transition-all"
              >
                <span className="text-3xl">{card.emoji}</span>
                <h3 className="font-semibold text-lg mt-3">{card.label}</h3>
                <p className="text-sm text-zinc-600 mt-1">{card.desc}</p>
              </Link>
            ) : (
              <div
                key={card.label}
                className="bg-white border border-zinc-200 rounded-xl p-6 opacity-60"
              >
                <span className="text-3xl">{card.emoji}</span>
                <h3 className="font-semibold text-lg mt-3">
                  {card.label}
                  <span className="text-xs font-normal text-zinc-600 ml-2 bg-zinc-100 px-2 py-0.5 rounded-full">
                    Coming Soon
                  </span>
                </h3>
                <p className="text-sm text-zinc-600 mt-1">{card.desc}</p>
              </div>
            ),
          )}
        </div>
      </main>
    </div>
  );
}
