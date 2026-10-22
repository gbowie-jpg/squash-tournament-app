import Link from 'next/link';
import { notFound } from 'next/navigation';
import Shell from '@/components/league/LeagueShell';
import AutoRefresh from '@/components/league/AutoRefresh';
import { TeamLogo, UpdatedLabel } from '@/components/league/LeagueParts';
import { createLeagueReadClient } from '@/lib/league/db';
import { fixtureWinner, isPlayed } from '@/lib/league/standings';
import { formatLeagueDate, formatLeagueTime, pacificToday } from '@/lib/league/time';
import { formatCourts } from '@/lib/league/view';
import {
  FIXTURE_COLUMNS, SEASON_COLUMNS, TEAM_COLUMNS, isRubberInProgress,
  type LeagueFixture, type LeagueRubber, type LeagueSeason, type LeagueTeam,
} from '@/lib/league/types';

export const dynamic = 'force-dynamic';

export default async function LeagueMatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const db = createLeagueReadClient();

  const { data: fixtureRow } = await db.from('league_fixtures').select(FIXTURE_COLUMNS).eq('cl_scorecard_id', Number(id)).maybeSingle();
  if (!fixtureRow) notFound();
  const f = fixtureRow as LeagueFixture;

  const teamIds = [f.home_team_id, f.away_team_id].filter((x): x is string => !!x);
  const [{ data: teamRows }, { data: rubberRows }, { data: division }, { data: seasonRow }] = await Promise.all([
    db.from('league_teams').select(TEAM_COLUMNS).in('id', teamIds),
    db.from('league_rubbers')
      .select('id, fixture_id, position, home_player_name, away_player_name, home_cl_player_id, away_cl_player_id, games, winner, is_live, is_complete, court, started_at, ended_at')
      .eq('fixture_id', f.id)
      .order('position'),
    db.from('league_divisions').select('name, cl_division_id').eq('id', f.division_id).maybeSingle(),
    db.from('league_seasons').select(SEASON_COLUMNS).eq('is_current', true).limit(1).maybeSingle(),
  ]);
  const teams = new Map(((teamRows ?? []) as LeagueTeam[]).map((t) => [t.id, t]));
  const home = f.home_team_id ? teams.get(f.home_team_id) : undefined;
  const away = f.away_team_id ? teams.get(f.away_team_id) : undefined;
  const rubbers = (rubberRows ?? []) as LeagueRubber[];
  const season = seasonRow as LeagueSeason | null;

  const today = pacificToday();
  const anyLive = rubbers.some(isRubberInProgress);
  const played = isPlayed(f) || rubbers.length > 0;
  const winner = played ? fixtureWinner(f) : null;
  const time = formatLeagueTime(f.start_time);

  const teamBlock = (team: LeagueTeam | undefined, label: string, won: boolean) => (
    <Link href={team ? `/league/team/${team.cl_team_id}` : '#'} className="flex flex-col items-center gap-2 min-w-0 flex-1 text-center">
      <TeamLogo team={team} size={56} />
      <span className="text-sm md:text-base text-[var(--text-primary)] leading-tight" style={{ fontWeight: won ? 700 : 500 }}>
        {team?.name ?? 'TBD'}
      </span>
      <span className="text-xs text-[var(--text-muted)]">{label}</span>
    </Link>
  );

  return (
    <Shell>
      {f.match_date === today && <AutoRefresh seconds={45} />}
      <Link href={division ? `/league/division/${division.cl_division_id}` : '/league'}
        className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
        ← {division?.name ?? 'Winter League'}
      </Link>

      <div className="max-w-2xl mx-auto mt-4">
        <p className="text-center text-sm text-[var(--text-secondary)]">
          {formatLeagueDate(f.match_date, { weekday: 'long', month: 'long', day: 'numeric' })}
          {time ? ` · ${time}` : ''}
        </p>
        <p className="text-center text-sm text-[var(--text-muted)] mb-6">
          {f.venue_name ?? 'Venue TBD'}{f.court ? ` · ${formatCourts(f.court)}` : ''}
        </p>

        <div className="flex items-center gap-4 bg-[var(--surface-card)] border border-[var(--border)] rounded-2xl p-5">
          {teamBlock(home, 'Home', winner === 'home')}
          <div className="text-center shrink-0">
            {played ? (
              <p className="text-4xl font-bold tabular-nums text-[var(--text-primary)]">{f.home_rubbers}–{f.away_rubbers}</p>
            ) : (
              <p className="text-xl font-semibold text-[var(--text-muted)]">vs</p>
            )}
            {anyLive && f.match_date === today ? (
              <p className="text-xs font-semibold uppercase tracking-wide mt-1" style={{ color: '#dc2626' }}>● Live</p>
            ) : played ? (
              <p className="text-xs text-[var(--text-muted)] mt-1">{f.cl_status === 'Confirmed' ? 'Final' : f.cl_status}</p>
            ) : null}
          </div>
          {teamBlock(away, 'Away', winner === 'away')}
        </div>

        {played && (
          <p className="text-center text-xs text-[var(--text-muted)] mt-2">
            Games {f.home_games}–{f.away_games} · Points {f.home_points}–{f.away_points}
            {(f.home_extra || f.away_extra) ? ` · Bonus ${f.home_extra}–${f.away_extra}` : ''}
          </p>
        )}

        {rubbers.length > 0 && (
          <section className="mt-8 space-y-3">
            {rubbers.map((r) => {
              const homeGames = r.games.filter(([h, a]) => h > a).length;
              const awayGames = r.games.filter(([h, a]) => a > h).length;
              return (
                <div key={r.id} className="bg-[var(--surface-card)] border border-[var(--border)] rounded-xl p-4">
                  <div className="flex items-center justify-between text-xs text-[var(--text-muted)] mb-2">
                    <span>#{r.position}{r.court ? ` · ${formatCourts(r.court)}` : ''}</span>
                    {isRubberInProgress(r) ? (
                      <span className="font-semibold uppercase" style={{ color: '#dc2626' }}>● In progress</span>
                    ) : r.is_complete ? (
                      <span>{homeGames}–{awayGames}</span>
                    ) : (
                      <span>Not started</span>
                    )}
                  </div>
                  {[
                    { name: r.home_player_name, won: r.winner === 'home', idx: 0 },
                    { name: r.away_player_name, won: r.winner === 'away', idx: 1 },
                  ].map((p) => (
                    <div key={p.idx} className="flex items-center gap-3 py-0.5">
                      <span className="flex-1 min-w-0 truncate text-sm text-[var(--text-primary)]" style={{ fontWeight: p.won ? 700 : 400 }}>
                        {p.name ?? '—'}
                      </span>
                      <span className="flex gap-1.5">
                        {r.games.map((g, gi) => (
                          <span key={gi} className="w-6 text-center tabular-nums text-sm"
                            style={{ fontWeight: g[p.idx] > g[1 - p.idx] ? 700 : 400, color: g[p.idx] > g[1 - p.idx] ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                            {g[p.idx]}
                          </span>
                        ))}
                      </span>
                    </div>
                  ))}
                </div>
              );
            })}
          </section>
        )}

        {!played && (
          <p className="text-center text-sm text-[var(--text-secondary)] mt-8">
            Scores appear here as they&apos;re entered in Club Locker.
          </p>
        )}

        <div className="mt-6 text-center">
          <UpdatedLabel iso={season?.last_live_sync_at ?? season?.last_full_sync_at ?? null} />
        </div>
      </div>
    </Shell>
  );
}
