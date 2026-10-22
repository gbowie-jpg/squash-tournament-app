import Link from 'next/link';
import Shell from '@/components/league/LeagueShell';
import AutoRefresh from '@/components/league/AutoRefresh';
import {
  FixtureCard, LeagueEmptyState, PLAYOFF_SPOTS, StandingsTable, UpdatedLabel,
} from '@/components/league/LeagueParts';
import { loadCurrentSeason, loadLiveFixtureIds } from '@/lib/league/db';
import { clubLockerUrls } from '@/lib/league/clublocker';
import { computeStandings } from '@/lib/league/standings';
import { formatLeagueDate, pacificToday } from '@/lib/league/time';
import { groupByDate, recentResults, upcomingFixtures } from '@/lib/league/view';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Winter League — Seattle Squash' };

export default async function LeaguePage() {
  const data = await loadCurrentSeason();
  const today = pacificToday();

  if (!data || !data.divisions.length) {
    return (
      <Shell>
        <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-6">Winter League</h1>
        <LeagueEmptyState>League fixtures and standings will appear here once the season is loaded.</LeagueEmptyState>
      </Shell>
    );
  }

  const { season, divisions, teams, fixtures } = data;
  const teamMap = new Map(teams.map((t) => [t.id, t]));
  const upcoming = upcomingFixtures(fixtures, today);
  const results = recentResults(fixtures, today);
  const live = await loadLiveFixtureIds(fixtures.filter((f) => f.match_date === today).map((f) => f.id));
  const isLeagueNight = upcoming.some((f) => f.match_date === today);
  const divisionName = new Map(divisions.map((d) => [d.id, d.name]));

  return (
    <Shell>
      {isLeagueNight && <AutoRefresh seconds={60} />}

      <div className="flex flex-wrap items-end justify-between gap-3 mb-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Seattle Squash</p>
          <h1 className="text-3xl font-bold text-[var(--text-primary)]">{season.name}</h1>
          <UpdatedLabel iso={season.last_live_sync_at ?? season.last_full_sync_at} />
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          <a href={clubLockerUrls.season(season.cl_season_id)} target="_blank" rel="noopener noreferrer"
            className="px-3 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700">
            Enter scores (Club Locker)
          </a>
          <a href="https://www.seattlesquash.com/seattle-city-winter-league/" target="_blank" rel="noopener noreferrer"
            className="px-3 py-2 rounded-lg border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
            Rules & info
          </a>
        </div>
      </div>

      {upcoming.length > 0 && (
        <section className="mb-10">
          {groupByDate(upcoming).map(([date, list]) => (
            <div key={date} className="mb-6">
              <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3">
                {date === today ? 'Tonight' : formatLeagueDate(date, { weekday: 'long', month: 'short', day: 'numeric' })}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {list.map((f) => (
                  <div key={f.id}>
                    <p className="text-xs text-[var(--text-muted)] mb-1">{divisionName.get(f.division_id)}</p>
                    <FixtureCard fixture={f} teams={teamMap} live={live.has(f.id)} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </section>
      )}

      {results.length > 0 && (
        <section className="mb-10">
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3">Latest results</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {results.map((f) => (
              <div key={f.id}>
                <p className="text-xs text-[var(--text-muted)] mb-1">{divisionName.get(f.division_id)}</p>
                <FixtureCard fixture={f} teams={teamMap} showDate />
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-1">Standings</h2>
        <p className="text-sm text-[var(--text-secondary)] mb-4">Top {PLAYOFF_SPOTS} in each division make the playoffs.</p>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {divisions.map((d) => {
            const rows = computeStandings(teams.filter((t) => t.division_id === d.id), fixtures.filter((f) => f.division_id === d.id));
            return (
              <div key={d.id} className="bg-[var(--surface-card)] border border-[var(--border)] rounded-xl p-4">
                <div className="flex items-baseline justify-between mb-2">
                  <h3 className="font-semibold text-[var(--text-primary)]">
                    {d.name}
                    {d.rating_band && <span className="font-normal text-[var(--text-muted)] text-sm"> · {d.rating_band}</span>}
                  </h3>
                  <Link href={`/league/division/${d.cl_division_id}`} className="text-sm text-blue-600 dark:text-blue-400 hover:underline">
                    Full table & schedule →
                  </Link>
                </div>
                <StandingsTable rows={rows} compact />
              </div>
            );
          })}
        </div>
      </section>
    </Shell>
  );
}
