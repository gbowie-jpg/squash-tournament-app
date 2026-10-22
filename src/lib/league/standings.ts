// Winter League standings, per the SSRA league rules:
//  - points: 1 per rubber won + bonus points (2 for the team win, 1 for a full
//    team that refereed) − deductions. Club Locker's own total (cl_points) is
//    used when present because it includes penalties applied there.
//  - a 2–2 team match is won on games, then rally points; still level = tie.
//  - regular-season ties on points are broken by (1) team win–loss
//    differential, (2) rubber differential, (3) game differential,
//    (4) rally point differential.

import type { LeagueFixture, LeagueTeam } from './types';

export type StandingRow = {
  team: LeagueTeam;
  played: number;
  wins: number;
  losses: number;
  ties: number;
  rubbersWon: number;
  rubbersLost: number;
  gamesWon: number;
  gamesLost: number;
  pointsWon: number;
  pointsLost: number;
  points: number;
};

export function isPlayed(f: Pick<LeagueFixture, 'cl_status' | 'home_rubbers' | 'away_rubbers'>): boolean {
  return f.cl_status !== 'Scheduled' || f.home_rubbers + f.away_rubbers > 0;
}

/** 'home' | 'away' | 'tie' for a played fixture. */
export function fixtureWinner(
  f: Pick<LeagueFixture, 'home_rubbers' | 'away_rubbers' | 'home_games' | 'away_games' | 'home_points' | 'away_points'>,
): 'home' | 'away' | 'tie' {
  const pairs: [number, number][] = [
    [f.home_rubbers, f.away_rubbers],
    [f.home_games, f.away_games],
    [f.home_points, f.away_points],
  ];
  for (const [h, a] of pairs) {
    if (h > a) return 'home';
    if (a > h) return 'away';
  }
  return 'tie';
}

export function computeStandings(teams: LeagueTeam[], fixtures: LeagueFixture[]): StandingRow[] {
  const rows = new Map<string, StandingRow>();
  for (const team of teams) {
    rows.set(team.id, {
      team, played: 0, wins: 0, losses: 0, ties: 0,
      rubbersWon: 0, rubbersLost: 0, gamesWon: 0, gamesLost: 0,
      pointsWon: 0, pointsLost: 0, points: 0,
    });
  }

  const computedPoints = new Map<string, number>();

  for (const f of fixtures) {
    if (!isPlayed(f) || f.round !== 'L') continue;
    const home = f.home_team_id ? rows.get(f.home_team_id) : undefined;
    const away = f.away_team_id ? rows.get(f.away_team_id) : undefined;
    const winner = fixtureWinner(f);

    const sides: [StandingRow | undefined, 'home' | 'away'][] = [[home, 'home'], [away, 'away']];
    for (const [row, side] of sides) {
      if (!row) continue;
      const us = side === 'home';
      row.played++;
      if (winner === 'tie') row.ties++;
      else if (winner === side) row.wins++;
      else row.losses++;
      row.rubbersWon += us ? f.home_rubbers : f.away_rubbers;
      row.rubbersLost += us ? f.away_rubbers : f.home_rubbers;
      row.gamesWon += us ? f.home_games : f.away_games;
      row.gamesLost += us ? f.away_games : f.home_games;
      row.pointsWon += us ? f.home_points : f.away_points;
      row.pointsLost += us ? f.away_points : f.home_points;
      const pts = us
        ? f.home_rubbers + f.home_extra - f.home_deduct
        : f.away_rubbers + f.away_extra - f.away_deduct;
      computedPoints.set(row.team.id, (computedPoints.get(row.team.id) ?? 0) + pts);
    }
  }

  for (const row of rows.values()) {
    row.points = row.team.cl_points || computedPoints.get(row.team.id) || 0;
  }

  return [...rows.values()].sort(
    (a, b) =>
      b.points - a.points ||
      (b.wins - b.losses) - (a.wins - a.losses) ||
      (b.rubbersWon - b.rubbersLost) - (a.rubbersWon - a.rubbersLost) ||
      (b.gamesWon - b.gamesLost) - (a.gamesWon - a.gamesLost) ||
      (b.pointsWon - b.pointsLost) - (a.pointsWon - a.pointsLost) ||
      a.team.name.localeCompare(b.team.name),
  );
}
