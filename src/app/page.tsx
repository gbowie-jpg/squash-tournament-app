import Link from 'next/link';
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
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="bg-[#1a2332] text-white">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center">
              <span className="text-[#1a2332] font-bold text-lg">SS</span>
            </div>
            <span className="font-bold text-lg tracking-tight">Seattle Squash</span>
          </Link>
          <div className="hidden md:flex items-center gap-6 text-sm">
            <Link href="https://seattlesquash.com/events" className="hover:text-blue-300 transition-colors">Events</Link>
            <Link href="https://seattlesquash.com/winter-league" className="hover:text-blue-300 transition-colors">Winter League</Link>
            <Link href="https://seattlesquash.com/galleries" className="hover:text-blue-300 transition-colors">Galleries</Link>
            <Link href="https://seattlesquash.com/about" className="hover:text-blue-300 transition-colors">About</Link>
            <Link href="https://seattlesquash.com/contact-us" className="hover:text-blue-300 transition-colors">Contact</Link>
            <Link href="/login" className="bg-blue-600 hover:bg-blue-700 px-4 py-1.5 rounded-lg font-medium transition-colors">
              Sign In
            </Link>
          </div>
          {/* Mobile menu button */}
          <Link href="/login" className="md:hidden bg-blue-600 hover:bg-blue-700 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors">
            Sign In
          </Link>
        </div>
      </nav>

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
                href="https://seattlesquash.com/donate"
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
      <section id="tournaments" className="scroll-mt-4">
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

      {/* Quick Links */}
      <section className="bg-[#1a2332] text-white">
        <div className="max-w-6xl mx-auto px-4 py-16">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center">
                  <span className="text-[#1a2332] font-bold text-lg">SS</span>
                </div>
                <span className="font-bold text-lg">Seattle Squash</span>
              </div>
              <p className="text-blue-200 text-sm leading-relaxed">
                The Seattle Squash Racquets Association — a non-profit fostering squash in the Pacific Northwest since the 1950s.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Quick Links</h4>
              <ul className="space-y-2 text-sm text-blue-200">
                <li><Link href="https://seattlesquash.com" className="hover:text-white transition-colors">Home</Link></li>
                <li><Link href="https://seattlesquash.com/about" className="hover:text-white transition-colors">About</Link></li>
                <li><Link href="https://seattlesquash.com/events" className="hover:text-white transition-colors">Events</Link></li>
                <li><Link href="https://seattlesquash.com/galleries" className="hover:text-white transition-colors">Gallery</Link></li>
                <li><Link href="https://seattlesquash.com/donate" className="hover:text-white transition-colors">Donate</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Contact</h4>
              <ul className="space-y-2 text-sm text-blue-200">
                <li>P.O. Box 665, Seattle, WA 98111</li>
                <li>
                  <a href="mailto:president@seattlesquash.com" className="hover:text-white transition-colors">
                    president@seattlesquash.com
                  </a>
                </li>
              </ul>
              <div className="flex gap-4 mt-6">
                <a href="https://facebook.com/seattlesquash" aria-label="Facebook" className="text-blue-200 hover:text-white transition-colors">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                </a>
                <a href="https://instagram.com/seattlesquash" aria-label="Instagram" className="text-blue-200 hover:text-white transition-colors">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
                </a>
                <a href="https://youtube.com/@seattlesquash" aria-label="YouTube" className="text-blue-200 hover:text-white transition-colors">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
                </a>
              </div>
            </div>
          </div>
          <div className="border-t border-white/10 mt-10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-blue-300">
            <p>&copy; {new Date().getFullYear()} Seattle Squash Racquets Association. All rights reserved.</p>
            <div className="flex gap-4">
              <Link href="https://seattlesquash.com/terms-conditions" className="hover:text-white transition-colors">Terms</Link>
              <Link href="https://seattlesquash.com/privacy-policy" className="hover:text-white transition-colors">Privacy</Link>
            </div>
          </div>
        </div>
      </section>
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
