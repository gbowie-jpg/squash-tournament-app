'use client';

import Link from 'next/link';
import { use } from 'react';
import { useTournament } from '@/lib/useTournament';
import {
  Trophy, Target, Users, Building2, Megaphone,
  UserCheck, Mail, Settings, ChevronLeft, type LucideIcon,
} from 'lucide-react';

type AdminLink = { href: string; label: string; desc: string; Icon: LucideIcon };

export default function TournamentAdminDashboard({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const { tournament, loading } = useTournament(slug);

  if (loading) return <div className="flex items-center justify-center min-h-screen text-[var(--text-secondary)]">Loading…</div>;
  if (!tournament) return <div className="flex items-center justify-center min-h-screen text-[var(--text-secondary)]">Tournament not found</div>;

  const links: AdminLink[] = [
    { href: `/t/${slug}/admin/draws`, label: 'Draws & Scheduling', desc: 'Generate brackets, auto-schedule matches', Icon: Trophy },
    { href: `/t/${slug}/admin/matches`, label: 'Matches', desc: 'Assign courts, update scores, manage day-of', Icon: Target },
    { href: `/t/${slug}/admin/players`, label: 'Players', desc: 'Add and manage players', Icon: Users },
    { href: `/t/${slug}/admin/courts`, label: 'Courts', desc: 'Court status and scheduling', Icon: Building2 },
    { href: `/t/${slug}/admin/announcements`, label: 'Announcements', desc: 'Push messages to everyone', Icon: Megaphone },
    { href: `/t/${slug}/admin/volunteers`, label: 'Volunteers & Refs', desc: 'Manage signups, assign referees to matches', Icon: UserCheck },
    { href: `/t/${slug}/admin/email`, label: 'Email Marketing', desc: 'Send invitations and updates to participants', Icon: Mail },
    { href: `/t/${slug}/admin/settings`, label: 'Tournament Settings', desc: 'Edit details, graphic, schedule & contact info', Icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-[var(--surface)]">
      <header className="bg-[var(--surface-card)] border-b border-[var(--border)]">
        <div className="max-w-3xl mx-auto px-4 py-5">
          <Link href="/admin" className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center gap-1 mb-3">
            <ChevronLeft className="w-4 h-4" /> Admin Dashboard
          </Link>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">{tournament.name}</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-0.5">Tournament Admin</p>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {links.map(({ href, label, desc, Icon }) => (
            <Link
              key={href}
              href={href}
              className="bg-[var(--surface-card)] border border-[var(--border)] rounded-xl p-5 hover:border-zinc-300 dark:hover:border-zinc-600 hover:shadow-sm transition-all group"
            >
              <Icon className="w-5 h-5 text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-300 transition-colors" strokeWidth={1.5} />
              <h3 className="font-semibold mt-2.5 text-[var(--text-primary)]">{label}</h3>
              <p className="text-sm text-[var(--text-secondary)] mt-1">{desc}</p>
            </Link>
          ))}
        </div>

        <div className="mt-6 flex gap-4">
          <Link href={`/t/${slug}`} className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] underline underline-offset-2">
            View public page
          </Link>
          <Link href={`/t/${slug}/courts`} className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] underline underline-offset-2">
            View court board
          </Link>
        </div>
      </main>
    </div>
  );
}
