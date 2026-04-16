'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/useAuth';
import {
  Trophy, Image as ImageIcon, Video, CalendarDays, Mail,
  Settings, Users, User, type LucideIcon,
} from 'lucide-react';
import ThemeToggle from '@/components/ThemeToggle';

type Card = {
  href: string;
  label: string;
  desc: string;
  Icon: LucideIcon;
  ready: boolean;
};

export default function AdminDashboard() {
  const { signOut } = useAuth();
  const [isSuperadmin, setIsSuperadmin] = useState(false);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (data?.role === 'superadmin') setIsSuperadmin(true); })
      .catch(() => {});
  }, []);

  const cards: Card[] = [
    { href: '/admin/tournaments', label: 'Tournaments', desc: 'Create and manage tournament draws, scheduling, and scoring', Icon: Trophy, ready: true },
    { href: '/admin/content', label: 'Site Content', desc: 'Homepage hero image, headline, and tournament graphics', Icon: ImageIcon, ready: true },
    { href: '#', label: 'Recordings', desc: 'Match recordings and video management', Icon: Video, ready: false },
    { href: '#', label: 'SSRA Events', desc: 'League nights, clinics, and community events', Icon: CalendarDays, ready: false },
    { href: '/admin/email', label: 'Email Marketing', desc: 'Send newsletters and updates to members and the community', Icon: Mail, ready: true },
    { href: '/admin/settings', label: 'Settings', desc: 'Integrations, env vars, and URL structure reference', Icon: Settings, ready: true },
    ...(isSuperadmin ? [{ href: '/admin/users', label: 'Users', desc: 'Manage user accounts, roles, and tournament access', Icon: Users, ready: true }] : []),
  ];

  return (
    <div className="min-h-screen bg-[var(--surface)]">
      <header className="bg-[var(--surface-card)] border-b border-[var(--border)]">
        <div className="max-w-4xl mx-auto px-4 py-5 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">Seattle Squash</h1>
            <p className="text-sm text-[var(--text-secondary)]">Admin Dashboard</p>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-surface" />
            <Link href="/account" className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors flex items-center gap-1.5">
              <User className="w-4 h-4" /> My Profile
            </Link>
            <button onClick={signOut} className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {cards.map((card) => {
            const { Icon } = card;
            return card.ready ? (
              <Link
                key={card.label}
                href={card.href}
                className="bg-[var(--surface-card)] border border-[var(--border)] rounded-xl p-6 hover:border-border hover:shadow-sm transition-all group"
              >
                <Icon className="w-7 h-7 text-dim group-hover:text-muted-foreground transition-colors" strokeWidth={1.5} />
                <h3 className="font-semibold text-lg mt-3 text-[var(--text-primary)]">{card.label}</h3>
                <p className="text-sm text-[var(--text-secondary)] mt-1">{card.desc}</p>
              </Link>
            ) : (
              <div key={card.label} className="bg-[var(--surface-card)] border border-[var(--border)] rounded-xl p-6 opacity-50">
                <Icon className="w-7 h-7 text-dim" strokeWidth={1.5} />
                <h3 className="font-semibold text-lg mt-3 text-[var(--text-primary)]">
                  {card.label}
                  <span className="text-xs font-normal text-[var(--text-secondary)] ml-2 bg-surface px-2 py-0.5 rounded-full">
                    Coming Soon
                  </span>
                </h3>
                <p className="text-sm text-[var(--text-secondary)] mt-1">{card.desc}</p>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
