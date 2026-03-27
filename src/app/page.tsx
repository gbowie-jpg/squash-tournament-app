import Link from 'next/link';
import SiteNav from '@/components/layout/SiteNav';
import SiteFooter from '@/components/layout/SiteFooter';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { Tournament } from '@/lib/supabase/types';

export default async function Home() {
  const supabase = await createServerSupabaseClient();
  const { data: tournaments } = await supabase
    .from('tournaments')
    .select('*')
    .order('start_date', { ascending: false });

  const allTournaments = (tournaments ?? []) as Tournament[];
  const upcoming = allTournaments.filter((t) => t.status === 'upcoming' || t.status === 'active');
  const past = allTournaments.filter((t) => t.status === 'completed');

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <SiteNav />

      {/* Hero */}
      <section className="bg-gradient-to-br from-[#1a2332] via-[#1e3a5f] to-[#2271b1] text-white">
        <div className="max-w-6xl mx-auto px-4 py-20 md:py-28">
          <div className="max-w-2xl">
            <p className="text-blue-300 font-medium text-sm uppercase tracking-wider mb-3">Seattle Squash Racquets Association</p>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight leading-tight text-white">
              Unleash your inner athlete and play the ultimate game.
            </h1>
            <p className="text-blue-100 text-lg mt-4 leading-relaxed">
              Your home for competitive squash in the Pacific Northwest. Over 70 years of fostering the squash community in Seattle.
            </p>
            <div className="flex flex-wrap gap-3 mt-8">
              <Link
                href="#tournaments"
                className="bg-white text-[#1a2332] px-6 py-3 rounded-lg font-semibold hover:bg-blue-50 transition-colors"
              >
                View Tournaments
              </Link>
              <Link
                href="/donate"
                className="border border-white/30 text-white px-6 py-3 rounded-lg font-semibold hover:bg-white/10 transition-colors"
              >
                Donate
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* What We Do — 3 feature cards */}
      <section className="bg-zinc-50 border-b border-zinc-200">
        <div className="max-w-6xl mx-auto px-4 py-16">
          <h2 className="text-2xl font-bold text-center mb-10">What We Do</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-xl border border-zinc-200 p-6 text-center">
              <div className="w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">📣</span>
              </div>
              <h3 className="font-semibold text-lg mb-2">Communication</h3>
              <p className="text-zinc-600 text-sm leading-relaxed">
                Keeping the community informed on local squash activity, events, and league updates across the Pacific Northwest.
              </p>
            </div>
            <div className="bg-white rounded-xl border border-zinc-200 p-6 text-center">
              <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">🏆</span>
              </div>
              <h3 className="font-semibold text-lg mb-2">Tournaments & League</h3>
              <p className="text-zinc-600 text-sm leading-relaxed">
                Tuesday night league matches from November to March, plus the Washington State Open and Seattle City Championships.
              </p>
            </div>
            <div className="bg-white rounded-xl border border-zinc-200 p-6 text-center">
              <div className="w-14 h-14 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">🤝</span>
              </div>
              <h3 className="font-semibold text-lg mb-2">Support</h3>
              <p className="text-zinc-600 text-sm leading-relaxed">
                Funding Howe Cup teams, coaching programs, junior development, and growing squash participation across all levels.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Tournaments */}
      <section id="tournaments" className="scroll-mt-4 flex-1">
        <div className="max-w-6xl mx-auto px-4 py-16">
          <h2 className="text-2xl font-bold mb-2">Tournaments</h2>
          <p className="text-zinc-600 mb-8">Live draws, real-time scores, and match schedules.</p>

          {upcoming.length === 0 && past.length === 0 ? (
            <div className="text-center py-12 bg-zinc-50 rounded-xl border border-zinc-200">
              <p className="text-zinc-600 text-lg">No tournaments yet.</p>
              <p className="text-zinc-500 text-sm mt-2">Check back soon or contact the organizer.</p>
            </div>
          ) : null}

          {upcoming.length > 0 && (
            <div className="mb-10">
              <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-4">
                {upcoming.some((t) => t.status === 'active') ? 'Active & Upcoming' : 'Upcoming'}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {upcoming.map((t) => (
                  <TournamentCard key={t.id} tournament={t} />
                ))}
              </div>
            </div>
          )}

          {past.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-4">Past</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {past.map((t) => (
                  <TournamentCard key={t.id} tournament={t} />
                ))}
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
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const statusColors: Record<string, string> = {
    active: 'bg-green-100 text-green-700',
    upcoming: 'bg-blue-100 text-blue-700',
    completed: 'bg-zinc-100 text-zinc-600',
  };

  return (
    <Link
      href={`/t/${t.slug}`}
      className="block bg-white rounded-xl border border-zinc-200 p-6 hover:border-blue-300 hover:shadow-md transition-all group"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-semibold text-lg group-hover:text-blue-700 transition-colors">{t.name}</h3>
          {t.venue && <p className="text-zinc-600 text-sm mt-1">{t.venue}</p>}
          <p className="text-zinc-500 text-sm mt-1">{dateStr}</p>
        </div>
        <span className={`text-xs font-medium px-2.5 py-1 rounded-full shrink-0 ${statusColors[t.status] || statusColors.upcoming}`}>
          {t.status === 'active' ? 'Live' : t.status.charAt(0).toUpperCase() + t.status.slice(1)}
        </span>
      </div>
    </Link>
  );
}
