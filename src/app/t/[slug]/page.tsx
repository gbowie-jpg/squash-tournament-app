import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { Tournament } from '@/lib/supabase/types';

export default async function TournamentHub({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createServerSupabaseClient();

  const { data } = await supabase
    .from('tournaments')
    .select('*')
    .eq('slug', slug)
    .single();

  const tournament = data as Tournament | null;
  if (!tournament) notFound();

  // Get match counts
  const { count: inProgress } = await supabase
    .from('matches')
    .select('*', { count: 'exact', head: true })
    .eq('tournament_id', tournament.id)
    .eq('status', 'in_progress');

  const { count: upcoming } = await supabase
    .from('matches')
    .select('*', { count: 'exact', head: true })
    .eq('tournament_id', tournament.id)
    .in('status', ['scheduled', 'on_deck']);

  const dateStr = new Date(tournament.start_date + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  const links = [
    {
      href: `/t/${slug}/courts`,
      label: 'Court Board',
      desc: 'Live view of all courts',
      emoji: '📋',
    },
    {
      href: `/t/${slug}/players`,
      label: 'Find My Matches',
      desc: 'Search by player name',
      emoji: '🔍',
    },
    {
      href: `/t/${slug}/announcements`,
      label: 'Announcements',
      desc: 'Updates from the organizer',
      emoji: '📢',
    },
  ];

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="bg-white border-b border-zinc-200">
        <div className="max-w-2xl mx-auto px-4 py-6">
          <Link href="/" className="text-sm text-zinc-400 hover:text-zinc-600 transition-colors">
            &larr; All Tournaments
          </Link>
          <h1 className="text-2xl font-bold tracking-tight mt-2">{tournament.name}</h1>
          {tournament.venue && (
            <p className="text-zinc-500 text-sm mt-1">{tournament.venue}</p>
          )}
          <p className="text-zinc-400 text-sm mt-0.5">{dateStr}</p>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        {/* At a glance */}
        <div className="flex gap-4 mb-8">
          <div className="flex-1 bg-white rounded-xl border border-zinc-200 p-4 text-center">
            <p className="text-3xl font-bold text-green-600">{inProgress ?? 0}</p>
            <p className="text-xs text-zinc-400 mt-1">In Progress</p>
          </div>
          <div className="flex-1 bg-white rounded-xl border border-zinc-200 p-4 text-center">
            <p className="text-3xl font-bold text-blue-600">{upcoming ?? 0}</p>
            <p className="text-xs text-zinc-400 mt-1">Coming Up</p>
          </div>
        </div>

        {/* Quick links */}
        <div className="space-y-3">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="flex items-center gap-4 bg-white rounded-xl border border-zinc-200 p-5 hover:border-zinc-300 hover:shadow-sm transition-all"
            >
              <span className="text-2xl">{link.emoji}</span>
              <div>
                <p className="font-semibold">{link.label}</p>
                <p className="text-sm text-zinc-400">{link.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
