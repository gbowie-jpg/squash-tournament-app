import Shell from '@/components/league/LeagueShell';
import TournamentCard from '@/components/home/TournamentCard';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { Tournament } from '@/lib/supabase/types';
import { addDays, formatLeagueDate, pacificToday } from '@/lib/league/time';
import { fetchPnwTournaments, type PnwTournament } from '@/lib/tournaments/pnw';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Tournaments — Seattle Squash' };

export default async function TournamentsPage() {
  const supabase = await createServerSupabaseClient();
  const [{ data }, pnw] = await Promise.all([
    supabase.from('tournaments').select('*').order('start_date', { ascending: false }),
    fetchPnwTournaments(),
  ]);
  const appTournaments = (data ?? []) as Tournament[];
  const appCurrent = appTournaments.filter((t) => t.status !== 'completed').reverse();
  const appPast = appTournaments.filter((t) => t.status === 'completed');
  const today = pacificToday();
  const adult = pnw.filter((t) => !t.isJunior);
  const junior = pnw.filter((t) => t.isJunior);

  return (
    <Shell>
      <h1 className="text-3xl font-bold text-[var(--text-primary)]">Tournaments</h1>
      <p className="text-[var(--text-secondary)] mt-1 mb-8">
        US Squash events in Washington and Oregon. Register on Club Locker.
      </p>

      {appCurrent.length > 0 && (
        <section className="mb-10">
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-1">Live in this app</h2>
          <p className="text-sm text-[var(--text-secondary)] mb-3">Draws, court board and live scores on the day.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {appCurrent.map((t) => <TournamentCard key={t.id} tournament={t} />)}
          </div>
        </section>
      )}

      <PnwSection title="Adult & Open" list={adult} today={today} />
      <PnwSection title="Junior" list={junior} today={today} />

      {pnw.length === 0 && (
        <p className="text-sm text-[var(--text-secondary)] mb-10">
          No upcoming Pacific Northwest events found on Club Locker right now.
        </p>
      )}

      {appPast.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3">Past SSRA tournaments</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {appPast.map((t) => <TournamentCard key={t.id} tournament={t} />)}
          </div>
        </section>
      )}
    </Shell>
  );
}

function PnwSection({ title, list, today }: { title: string; list: PnwTournament[]; today: string }) {
  if (!list.length) return null;
  return (
    <section className="mb-10">
      <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3">{title}</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {list.map((t) => <PnwCard key={t.clTournamentId} t={t} today={today} />)}
      </div>
    </section>
  );
}

function dateRange(start: string, end: string): string {
  const s = formatLeagueDate(start, { month: 'short', day: 'numeric' });
  if (end === start) return `${s}, ${start.slice(0, 4)}`;
  const e = formatLeagueDate(end, start.slice(0, 7) === end.slice(0, 7) ? { day: 'numeric' } : { month: 'short', day: 'numeric' });
  return `${s} – ${e}, ${end.slice(0, 4)}`;
}

function PnwCard({ t, today }: { t: PnwTournament; today: string }) {
  const closed = !!t.entryClose && t.entryClose < today;
  const closingSoon = !closed && !!t.entryClose && t.entryClose <= addDays(today, 7);
  return (
    <a
      href={t.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex gap-3 bg-[var(--surface-card)] border border-[var(--border)] rounded-xl p-4 hover:border-blue-400 transition-colors"
    >
      <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0 bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center">
        {t.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={t.logoUrl} alt="" className="w-full h-full object-contain bg-white" />
        ) : (
          <span className="text-xl" aria-hidden>🏆</span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-[var(--text-primary)] leading-tight">{t.name}</p>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          {dateRange(t.startDate, t.endDate)}{t.city ? ` · ${t.city}` : ''}
        </p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs">
          {t.eventType && <span className="text-[var(--text-muted)]">{t.eventType}</span>}
          {t.entryClose && (
            <span style={{ color: closed ? 'var(--text-muted)' : closingSoon ? '#dc2626' : 'var(--text-secondary)', fontWeight: closingSoon ? 600 : 400 }}>
              {closed ? 'Entries closed' : `Entries close ${formatLeagueDate(t.entryClose, { month: 'short', day: 'numeric' })}`}
            </span>
          )}
          <span className="ml-auto text-blue-600 dark:text-blue-400">Club Locker ↗</span>
        </div>
      </div>
    </a>
  );
}
