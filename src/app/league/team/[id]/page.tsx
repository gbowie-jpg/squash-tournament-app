import Link from 'next/link';
import { notFound } from 'next/navigation';
import Shell from '@/components/league/LeagueShell';
import { FixtureCard, TeamLogo, clubName } from '@/components/league/LeagueParts';
import { createLeagueReadClient, loadCurrentSeason } from '@/lib/league/db';
import { clubLockerUrls } from '@/lib/league/clublocker';
import { computeStandings } from '@/lib/league/standings';
import { pacificToday } from '@/lib/league/time';
import type { LeagueRosterPlayer } from '@/lib/league/types';

export const dynamic = 'force-dynamic';

export default async function TeamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await loadCurrentSeason();
  const team = data?.teams.find((t) => String(t.cl_team_id) === id);
  if (!data || !team) notFound();

  const division = data.divisions.find((d) => d.id === team.division_id);
  const divisionTeams = data.teams.filter((t) => t.division_id === team.division_id);
  const teamMap = new Map(divisionTeams.map((t) => [t.id, t]));
  const fixtures = data.fixtures.filter((f) => f.home_team_id === team.id || f.away_team_id === team.id);
  const standings = computeStandings(divisionTeams, data.fixtures.filter((f) => f.division_id === team.division_id));
  const rank = standings.findIndex((r) => r.team.id === team.id);
  const row = standings[rank];

  const { data: rosterRows } = await createLeagueReadClient()
    .from('league_roster')
    .select('id, team_id, cl_player_id, name, rating, is_captain, wins, losses')
    .eq('team_id', team.id);
  // Dynamic playing order: highest-rated available player plays #1.
  const roster = ((rosterRows ?? []) as LeagueRosterPlayer[]).sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));

  const today = pacificToday();
  const upcoming = fixtures.filter((f) => f.match_date >= today);
  const past = fixtures.filter((f) => f.match_date < today).reverse();

  return (
    <Shell>
      <Link href={division ? `/league/division/${division.cl_division_id}` : '/league'}
        className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
        ← {division?.name ?? 'Winter League'}
      </Link>

      <div className="flex items-center gap-4 mt-3 mb-8">
        <TeamLogo team={team} size={56} />
        <div className="min-w-0">
          <h1 className="text-2xl md:text-3xl font-bold text-[var(--text-primary)] truncate">{team.name}</h1>
          <p className="text-[var(--text-secondary)] text-sm">
            {[clubName(team.club_code), division?.name].filter(Boolean).join(' · ')}
          </p>
          {row && row.played > 0 && (
            <p className="text-sm text-[var(--text-primary)] mt-1">
              <strong>#{rank + 1}</strong> · {row.points} pts · {row.wins}–{row.losses}{row.ties ? `–${row.ties}` : ''}
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section className="lg:col-span-1">
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-1">Roster</h2>
          <p className="text-xs text-[var(--text-muted)] mb-3">By current US Squash rating — the default playing order.</p>
          {roster.length ? (
            <ol className="bg-[var(--surface-card)] border border-[var(--border)] rounded-xl divide-y divide-[var(--border)]">
              {roster.map((p, i) => (
                <li key={p.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                  <span className="w-5 text-[var(--text-muted)] tabular-nums">{i + 1}</span>
                  <span className="flex-1 min-w-0 truncate text-[var(--text-primary)]">
                    {p.name}
                    {p.is_captain && <span className="ml-1.5 text-xs text-[var(--text-muted)]">(C)</span>}
                  </span>
                  <span className="text-xs text-[var(--text-muted)] tabular-nums">{p.wins}–{p.losses}</span>
                  <span className="w-12 text-right tabular-nums text-[var(--text-secondary)]">{p.rating?.toFixed(2) ?? '—'}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-[var(--text-secondary)]">Roster not loaded yet.</p>
          )}
          <a href={clubLockerUrls.team(team.cl_team_id)} target="_blank" rel="noopener noreferrer"
            className="inline-block mt-3 text-sm text-blue-600 dark:text-blue-400 hover:underline">
            Team on Club Locker ↗
          </a>
        </section>

        <section className="lg:col-span-2 space-y-8">
          {upcoming.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3">Upcoming</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {upcoming.map((f) => <FixtureCard key={f.id} fixture={f} teams={teamMap} showDate highlightTeamId={team.id} />)}
              </div>
            </div>
          )}
          {past.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3">Results</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {past.map((f) => <FixtureCard key={f.id} fixture={f} teams={teamMap} showDate highlightTeamId={team.id} />)}
              </div>
            </div>
          )}
        </section>
      </div>
    </Shell>
  );
}
