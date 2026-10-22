import Link from 'next/link';
import { redirect } from 'next/navigation';
import SiteNav from '@/components/layout/SiteNav';
import SiteFooter from '@/components/layout/SiteFooter';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { Tournament } from '@/lib/supabase/types';
import LeagueHub from '@/components/league/LeagueHub';
import { loadCurrentSeason } from '@/lib/league/db';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const featuredSlug = process.env.NEXT_PUBLIC_FEATURED_SLUG;
  if (featuredSlug) {
    redirect(`/t/${featuredSlug}/register`);
  }

  const supabase = await createServerSupabaseClient();

  const [{ data: tournaments }, league] = await Promise.all([
    supabase.from('tournaments').select('*').order('start_date', { ascending: false }),
    loadCurrentSeason(),
  ]);

  const allTournaments = (tournaments ?? []) as Tournament[];
  const upcoming = allTournaments.filter((t) => t.status === 'upcoming' || t.status === 'active');
  const past = allTournaments.filter((t) => t.status === 'completed');

  // News, about, donations etc. live on seattlesquash.com — this page is the
  // app's home: league night first, then tournaments.
  return (
    <div className="min-h-screen flex flex-col bg-[var(--surface)]">
      <SiteNav />

      <h1 className="sr-only">Seattle Squash</h1>

      {/* Winter League */}
      <LeagueHub league={league} />

      {/* Tournaments */}
      <section id="tournaments" className="scroll-mt-4 flex-1">
        <div className="max-w-6xl mx-auto px-4 py-12">
          <h2 className="text-2xl font-bold mb-2 text-[var(--text-primary)]">Tournaments</h2>
          <p className="text-[var(--text-secondary)] mb-8">Live draws, real-time scores, and match schedules.</p>

          {allTournaments.length === 0 && (
            <div className="text-center py-12 bg-[var(--surface-card)] rounded-xl border border-[var(--border)]">
              <p className="text-[var(--text-secondary)] text-lg">No tournaments yet.</p>
              <p className="text-[var(--text-muted)] text-sm mt-2">Check back soon or contact the organizer.</p>
            </div>
          )}

          {upcoming.length > 0 && (
            <div className="mb-10">
              <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-4">
                {upcoming.some((t) => t.status === 'active') ? 'Active & Upcoming' : 'Upcoming'}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {upcoming.map((t) => <TournamentCard key={t.id} tournament={t} />)}
              </div>
            </div>
          )}

          {past.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-4">Past</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {past.map((t) => <TournamentCard key={t.id} tournament={t} />)}
              </div>
            </div>
          )}
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}

function TournamentCard({ tournament: t }: { tournament: Tournament }) {
  const dateStr = new Date(t.start_date + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
  const endDateStr = t.end_date
    ? new Date(t.end_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : null;

  const statusColors: Record<string, string> = {
    active: 'bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-400',
    upcoming: 'bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300',
    completed: 'bg-surface text-muted-foreground',
  };

  return (
    <Link
      href={`/t/${t.slug}`}
      className="flex items-center gap-4 bg-[var(--surface-card)] rounded-xl border border-[var(--border)] p-5 hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-md transition-all group"
    >
      {/* Tournament image / placeholder */}
      <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0 bg-[#1a2332] flex items-center justify-center border border-border">
        {t.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={t.image_url} alt={t.name} className="w-full h-full object-cover" />
        ) : (
          <span className="text-2xl">🏆</span>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-lg group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors leading-tight text-[var(--text-primary)]">{t.name}</h3>
          <span className={`text-xs font-medium px-2.5 py-1 rounded-full shrink-0 ${statusColors[t.status] || statusColors.upcoming}`}>
            {t.status === 'active' ? 'Live' : t.status.charAt(0).toUpperCase() + t.status.slice(1)}
          </span>
        </div>
        {t.venue && <p className="text-[var(--text-secondary)] text-sm mt-1 truncate">{t.venue}</p>}
        <p className="text-[var(--text-muted)] text-sm mt-0.5">
          {dateStr}{endDateStr ? ` – ${endDateStr}` : ''}
        </p>
      </div>
    </Link>
  );
}
