import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { Tournament } from '@/lib/supabase/types';
import SiteNav from '@/components/layout/SiteNav';
import SiteFooter from '@/components/layout/SiteFooter';
import CountdownTimer from '@/components/CountdownTimer';
import InfoAccordion from '@/components/InfoAccordion';

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
    { count: completed },
  ] = await Promise.all([
    supabase.from('players').select('*', { count: 'exact', head: true }).eq('tournament_id', tournament.id),
    supabase.from('matches').select('*', { count: 'exact', head: true }).eq('tournament_id', tournament.id),
    supabase.from('matches').select('*', { count: 'exact', head: true }).eq('tournament_id', tournament.id).eq('status', 'in_progress'),
    supabase.from('matches').select('*', { count: 'exact', head: true }).eq('tournament_id', tournament.id).eq('status', 'completed'),
  ]);

  // Draws
  const { data: drawRows } = await supabase
    .from('matches')
    .select('draw')
    .eq('tournament_id', tournament.id)
    .not('draw', 'is', null);
  const draws = [...new Set((drawRows || []).map((r: { draw: string | null }) => r.draw).filter(Boolean))] as string[];

  type MatchPreview = {
    id: string;
    status: string;
    scheduled_time: string | null;
    player1: { name: string } | null;
    player2: { name: string } | null;
    court: { name: string } | null;
  };

  const { data: nextMatchesRaw } = await supabase
    .from('matches')
    .select('id, status, scheduled_time, player1:players!player1_id(name), player2:players!player2_id(name), court:courts!court_id(name)')
    .eq('tournament_id', tournament.id)
    .in('status', ['scheduled', 'on_deck', 'in_progress'])
    .order('sort_order')
    .order('scheduled_time', { nullsFirst: false })
    .limit(6);

  const nextMatches = (nextMatchesRaw || []) as unknown as MatchPreview[];

  const fmt = (d: string | null, opts?: Intl.DateTimeFormatOptions) =>
    d ? new Date(d + 'T00:00:00').toLocaleDateString('en-US', opts || { month: 'short', day: 'numeric', year: 'numeric' }) : null;

  const startDateStr = fmt(tournament.start_date, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const endDateStr = tournament.end_date
    ? fmt(tournament.end_date, { weekday: 'long', month: 'long', day: 'numeric' })
    : null;

  // Schedule timeline entries
  const scheduleItems: { date: string; label: string }[] = [];
  if (tournament.registration_opens) scheduleItems.push({ date: fmt(tournament.registration_opens)!, label: 'Entry Open' });
  if (tournament.registration_deadline) scheduleItems.push({ date: fmt(tournament.registration_deadline)!, label: 'Registration Deadline' });
  if (tournament.draw_lock_date) scheduleItems.push({ date: fmt(tournament.draw_lock_date)!, label: 'Draw Lock Date' });
  if (tournament.entry_close_date) scheduleItems.push({ date: fmt(tournament.entry_close_date)!, label: 'Entry Closed' });
  scheduleItems.push({ date: fmt(tournament.start_date)!, label: 'Tournament Starts' });
  if (tournament.end_date) scheduleItems.push({ date: fmt(tournament.end_date)!, label: 'Tournament Ends' });

  const isUpcoming = tournament.status === 'upcoming';
  const isActive = tournament.status === 'active';

  const quickLinks = [
    { href: `/t/${slug}/courts`, label: 'Court Board', desc: 'Live view of all courts', emoji: '📋' },
    { href: `/t/${slug}/players`, label: 'Find My Matches', desc: 'Search by player name', emoji: '🔍' },
    { href: `/t/${slug}/announcements`, label: 'Announcements', desc: 'Updates from the organizer', emoji: '📢' },
    { href: `/t/${slug}/volunteer`, label: 'Volunteer / Referee', desc: 'Sign up to help or officiate', emoji: '🙋' },
  ];

  const infoSections = [
    { label: 'Latest Information', content: tournament.info_latest },
    { label: 'Accommodations', content: tournament.info_accommodations },
    { label: 'Entry Info', content: tournament.info_entry },
    { label: 'Rules', content: tournament.info_rules },
  ];

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col">
      <SiteNav />

      {/* Hero */}
      <header className="bg-[#1a2332] text-white">
        <div className="max-w-5xl mx-auto px-4 py-10">
          <div className="flex flex-col md:flex-row items-center md:items-start gap-8">

            {/* Tournament graphic */}
            <div className="shrink-0">
              {tournament.image_url ? (
                <Image
                  src={tournament.image_url}
                  alt={tournament.name}
                  width={140}
                  height={140}
                  className="rounded-2xl object-cover shadow-lg"
                  unoptimized
                />
              ) : (
                <div className="w-[140px] h-[140px] rounded-2xl bg-[#0d1726] flex items-center justify-center text-5xl shadow-lg">
                  🏆
                </div>
              )}
            </div>

            {/* Title block */}
            <div className="flex-1 text-center md:text-left">
              <div className="mb-3">
                {isActive ? (
                  <span className="bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide">Live Now</span>
                ) : isUpcoming ? (
                  <span className="bg-blue-500 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide">Upcoming</span>
                ) : (
                  <span className="bg-zinc-500 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide">Completed</span>
                )}
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white">{tournament.name}</h1>
              {(tournament.location_city || tournament.venue) && (
                <p className="text-blue-200 text-lg mt-1">{tournament.location_city || tournament.venue}</p>
              )}
              {tournament.category && (
                <p className="text-blue-300 text-sm mt-0.5">{tournament.category}</p>
              )}
              <p className="text-blue-300 mt-1 text-sm">
                {startDateStr}{endDateStr ? ` – ${endDateStr}` : ''}
              </p>
              {tournament.venue && tournament.location_city && (
                <p className="text-blue-400 text-sm mt-0.5">{tournament.venue}</p>
              )}
            </div>

            {/* Countdown */}
            {isUpcoming && (
              <div className="shrink-0 bg-[#0d1726] rounded-2xl px-6 py-5 text-center">
                <p className="text-xs text-zinc-400 uppercase tracking-widest mb-3 font-semibold">Starts In</p>
                <CountdownTimer targetDate={tournament.start_date} />
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 flex-1 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* LEFT: main info column */}
          <div className="lg:col-span-2 space-y-6">

            {/* Stats row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard label="Players" value={playerCount ?? 0} color="text-zinc-900" />
              <StatCard label="Matches" value={matchCount ?? 0} color="text-zinc-900" />
              <StatCard label="In Progress" value={inProgress ?? 0} color="text-green-600" />
              <StatCard label="Completed" value={completed ?? 0} color="text-blue-600" />
            </div>

            {/* Description */}
            {tournament.description && (
              <div className="bg-white border border-zinc-200 rounded-xl p-5">
                <p className="text-sm leading-relaxed whitespace-pre-wrap text-zinc-700">{tournament.description}</p>
              </div>
            )}

            {/* Draws */}
            {draws.length > 0 && (
              <div className="bg-white border border-zinc-200 rounded-xl p-5">
                <h2 className="font-semibold mb-3 text-zinc-900">Draws</h2>
                <div className="flex flex-wrap gap-2">
                  {draws.map((d) => (
                    <span key={d} className="bg-zinc-100 text-zinc-800 text-sm font-medium px-3 py-1.5 rounded-lg">{d}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Live/upcoming matches */}
            {nextMatches.length > 0 && (
              <div className="bg-white border border-zinc-200 rounded-xl p-5">
                <h2 className="font-semibold mb-3 text-zinc-900">
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
                        <span className="font-medium text-zinc-900">{m.player1?.name || 'TBD'}</span>
                        <span className="text-zinc-400 mx-2">vs</span>
                        <span className="font-medium text-zinc-900">{m.player2?.name || 'TBD'}</span>
                      </div>
                      <div className="text-right text-xs text-zinc-600">
                        {m.court?.name && <span className="mr-2">{m.court.name}</span>}
                        {m.status === 'in_progress' && <span className="text-green-700 font-semibold">LIVE</span>}
                        {m.scheduled_time && m.status !== 'in_progress' && (
                          <span>{new Date(m.scheduled_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <Link href={`/t/${slug}/courts`} className="block text-center text-sm text-zinc-500 hover:text-zinc-700 mt-3 underline">
                  View full court board
                </Link>
              </div>
            )}

            {/* Info accordion */}
            <InfoAccordion sections={infoSections} />

            {/* Quick links */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {quickLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="flex items-center gap-4 bg-white rounded-xl border border-zinc-200 p-5 hover:border-zinc-300 hover:shadow-sm transition-all"
                >
                  <span className="text-2xl">{link.emoji}</span>
                  <div>
                    <p className="font-semibold text-zinc-900">{link.label}</p>
                    <p className="text-sm text-zinc-500">{link.desc}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* RIGHT: sidebar */}
          <div className="space-y-4">

            {/* Schedule */}
            {scheduleItems.length > 0 && (
              <div className="bg-white border border-zinc-200 rounded-xl p-5">
                <h2 className="font-semibold text-sm uppercase tracking-wide text-zinc-500 mb-4">Schedule</h2>
                <div className="space-y-3">
                  {scheduleItems.map((item, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <div className="w-2 h-2 rounded-full bg-zinc-300 mt-1.5 shrink-0" />
                      <div>
                        <p className="text-xs text-zinc-500">{item.date}</p>
                        <p className="text-sm font-medium text-zinc-800">{item.label}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Venue */}
            {tournament.venue && (
              <div className="bg-white border border-zinc-200 rounded-xl p-5">
                <h2 className="font-semibold text-sm uppercase tracking-wide text-zinc-500 mb-3">Venue</h2>
                <p className="font-semibold text-zinc-900">{tournament.venue}</p>
                {tournament.address && (
                  <p className="text-sm text-zinc-500 mt-1">{tournament.address}</p>
                )}
                {tournament.address && (
                  <a
                    href={`https://maps.google.com/?q=${encodeURIComponent(tournament.address)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block mt-2 text-xs text-blue-600 hover:underline"
                  >
                    View on Google Maps →
                  </a>
                )}
              </div>
            )}

            {/* Contact */}
            {(tournament.contact_name || tournament.contact_email || tournament.contact_phone) && (
              <div className="bg-white border border-zinc-200 rounded-xl p-5">
                <h2 className="font-semibold text-sm uppercase tracking-wide text-zinc-500 mb-3">Contact</h2>
                {tournament.contact_name && (
                  <p className="font-semibold text-zinc-900 mb-2">{tournament.contact_name}</p>
                )}
                {tournament.contact_email && (
                  <a href={`mailto:${tournament.contact_email}`} className="flex items-center gap-2 text-sm text-blue-600 hover:underline mb-1">
                    <span>✉</span> {tournament.contact_email}
                  </a>
                )}
                {tournament.contact_phone && (
                  <a href={`tel:${tournament.contact_phone}`} className="flex items-center gap-2 text-sm text-blue-600 hover:underline">
                    <span>📞</span> {tournament.contact_phone}
                  </a>
                )}
              </div>
            )}

          </div>
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
      <p className="text-xs text-zinc-500 mt-1">{label}</p>
    </div>
  );
}
