import Link from 'next/link';
import SiteNav from '@/components/layout/SiteNav';
import SiteFooter from '@/components/layout/SiteFooter';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { Tournament } from '@/lib/supabase/types';

export const metadata = { title: 'Events — Seattle Squash' };

export default async function EventsPage() {
  const supabase = await createServerSupabaseClient();
  const { data: tournaments } = await supabase
    .from('tournaments')
    .select('*')
    .order('start_date', { ascending: false });

  const allTournaments = (tournaments ?? []) as Tournament[];

  return (
    <div className="min-h-screen flex flex-col">
      <SiteNav />

      <main className="flex-1 bg-zinc-50">
        <div className="bg-gradient-to-r from-[#1a2332] to-[#2271b1] text-white py-14">
          <div className="max-w-4xl mx-auto px-4">
            <h1 className="text-3xl font-bold text-white">Events</h1>
            <p className="text-blue-200 mt-2">Tournaments, clinics, and community events hosted by Seattle Squash.</p>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 py-10">
          {/* Upcoming events from the app */}
          <h2 className="text-lg font-semibold mb-4">Tournament Events</h2>
          {allTournaments.length === 0 ? (
            <p className="text-zinc-500">No events scheduled yet. Check back soon.</p>
          ) : (
            <div className="space-y-3 mb-10">
              {allTournaments.map((t) => {
                const dateStr = new Date(t.start_date + 'T00:00:00').toLocaleDateString('en-US', {
                  weekday: 'short', month: 'long', day: 'numeric', year: 'numeric',
                });
                const statusColors: Record<string, string> = {
                  active: 'bg-green-100 text-green-700',
                  upcoming: 'bg-blue-100 text-blue-700',
                  completed: 'bg-zinc-100 text-zinc-600',
                };
                return (
                  <Link
                    key={t.id}
                    href={`/t/${t.slug}`}
                    className="block bg-white rounded-xl border border-zinc-200 p-5 hover:border-blue-300 hover:shadow-md transition-all"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="font-semibold text-lg">{t.name}</h3>
                        {t.venue && <p className="text-zinc-600 text-sm mt-1">{t.venue}</p>}
                        <p className="text-zinc-500 text-sm mt-1">{dateStr}</p>
                        {t.description && <p className="text-zinc-600 text-sm mt-2">{t.description}</p>}
                      </div>
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full shrink-0 ${statusColors[t.status] || statusColors.upcoming}`}>
                        {t.status === 'active' ? 'Live' : t.status.charAt(0).toUpperCase() + t.status.slice(1)}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}

          {/* Featured recurring events */}
          <h2 className="text-lg font-semibold mb-4">Recurring Events</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white rounded-xl border border-zinc-200 p-6">
              <h3 className="font-semibold text-lg mb-2">Washington State Open</h3>
              <p className="text-zinc-600 text-sm">Annual tournament held every October. Open to all skill levels with multiple draws.</p>
            </div>
            <div className="bg-white rounded-xl border border-zinc-200 p-6">
              <h3 className="font-semibold text-lg mb-2">Seattle City Championships</h3>
              <p className="text-zinc-600 text-sm">Held each April/May. Crowns city champions across divisions.</p>
            </div>
            <div className="bg-white rounded-xl border border-zinc-200 p-6">
              <h3 className="font-semibold text-lg mb-2">Referee Clinic</h3>
              <p className="text-zinc-600 text-sm">Training sessions for aspiring referees. Learn the rules and officiating best practices.</p>
            </div>
            <div className="bg-white rounded-xl border border-zinc-200 p-6">
              <h3 className="font-semibold text-lg mb-2">Junior Scholar Athlete Award</h3>
              <p className="text-zinc-600 text-sm">Recognizing outstanding young players who excel both on court and in academics.</p>
            </div>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
