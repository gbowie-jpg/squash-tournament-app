import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { Tournament } from '@/lib/supabase/types';
import SiteNav from '@/components/layout/SiteNav';
import SiteFooter from '@/components/layout/SiteFooter';

export default async function TournamentLanding({
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

  // Stats
  const [
    { count: playerCount },
    { count: matchCount },
    { count: inProgress },
    { count: upcoming },
    { count: completed },
  ] = await Promise.all([
    supabase.from('players').select('*', { count: 'exact', head: true }).eq('tournament_id', tournament.id),
    supabase.from('matches').select('*', { count: 'exact', head: true }).eq('tournament_id', tournament.id),
    supabase.from('matches').select('*', { count: 'exact', head: true }).eq('tournament_id', tournament.id).eq('status', 'in_progress'),
    supabase.from('matches').select('*', { count: 'exact', head: true }).eq('tournament_id', tournament.id).in('status', ['scheduled', 'on_deck']),
    supabase.from('matches').select('*', { count: 'exact', head: true }).eq('tournament_id', tournament.id).eq('status', 'completed'),
  ]);

  // Get distinct draws
  const { data: drawRows } = await supabase
    .from('matches')
    .select('draw')
    .eq('tournament_id', tournament.id)
    .not('draw', 'is', null);
  const draws = [...new Set((drawRows || []).map((r) => r.draw).filter(Boolean))];

  // Get next few matches
  const { data: nextMatches } = await supabase
    .from('matches')
    .select('*, player1:players!player1_id(name), player2:players!player2_id(name), court:courts!court_id(name)')
    .eq('tournament_id', tournament.id)
    .in('status', ['scheduled', 'on_deck', 'in_progress'])
    .order('sort_order')
    .order('scheduled_time', { nullsFirst: false })
    .limit(6);

  const startDate = new Date(tournament.start_date + 'T00:00:00');
  const dateStr = startDate.toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });
  const endDateStr = tournament.end_date
    ? new Date(tournament.end_date + 'T00:00:00').toLocaleDateString('en-US', {
        weekday: 'long', month: 'long', day: 'numeric',
      })
    : null;

  const links = [
    { href: `/t/${slug}/courts`, label: 'Court Board', desc: 'Live view of all courts', emoji: '📋' },
    { href: `/t/${slug}/players`, label: 'Find My Matches', desc: 'Search by player name', emoji: '🔍' },
    { href: `/t/${slug}/announcements`, label: 'Announcements', desc: 'Updates from the organizer', emoji: '📢' },
    { href: `/t/${slug}/volunteer`, label: 'Volunteer / Referee', desc: 'Sign up to help or officiate', emoji: '🙋' },
  ];

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col">
      <SiteNav />

      {/* Hero */}
      <header className="bg-[#1a2332] text-white">
        <div className="max-w-3xl mx-auto px-4 py-12 text-center">
          <div className="inline-block mb-3">
            {tournament.status === 'active' ? (
              <span className="bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide">Live Now</span>
            ) : tournament.status === 'upcoming' ? (
              <span className="bg-blue-500 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide">Upcoming</span>
            ) : (
              <span className="bg-zinc-500 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide">Completed</span>
            )}
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">{tournament.name}</h1>
          {tournament.venue && (
            <p className="text-blue-200 text-lg mt-2">{tournament.venue}</p>
          )}
          <p className="text-blue-300 mt-1">
            {dateStr}{endDateStr ? ` — ${endDateStr}` : ''}
          </p>
          {tournament.address && (
            <p className="text-blue-300 text-sm mt-1">{tournament.address}</p>
          )}
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 flex-1 w-full">
        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          <StatCard label="Players" value={playerCount ?? 0} color="text-zinc-900" />
          <StatCard label="Matches" value={matchCount ?? 0} color="text-zinc-900" />
          <StatCard label="In Progress" value={inProgress ?? 0} color="text-green-600" />
          <StatCard label="Completed" value={completed ?? 0} color="text-blue-600" />
        </div>

        {/* Description */}
        {tournament.description && (
          <div className="bg-white border border-zinc-200 rounded-xl p-5 mb-6">
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{tournament.description}</p>
          </div>
        )}

        {/* Draws overview */}
        {draws.length > 0 && (
          <div className="bg-white border border-zinc-200 rounded-xl p-5 mb-6">
            <h2 className="font-semibold mb-3">Draws</h2>
            <div className="flex flex-wrap gap-2">
              {draws.map((d) => (
                <span key={d} className="bg-zinc-100 text-zinc-800 text-sm font-medium px-3 py-1.5 rounded-lg">
                  {d}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Upcoming matches */}
        {nextMatches && nextMatches.length > 0 && (
          <div className="bg-white border border-zinc-200 rounded-xl p-5 mb-6">
            <h2 className="font-semibold mb-3">
              {(inProgress ?? 0) > 0 ? 'Live & Upcoming Matches' : 'Upcoming Matches'}
            </h2>
            <div className="space-y-2">
              {nextMatches.map((m) => (
                <div
                  key={m.id}
                  className={`flex items-center justify-between p-3 rounded-lg text-sm ${
                    m.status === 'in_progress' ? 'bg-green-50 border border-green-200' : 'bg-zinc-50'
                  }`}
                >
                  <div>
                    <span className="font-medium">
                      {(m.player1 as { name: string } | null)?.name || 'TBD'}
                    </span>
                    <span className="text-zinc-500 mx-2">vs</span>
                    <span className="font-medium">
                      {(m.player2 as { name: string } | null)?.name || 'TBD'}
                    </span>
                  </div>
                  <div className="text-right text-xs text-zinc-600">
                    {(m.court as { name: string } | null)?.name && (
                      <span className="mr-2">{(m.court as { name: string }).name}</span>
                    )}
                    {m.status === 'in_progress' && (
                      <span className="text-green-700 font-semibold">LIVE</span>
                    )}
                    {m.scheduled_time && m.status !== 'in_progress' && (
                      <span>{new Date(m.scheduled_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <Link
              href={`/t/${slug}/courts`}
              className="block text-center text-sm text-zinc-600 hover:text-zinc-800 mt-3 underline"
            >
              View full court board
            </Link>
          </div>
        )}

        {/* Quick links */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="flex items-center gap-4 bg-white rounded-xl border border-zinc-200 p-5 hover:border-zinc-300 hover:shadow-sm transition-all"
            >
              <span className="text-2xl">{link.emoji}</span>
              <div>
                <p className="font-semibold">{link.label}</p>
                <p className="text-sm text-zinc-600">{link.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-white rounded-xl border border-zinc-200 p-4 text-center">
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-zinc-600 mt-1">{label}</p>
    </div>
  );
}
