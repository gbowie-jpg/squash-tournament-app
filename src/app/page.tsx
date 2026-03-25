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
    <div className="min-h-screen bg-zinc-50">
      <header className="bg-white border-b border-zinc-200">
        <div className="max-w-3xl mx-auto px-4 py-6">
          <h1 className="text-2xl font-bold tracking-tight">Seattle Squash</h1>
          <p className="text-zinc-500 text-sm mt-1">Tournament Companion</p>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        {upcoming.length === 0 && past.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-zinc-400 text-lg">No tournaments yet.</p>
            <p className="text-zinc-400 text-sm mt-2">Check back soon or contact the organizer.</p>
          </div>
        ) : null}

        {upcoming.length > 0 && (
          <section className="mb-10">
            <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-4">
              {upcoming.some((t) => t.status === 'active') ? 'Active & Upcoming' : 'Upcoming'}
            </h2>
            <div className="space-y-3">
              {upcoming.map((t) => (
                <TournamentCard key={t.id} tournament={t} />
              ))}
            </div>
          </section>
        )}

        {past.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-4">Past</h2>
            <div className="space-y-3">
              {past.map((t) => (
                <TournamentCard key={t.id} tournament={t} />
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

function TournamentCard({ tournament: t }: { tournament: Tournament }) {
  const dateStr = new Date(t.start_date + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const statusColors = {
    active: 'bg-green-100 text-green-700',
    upcoming: 'bg-blue-100 text-blue-700',
    completed: 'bg-zinc-100 text-zinc-500',
  };

  return (
    <Link
      href={`/t/${t.slug}`}
      className="block bg-white rounded-xl border border-zinc-200 p-5 hover:border-zinc-300 hover:shadow-sm transition-all"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-semibold text-lg">{t.name}</h3>
          {t.venue && <p className="text-zinc-500 text-sm mt-0.5">{t.venue}</p>}
          <p className="text-zinc-400 text-sm mt-1">{dateStr}</p>
        </div>
        <span className={`text-xs font-medium px-2.5 py-1 rounded-full shrink-0 ${statusColors[t.status]}`}>
          {t.status === 'active' ? 'Live' : t.status.charAt(0).toUpperCase() + t.status.slice(1)}
        </span>
      </div>
    </Link>
  );
}
