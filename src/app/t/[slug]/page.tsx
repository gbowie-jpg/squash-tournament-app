import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { ClipboardList, Search, Megaphone, HandHelping, MapPin, Phone, Mail } from 'lucide-react';
import RefreshButton from '@/components/RefreshButton';

// Always fetch fresh data — tournament details change frequently
export const dynamic = 'force-dynamic';
import type { Tournament } from '@/lib/supabase/types';
import SiteNav from '@/components/layout/SiteNav';
import SiteFooter from '@/components/layout/SiteFooter';
import TournamentBottomNav from '@/components/layout/TournamentBottomNav';
import CountdownTimer from '@/components/CountdownTimer';
import InfoAccordion from '@/components/InfoAccordion';
import { heroBackground, getTextColors } from '@/lib/gradients';

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
  const textColors = getTextColors(tournament.hero_text_color);

  const quickLinks = [
    { href: `/t/${slug}/courts`, label: 'Court Board', desc: 'Live view of all courts', Icon: ClipboardList },
    { href: `/t/${slug}/players`, label: 'Find My Matches', desc: 'Search by player name', Icon: Search },
    { href: `/t/${slug}/announcements`, label: 'Announcements', desc: 'Updates from the organizer', Icon: Megaphone },
    { href: `/t/${slug}/volunteer`, label: 'Volunteer / Referee', desc: 'Sign up to help or officiate', Icon: HandHelping },
  ];

  const infoSections = [
    { label: 'Latest Information', content: tournament.info_latest },
    { label: 'Accommodations', content: tournament.info_accommodations },
    { label: 'Entry Info', content: tournament.info_entry },
    { label: 'Rules', content: tournament.info_rules },
  ];

  return (
    <div className="min-h-screen bg-[var(--surface)] flex flex-col pb-16 md:pb-0">
      <SiteNav />

      {/* Hero */}
      <header style={{ background: heroBackground(tournament.hero_image_url, tournament.hero_gradient, tournament.hero_overlay !== 'false') }}>
        <div className="max-w-5xl mx-auto px-4 py-10">
          <div className="flex flex-col md:flex-row items-center md:items-start gap-8">

            {/* Tournament graphic */}
            <div className="shrink-0">
              {tournament.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={tournament.image_url}
                  alt={tournament.name}
                  className="w-[140px] h-[140px] rounded-2xl object-cover shadow-lg"
                />
              ) : (
                <div className="w-[140px] h-[140px] rounded-2xl bg-black/20 flex items-center justify-center text-5xl shadow-lg">
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
                  <span className="bg-surface text-muted-foreground text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide">Completed</span>
                )}
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight" style={{ color: textColors.heading }}>
                {tournament.name}
              </h1>
              {(tournament.location_city || tournament.venue) && (
                <p className="text-lg mt-1" style={{ color: textColors.body }}>
                  {tournament.location_city || tournament.venue}
                </p>
              )}
              {tournament.category && (
                <p className="text-sm mt-0.5" style={{ color: textColors.accent }}>
                  {tournament.category}
                </p>
              )}
              <p className="mt-1 text-sm" style={{ color: textColors.accent }}>
                {startDateStr}{endDateStr ? ` – ${endDateStr}` : ''}
              </p>
              {tournament.venue && tournament.location_city && (
                <p className="text-sm mt-0.5" style={{ color: textColors.body, opacity: 0.8 }}>
                  {tournament.venue}
                </p>
              )}
            </div>

            {/* Countdown */}
            {isUpcoming && (
              <div className="shrink-0 bg-black/30 rounded-2xl px-6 py-5 text-center backdrop-blur-sm">
                <p className="text-xs uppercase tracking-widest mb-3 font-semibold" style={{ color: textColors.accent }}>
                  Starts In
                </p>
                <CountdownTimer targetDate={tournament.start_date} textColor={textColors.heading} />
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
              <StatCard label="Players" value={playerCount ?? 0} color="text-[var(--text-primary)]" />
              <StatCard label="Matches" value={matchCount ?? 0} color="text-[var(--text-primary)]" />
              <StatCard label="In Progress" value={inProgress ?? 0} color="text-green-600" />
              <StatCard label="Completed" value={completed ?? 0} color="text-blue-600 dark:text-blue-400" />
            </div>

            {/* Description */}
            {tournament.description && (
              <div className="bg-[var(--surface-card)] border border-[var(--border)] rounded-xl p-5">
                <p className="text-sm leading-relaxed whitespace-pre-wrap text-[var(--text-secondary)]">{tournament.description}</p>
              </div>
            )}

            {/* Draws */}
            {draws.length > 0 && (
              <div className="bg-[var(--surface-card)] border border-[var(--border)] rounded-xl p-5">
                <h2 className="font-semibold mb-3 text-[var(--text-primary)]">Draws</h2>
                <div className="flex flex-wrap gap-2">
                  {draws.map((d) => (
                    <span key={d} className="bg-surface text-foreground text-sm font-medium px-3 py-1.5 rounded-lg">{d}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Live/upcoming matches */}
            {nextMatches.length > 0 && (
              <div className="bg-[var(--surface-card)] border border-[var(--border)] rounded-xl p-5">
                <h2 className="font-semibold mb-3 text-[var(--text-primary)]">
                  {(inProgress ?? 0) > 0 ? 'Live & Upcoming Matches' : 'Upcoming Matches'}
                </h2>
                <div className="space-y-2">
                  {nextMatches.map((m) => (
                    <Link
                      key={m.id}
                      href={`/t/${slug}/match/${m.id}`}
                      className={`flex items-center justify-between p-3 rounded-lg text-sm transition-colors hover:opacity-80 ${
                        m.status === 'in_progress'
                          ? 'bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-800'
                          : 'bg-surface'
                      }`}
                    >
                      <div>
                        <span className="font-medium text-[var(--text-primary)]">{m.player1?.name || 'TBD'}</span>
                        <span className="text-[var(--text-muted)] mx-2">vs</span>
                        <span className="font-medium text-[var(--text-primary)]">{m.player2?.name || 'TBD'}</span>
                      </div>
                      <div className="text-right text-xs text-[var(--text-secondary)]">
                        {m.court?.name && <span className="mr-2">{m.court.name}</span>}
                        {m.status === 'in_progress' && <span className="text-green-600 dark:text-green-400 font-semibold">LIVE</span>}
                        {m.scheduled_time && m.status !== 'in_progress' && (
                          <span>{new Date(m.scheduled_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</span>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
                <Link href={`/t/${slug}/courts`} className="block text-center text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] mt-3 underline underline-offset-2">
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
                  className="flex items-center gap-4 bg-[var(--surface-card)] rounded-xl border border-[var(--border)] p-5 hover:border-border hover:shadow-sm transition-all group"
                >
                  <link.Icon className="w-5 h-5 text-dim group-hover:text-muted-foreground transition-colors flex-shrink-0" strokeWidth={1.5} />
                  <div>
                    <p className="font-semibold text-[var(--text-primary)]">{link.label}</p>
                    <p className="text-sm text-[var(--text-secondary)]">{link.desc}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* RIGHT: sidebar */}
          <div className="space-y-4">

            {/* Schedule */}
            {scheduleItems.length > 0 && (
              <div className="bg-[var(--surface-card)] border border-[var(--border)] rounded-xl p-5">
                <h2 className="font-semibold text-xs uppercase tracking-wide text-[var(--text-muted)] mb-4">Schedule</h2>
                <div className="space-y-3">
                  {scheduleItems.map((item, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <div className="w-2 h-2 rounded-full bg-border mt-1.5 shrink-0" />
                      <div>
                        <p className="text-xs text-[var(--text-muted)]">{item.date}</p>
                        <p className="text-sm font-medium text-[var(--text-primary)]">{item.label}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Venue */}
            {tournament.venue && (
              <div className="bg-[var(--surface-card)] border border-[var(--border)] rounded-xl p-5">
                <h2 className="font-semibold text-xs uppercase tracking-wide text-[var(--text-muted)] mb-3">Venue</h2>
                <p className="font-semibold text-[var(--text-primary)]">{tournament.venue}</p>
                {tournament.address && (
                  <p className="text-sm text-[var(--text-secondary)] mt-1">{tournament.address}</p>
                )}
                {(tournament.address || tournament.venue) && (
                  <a
                    href={`https://maps.google.com/?q=${encodeURIComponent(
                      [tournament.venue, tournament.address].filter(Boolean).join(', ')
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 mt-3 text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium"
                  >
                    <MapPin className="w-3.5 h-3.5" /> Open in Maps
                  </a>
                )}
              </div>
            )}

            {/* Contact */}
            {(tournament.contact_name || tournament.contact_email || tournament.contact_phone) && (
              <div className="bg-[var(--surface-card)] border border-[var(--border)] rounded-xl p-5">
                <h2 className="font-semibold text-xs uppercase tracking-wide text-[var(--text-muted)] mb-3">Contact</h2>
                {tournament.contact_name && (
                  <p className="font-semibold text-[var(--text-primary)] mb-2">{tournament.contact_name}</p>
                )}
                {tournament.contact_email && (
                  <a href={`mailto:${tournament.contact_email}`} className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:underline mb-1.5">
                    <Mail className="w-3.5 h-3.5" /> {tournament.contact_email}
                  </a>
                )}
                {tournament.contact_phone && (
                  <a href={`tel:${tournament.contact_phone}`} className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:underline">
                    <Phone className="w-3.5 h-3.5" /> {tournament.contact_phone}
                  </a>
                )}
              </div>
            )}

          </div>
        </div>
      </main>

      <SiteFooter />
      {/* Mobile refresh FAB — visible above bottom nav */}
      <div className="md:hidden fixed bottom-20 right-4 z-30">
        <div className="bg-[var(--surface-card)] border border-[var(--border)] rounded-full shadow-md">
          <RefreshButton />
        </div>
      </div>
      <TournamentBottomNav slug={slug} />
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-[var(--surface-card)] rounded-xl border border-[var(--border)] p-4 text-center">
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-[var(--text-muted)] mt-1">{label}</p>
    </div>
  );
}
