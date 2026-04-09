'use client';

import Link from 'next/link';
import { use } from 'react';
import { useTournament } from '@/lib/useTournament';

export default function AdminDashboard({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const { tournament, loading } = useTournament(slug);

  if (loading) return <div className="flex items-center justify-center min-h-screen text-zinc-600">Loading...</div>;
  if (!tournament) return <div className="flex items-center justify-center min-h-screen text-zinc-600">Tournament not found</div>;

  const links = [
    { href: `/t/${slug}/admin/draws`, label: 'Draws & Scheduling', desc: 'Generate brackets, auto-schedule matches', emoji: '🏆' },
    { href: `/t/${slug}/admin/matches`, label: 'Matches', desc: 'Assign courts, update scores, manage day-of', emoji: '🎯' },
    { href: `/t/${slug}/admin/players`, label: 'Players', desc: 'Add and manage players', emoji: '👥' },
    { href: `/t/${slug}/admin/courts`, label: 'Courts', desc: 'Court status and scheduling', emoji: '🏟️' },
    { href: `/t/${slug}/admin/announcements`, label: 'Announcements', desc: 'Push messages to everyone', emoji: '📢' },
    { href: `/t/${slug}/admin/volunteers`, label: 'Volunteers & Refs', desc: 'Manage signups, assign referees to matches', emoji: '🙋' },
    { href: `/t/${slug}/admin/email`, label: 'Email Marketing', desc: 'Send invitations and updates to participants', emoji: '📧' },
    { href: `/t/${slug}/admin/settings`, label: 'Tournament Settings', desc: 'Edit details, graphic, schedule & contact info', emoji: '⚙️' },
  ];

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="bg-white border-b border-zinc-200">
        <div className="max-w-3xl mx-auto px-4 py-6">
          <Link href="/admin" className="text-sm text-zinc-600 hover:text-zinc-800">&larr; Admin Dashboard</Link>
          <h1 className="text-2xl font-bold tracking-tight mt-2">{tournament.name}</h1>
          <p className="text-zinc-600 text-sm">Tournament Admin</p>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="bg-white border border-zinc-200 rounded-xl p-5 hover:border-zinc-300 hover:shadow-sm transition-all"
            >
              <span className="text-2xl">{link.emoji}</span>
              <h3 className="font-semibold mt-2">{link.label}</h3>
              <p className="text-sm text-zinc-600 mt-1">{link.desc}</p>
            </Link>
          ))}
        </div>

        <div className="mt-8 flex gap-3">
          <Link
            href={`/t/${slug}`}
            className="text-sm text-zinc-600 hover:text-zinc-700 underline"
          >
            View public page
          </Link>
          <Link
            href={`/t/${slug}/courts`}
            className="text-sm text-zinc-600 hover:text-zinc-700 underline"
          >
            View court board
          </Link>
        </div>
      </main>
    </div>
  );
}
