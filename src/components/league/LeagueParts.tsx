import Link from 'next/link';
import { fixtureWinner, isPlayed, type StandingRow } from '@/lib/league/standings';
import { formatLeagueDate, formatLeagueTime, timeAgo } from '@/lib/league/time';
import { CLUB_NAMES, type LeagueFixture, type LeagueTeam } from '@/lib/league/types';

export const PLAYOFF_SPOTS = 4;

export function clubName(code: string | null): string | null {
  return code ? CLUB_NAMES[code] ?? code : null;
}

export function TeamLogo({ team, size = 28 }: { team: LeagueTeam | undefined; size?: number }) {
  if (team?.logo_url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={team.logo_url} alt="" width={size} height={size} className="rounded-full object-cover shrink-0 bg-white" style={{ width: size, height: size }} />;
  }
  return (
    <span
      className="rounded-full shrink-0 bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center text-[10px] font-semibold text-[var(--text-muted)]"
      style={{ width: size, height: size }}
    >
      {team?.name.slice(0, 2).toUpperCase() ?? '?'}
    </span>
  );
}

export function UpdatedLabel({ iso }: { iso: string | null }) {
  const ago = timeAgo(iso);
  return (
    <p className="text-xs text-[var(--text-muted)]">
      {ago ? `Updated from Club Locker ${ago}` : 'Waiting for first sync from Club Locker'}
    </p>
  );
}

/**
 * One team match. Shows the rubber score when played, otherwise time/venue.
 * `live` marks a fixture with rubbers in progress tonight.
 */
export function FixtureCard({
  fixture: f,
  teams,
  showDate = false,
  live = false,
  highlightTeamId,
}: {
  fixture: LeagueFixture;
  teams: Map<string, LeagueTeam>;
  showDate?: boolean;
  live?: boolean;
  highlightTeamId?: string;
}) {
  const home = f.home_team_id ? teams.get(f.home_team_id) : undefined;
  const away = f.away_team_id ? teams.get(f.away_team_id) : undefined;
  const played = isPlayed(f);
  const winner = played ? fixtureWinner(f) : null;
  const time = formatLeagueTime(f.start_time);

  const side = (team: LeagueTeam | undefined, rubbers: number, won: boolean) => (
    <div className="flex items-center gap-2 min-w-0">
      <TeamLogo team={team} size={22} />
      <span
        className="truncate text-sm"
        style={{
          fontWeight: won || team?.id === highlightTeamId ? 600 : 400,
          color: played && !won ? 'var(--text-secondary)' : 'var(--text-primary)',
        }}
      >
        {team?.name ?? 'TBD'}
      </span>
      {(played || live) && <span className="ml-auto pl-2 font-semibold tabular-nums text-[var(--text-primary)]">{rubbers}</span>}
    </div>
  );

  return (
    <Link
      href={`/league/match/${f.cl_scorecard_id}`}
      className="block bg-[var(--surface-card)] border border-[var(--border)] rounded-xl p-3 hover:border-blue-400 transition-colors"
    >
      <div className="flex items-center justify-between gap-2 mb-2 text-xs text-[var(--text-muted)]">
        <span className="truncate">
          {showDate && `${formatLeagueDate(f.match_date)} · `}
          {f.venue_name ?? 'Venue TBD'}
          {f.court ? ` · Court ${f.court}` : ''}
        </span>
        {live ? (
          <span className="shrink-0 font-semibold uppercase tracking-wide" style={{ color: '#dc2626' }}>● Live</span>
        ) : played ? (
          <span className="shrink-0">{f.cl_status === 'Confirmed' ? 'Final' : f.cl_status}</span>
        ) : (
          time && <span className="shrink-0">{time}</span>
        )}
      </div>
      <div className="space-y-1.5">
        {side(home, f.home_rubbers, winner === 'home')}
        {side(away, f.away_rubbers, winner === 'away')}
      </div>
    </Link>
  );
}

export function StandingsTable({
  rows,
  compact = false,
  limit,
}: {
  rows: StandingRow[];
  compact?: boolean;
  limit?: number;
}) {
  const shown = limit ? rows.slice(0, limit) : rows;
  const anyPlayed = rows.some((r) => r.played > 0);
  const th = 'px-2 py-2 text-right font-medium';
  const td = 'px-2 py-2 text-right tabular-nums';

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-xs text-[var(--text-muted)] border-b border-[var(--border)]">
          <tr>
            <th className="px-2 py-2 text-left font-medium w-6">#</th>
            <th className="px-2 py-2 text-left font-medium">Team</th>
            <th className={th}>P</th>
            <th className={th}>W–L{compact ? '' : '–T'}</th>
            {!compact && <th className={th}>Rubbers</th>}
            {!compact && <th className={`${th} hidden sm:table-cell`}>Games</th>}
            <th className={th}>Pts</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((r, i) => (
            <tr
              key={r.team.id}
              className="border-b border-[var(--border)] last:border-0"
              style={i === PLAYOFF_SPOTS - 1 && rows.length > PLAYOFF_SPOTS && !limit ? { borderBottom: '2px dashed var(--border)' } : undefined}
            >
              <td className="px-2 py-2 text-[var(--text-muted)] tabular-nums">{anyPlayed ? i + 1 : '–'}</td>
              <td className="px-2 py-2">
                <Link href={`/league/team/${r.team.cl_team_id}`} className="flex items-center gap-2 min-w-0 hover:underline">
                  <TeamLogo team={r.team} size={22} />
                  <span className="truncate text-[var(--text-primary)]">{r.team.name}</span>
                </Link>
              </td>
              <td className={`${td} text-[var(--text-secondary)]`}>{r.played}</td>
              <td className={`${td} text-[var(--text-secondary)]`}>
                {r.wins}–{r.losses}{compact ? '' : `–${r.ties}`}
              </td>
              {!compact && <td className={`${td} text-[var(--text-secondary)]`}>{r.rubbersWon}–{r.rubbersLost}</td>}
              {!compact && <td className={`${td} text-[var(--text-secondary)] hidden sm:table-cell`}>{r.gamesWon}–{r.gamesLost}</td>}
              <td className={`${td} font-semibold text-[var(--text-primary)]`}>{r.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function LeagueEmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-center py-10 bg-[var(--surface-card)] rounded-xl border border-[var(--border)] text-[var(--text-secondary)]">
      {children}
    </div>
  );
}
