import Link from 'next/link';
import AutoRefresh from './AutoRefresh';
import { FixtureCard, PLAYOFF_SPOTS, StandingsTable, UpdatedLabel } from './LeagueParts';
import { loadLiveFixtureIds, type SeasonData } from '@/lib/league/db';
import { computeStandings } from '@/lib/league/standings';
import { formatLeagueDate, pacificToday } from '@/lib/league/time';
import { recentResults, upcomingFixtures } from '@/lib/league/view';

const MAX_CARDS = 6;

/** Homepage league block: next league night, latest results, top of each division. */
export default async function LeagueHub({ league }: { league: SeasonData | null }) {
  if (!league || !league.divisions.length) return null;
  const { season, divisions, teams, fixtures } = league;

  const today = pacificToday();
  const teamMap = new Map(teams.map((t) => [t.id, t]));
  const divisionName = new Map(divisions.map((d) => [d.id, d.name]));
  const upcoming = upcomingFixtures(fixtures, today);
  const results = recentResults(fixtures, today);
  const live = await loadLiveFixtureIds(upcoming.filter((f) => f.match_date === today).map((f) => f.id));
  const nextDate = upcoming[0]?.match_date;
  const isLeagueNight = nextDate === today;

  const cards = (list: typeof fixtures, showDate: boolean) => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {list.slice(0, MAX_CARDS).map((f) => (
        <div key={f.id}>
          <p className="text-xs text-[var(--text-muted)] mb-1">{divisionName.get(f.division_id)}</p>
          <FixtureCard fixture={f} teams={teamMap} live={live.has(f.id)} showDate={showDate} />
        </div>
      ))}
    </div>
  );

  return (
    <section className="border-b border-[var(--border)]">
      {isLeagueNight && <AutoRefresh seconds={90} />}
      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="flex flex-wrap items-end justify-between gap-2 mb-6">
          <div>
            <h2 className="text-2xl font-bold text-[var(--text-primary)]">{season.name}</h2>
            <UpdatedLabel iso={season.last_live_sync_at ?? season.last_full_sync_at} />
          </div>
          <Link href="/league" className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline">
            Full schedule & standings →
          </Link>
        </div>

        {upcoming.length > 0 && (
          <div className="mb-8">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-3">
              {isLeagueNight ? 'Tonight' : `Next league night · ${formatLeagueDate(nextDate!)}`}
            </h3>
            {cards(upcoming, upcoming.some((f) => f.match_date !== nextDate))}
            {upcoming.length > MAX_CARDS && (
              <Link href="/league" className="inline-block mt-3 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                +{upcoming.length - MAX_CARDS} more this week
              </Link>
            )}
          </div>
        )}

        {results.length > 0 && (
          <div className="mb-8">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-3">Latest results</h3>
            {cards(results, true)}
          </div>
        )}

        <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-3">
          Playoff race · top {PLAYOFF_SPOTS}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {divisions.map((d) => (
            <div key={d.id} className="bg-[var(--surface-card)] border border-[var(--border)] rounded-xl p-3">
              <Link href={`/league/division/${d.cl_division_id}`}
                className="block font-semibold text-sm text-[var(--text-primary)] px-2 pt-1 hover:underline">
                {d.name} →
              </Link>
              <StandingsTable
                rows={computeStandings(teams.filter((t) => t.division_id === d.id), fixtures.filter((f) => f.division_id === d.id))}
                compact
                limit={PLAYOFF_SPOTS}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
