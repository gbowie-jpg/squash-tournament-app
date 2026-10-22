import { describe, expect, it } from 'vitest';
import {
  formatRosterName, parseClDate, parseGames, parseLiveScorecard, parseRoster, parseSchedule, parseStandings, splitTeamName,
} from '@/lib/league/clublocker';
import { computeStandings, fixtureWinner } from '@/lib/league/standings';
import { decideSyncMode } from '@/lib/league/sync';
import { addDays, pacificLocalToIso, pacificToday } from '@/lib/league/time';
import { recentResults, upcomingFixtures } from '@/lib/league/view';
import type { LeagueFixture, LeagueTeam } from '@/lib/league/types';

describe('Club Locker parsing', () => {
  it('splits club suffixes off team names', () => {
    expect(splitTeamName('Wallbangers - DT')).toEqual({ name: 'Wallbangers', clubCode: 'DT' });
    expect(splitTeamName('Juanita Bay NIX - CAC')).toEqual({ name: 'Juanita Bay NIX', clubCode: 'CAC' });
    expect(splitTeamName('Not Fast Just Furious Redux -  ')).toEqual({ name: 'Not Fast Just Furious Redux', clubCode: null });
    expect(splitTeamName('WAC Attack')).toEqual({ name: 'WAC Attack', clubCode: null });
    expect(splitTeamName('Pro Club D2')).toEqual({ name: 'Pro Club D2', clubCode: null });
  });

  it('formats roster names first-last', () => {
    expect(formatRosterName('Gregory, Peter C.')).toBe('Peter C. Gregory');
    expect(formatRosterName('Hamon, Scott ')).toBe('Scott Hamon');
    expect(formatRosterName('Mononym')).toBe('Mononym');
  });

  it('parses Club Locker dates', () => {
    expect(parseClDate('10/20/26')).toBe('2026-10-20');
    expect(parseClDate('3/9/27')).toBe('2027-03-09');
    expect(parseClDate('2026-10-15T00:00:00')).toBe('2026-10-15');
    expect(parseClDate('soon')).toBeNull();
    expect(parseClDate(null)).toBeNull();
  });

  it('parses home-first game scores', () => {
    expect(parseGames('5-11, 11-7, 13-11, 8-11, 8-11')).toEqual([[5, 11], [11, 7], [13, 11], [8, 11], [8, 11]]);
    expect(parseGames('')).toEqual([]);
    expect(parseGames(null)).toEqual([]);
  });

  it('maps schedule rows, translating sets→games and games→points', () => {
    const [f] = parseSchedule([{
      scorecardid: 258566, matchdate: '10/20/26', MatchTime: '18:30:00', hteamid: 50119, vteamid: 50116,
      VenueName: 'Seattle Athletic Club/Downtown', CourtNumber: '5G', Round: 'L', Score_Entered: 'Confirmed',
      Home_Matches_Won: 1, Visitor_Matches_Won: 3, Home_Sets_Lost: 11, Visitor_Sets_lost: 5,
      Home_Games_Won: 138, Visitor_Games_Won: 160, hExtra_point_Manual: 1, vExtra_point_Manual: 3,
      hDeduct_points: 0, vDeduct_points: 0,
    }], 6538);
    expect(f).toMatchObject({
      clScorecardId: 258566, matchDate: '2026-10-20', homeRubbers: 1, awayRubbers: 3,
      homeGames: 5, awayGames: 11, homePoints: 138, awayPoints: 160, homeExtra: 1, awayExtra: 3,
    });
  });

  it('keeps only public fields from standings and rosters', () => {
    const [team] = parseStandings([{ teamid: 50113, Teamname: 'Butternuts - DT', email: 'captain@example.com', TotalPointsTeamwins: 6 }]);
    expect(team).toEqual({ clTeamId: 50113, name: 'Butternuts', clubCode: 'DT', logoUrl: null, points: 6 });

    const [player] = parseRoster([{ playerid: 1, player: 'Doe, Jane', CurrentRating: 4.527308, IsCaptain: 1, wins: 2, losses: 1, AmountPaid: 120, Owes: 0 }]);
    expect(player).toEqual({ clPlayerId: 1, name: 'Jane Doe', rating: 4.527, isCaptain: true, wins: 2, losses: 1 });
  });

  it('parses live scorecard rubbers with Pacific timestamps', () => {
    const [r] = parseLiveScorecard([{
      positionNumber: 3, playerHome1Name: 'Home Player', playerVisiting1Name: 'Away Player',
      playerHome1Id: 1, playerVisiting1Id: 2, score: '5-11, 11-7', winner: 'V', isLive: 0, matchStatus: 'C',
      court: '5G', startDate: '2026-10-20T18:45:26', endDate: '1970-01-01T00:00:00',
    }]);
    expect(r).toMatchObject({ position: 3, winner: 'away', isComplete: true, games: [[5, 11], [11, 7]], endedAt: null });
    expect(r.startedAt).toBe('2026-10-21T01:45:26.000Z'); // PDT = UTC−7
  });

  it('drops the empty placeholder rubbers of an unplayed scorecard', () => {
    expect(parseLiveScorecard([{ positionNumber: 1, playerHome1Name: null, playerVisiting1Name: null, score: null }])).toEqual([]);
  });
});

const team = (id: string, cl_points = 0): LeagueTeam => ({
  id, division_id: 'd', cl_team_id: Number(id.replace(/\D/g, '')) || 1, name: id, club_code: null, logo_url: null, cl_points,
});

const fixture = (over: Partial<LeagueFixture>): LeagueFixture => ({
  id: Math.random().toString(36), division_id: 'd', cl_scorecard_id: 1, match_date: '2026-10-20', start_time: '18:30:00',
  home_team_id: 'A', away_team_id: 'B', venue_name: null, court: null, round: 'L', cl_status: 'Confirmed',
  home_rubbers: 0, away_rubbers: 0, home_games: 0, away_games: 0, home_points: 0, away_points: 0,
  home_extra: 0, away_extra: 0, home_deduct: 0, away_deduct: 0, updated_at: '', ...over,
});

describe('standings', () => {
  it('breaks a 2–2 on games, then points', () => {
    expect(fixtureWinner(fixture({ home_rubbers: 2, away_rubbers: 2, home_games: 7, away_games: 8 }))).toBe('away');
    expect(fixtureWinner(fixture({ home_rubbers: 2, away_rubbers: 2, home_games: 8, away_games: 8, home_points: 140, away_points: 139 }))).toBe('home');
    expect(fixtureWinner(fixture({ home_rubbers: 2, away_rubbers: 2, home_games: 8, away_games: 8, home_points: 140, away_points: 140 }))).toBe('tie');
  });

  it('computes points (rubbers + bonus − deductions) when Club Locker has none', () => {
    const rows = computeStandings([team('A'), team('B')], [
      fixture({ home_rubbers: 3, away_rubbers: 1, home_extra: 3, away_extra: 1, home_games: 10, away_games: 5 }),
    ]);
    expect(rows.map((r) => [r.team.id, r.points, r.wins, r.losses])).toEqual([['A', 6, 1, 0], ['B', 2, 0, 1]]);
  });

  it("prefers Club Locker's points total", () => {
    const rows = computeStandings([team('A', 3), team('B', 2)], [
      fixture({ home_rubbers: 3, away_rubbers: 1, home_extra: 3, away_extra: 1 }),
    ]);
    expect(rows[0].points).toBe(3);
  });

  it('orders equal points by team W–L, then rubber differential', () => {
    const rows = computeStandings([team('A', 6), team('B', 6), team('C', 6)], [
      fixture({ home_team_id: 'A', away_team_id: 'C', home_rubbers: 3, away_rubbers: 1 }),
      fixture({ home_team_id: 'B', away_team_id: 'C', home_rubbers: 4, away_rubbers: 0 }),
    ]);
    expect(rows.map((r) => r.team.id)).toEqual(['B', 'A', 'C']);
  });

  it('ignores scheduled fixtures and playoffs', () => {
    const rows = computeStandings([team('A'), team('B')], [
      fixture({ cl_status: 'Scheduled' }),
      fixture({ round: 'P', home_rubbers: 4 }),
    ]);
    expect(rows.every((r) => r.played === 0)).toBe(true);
  });
});

describe('sync scheduling', () => {
  // 2026-10-21T02:00Z = Tue Oct 20, 7:00 PM PDT
  const leagueNight = new Date('2026-10-21T02:00:00Z');
  const minsAgo = (m: number) => new Date(leagueNight.getTime() - m * 60_000).toISOString();

  it('runs a full sync when the last one is over an hour old', () => {
    expect(decideSyncMode({ lastFullSyncAt: null, lastLiveSyncAt: null, hasFixturesToday: false, now: leagueNight })).toBe('full');
    expect(decideSyncMode({ lastFullSyncAt: minsAgo(61), lastLiveSyncAt: minsAgo(1), hasFixturesToday: false, now: leagueNight })).toBe('full');
  });

  it('runs live syncs on league nights after 5:30 PM', () => {
    expect(decideSyncMode({ lastFullSyncAt: minsAgo(20), lastLiveSyncAt: minsAgo(5), hasFixturesToday: true, now: leagueNight })).toBe('live');
    expect(decideSyncMode({ lastFullSyncAt: minsAgo(20), lastLiveSyncAt: minsAgo(2), hasFixturesToday: true, now: leagueNight })).toBeNull();
    const afternoon = new Date('2026-10-20T22:00:00Z'); // 3 PM PDT
    expect(decideSyncMode({ lastFullSyncAt: new Date(afternoon.getTime() - 20 * 60_000).toISOString(), lastLiveSyncAt: null, hasFixturesToday: true, now: afternoon })).toBeNull();
  });

  it('does nothing on other nights between full syncs', () => {
    expect(decideSyncMode({ lastFullSyncAt: minsAgo(20), lastLiveSyncAt: minsAgo(20), hasFixturesToday: false, now: leagueNight })).toBeNull();
  });
});

describe('time + view helpers', () => {
  it('uses the Seattle date, not UTC', () => {
    expect(pacificToday(new Date('2026-10-21T02:00:00Z'))).toBe('2026-10-20');
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(pacificLocalToIso('2026-12-01T19:00:00')).toBe('2026-12-02T03:00:00.000Z'); // PST = UTC−8
  });

  it('picks the next league week and the latest results', () => {
    const fixtures = [
      fixture({ match_date: '2026-10-20', home_rubbers: 3, away_rubbers: 1 }),
      fixture({ match_date: '2026-10-23', cl_status: 'Scheduled' }),
      fixture({ match_date: '2026-10-27', cl_status: 'Scheduled' }),
      fixture({ match_date: '2026-11-03', cl_status: 'Scheduled' }),
    ];
    expect(upcomingFixtures(fixtures, '2026-10-21').map((f) => f.match_date)).toEqual(['2026-10-23', '2026-10-27']);
    expect(recentResults(fixtures, '2026-10-21').map((f) => f.match_date)).toEqual(['2026-10-20']);
  });
});
