import Link from 'next/link';
import { notFound } from 'next/navigation';
import Shell from '@/components/league/LeagueShell';
import { FixtureCard, PLAYOFF_SPOTS, StandingsTable, UpdatedLabel } from '@/components/league/LeagueParts';
import { loadCurrentSeason } from '@/lib/league/db';
import { clubLockerUrls } from '@/lib/league/clublocker';
import { computeStandings } from '@/lib/league/standings';
import { formatLeagueDate, pacificToday } from '@/lib/league/time';
import { groupByDate } from '@/lib/league/view';
import type { LeagueFixture, LeagueTeam } from '@/lib/league/types';

export const dynamic = 'force-dynamic';

export default async function DivisionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await loadCurrentSeason();
  const division = data?.divisions.find((d) => String(d.cl_division_id) === id);
  if (!data || !division) notFound();

  const teams = data.teams.filter((t) => t.division_id === division.id);
  const fixtures = data.fixtures.filter((f) => f.division_id === division.id);
  const teamMap = new Map(teams.map((t) => [t.id, t]));
  const rows = computeStandings(teams, fixtures);
  const today = pacificToday();
  const upcoming = fixtures.filter((f) => f.match_date >= today);
  const past = fixtures.filter((f) => f.match_date < today).reverse();

  return (
    <Shell>
      <Link href="/league" className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]">← Winter League</Link>
      <div className="flex flex-wrap items-end justify-between gap-3 mt-2 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-[var(--text-primary)]">{division.name}</h1>
          {division.rating_band && <p className="text-[var(--text-secondary)]">{division.rating_band}</p>}
          <UpdatedLabel iso={data.season.last_live_sync_at ?? data.season.last_full_sync_at} />
        </div>
        <a href={clubLockerUrls.division(division.cl_division_id)} target="_blank" rel="noopener noreferrer"
          className="text-sm text-blue-600 dark:text-blue-400 hover:underline">
          View on Club Locker ↗
        </a>
      </div>

      <section className="bg-[var(--surface-card)] border border-[var(--border)] rounded-xl p-4 mb-10">
        <StandingsTable rows={rows} />
        <p className="text-xs text-[var(--text-muted)] mt-3">
          Dashed line: top {PLAYOFF_SPOTS} make the playoffs. Points = 1 per rubber won + bonus points.
          Ties on points are broken by team W–L, then rubbers, games and rally points.
        </p>
      </section>

      <FixtureList title="Upcoming" fixtures={upcoming} teams={teamMap} />
      <FixtureList title="Results" fixtures={past} teams={teamMap} />
    </Shell>
  );
}

function FixtureList({ title, fixtures, teams }: { title: string; fixtures: LeagueFixture[]; teams: Map<string, LeagueTeam> }) {
  if (!fixtures.length) return null;
  return (
    <section className="mb-10">
      <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3">{title}</h2>
      {groupByDate(fixtures).map(([date, dayFixtures]) => (
        <div key={date} className="mb-5">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-2">
            {formatLeagueDate(date, { weekday: 'long', month: 'short', day: 'numeric' })}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {dayFixtures.map((f) => <FixtureCard key={f.id} fixture={f} teams={teams} />)}
          </div>
        </div>
      ))}
    </section>
  );
}
