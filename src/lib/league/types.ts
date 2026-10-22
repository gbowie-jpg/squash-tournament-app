// Row types for the league_* tables (supabase/league-migration.sql).
// Kept out of Database in supabase/types.ts: league tables are read with the
// untyped public client in ./db.ts and cast to these.

export type LeagueSeason = {
  id: string;
  cl_season_id: number;
  name: string;
  start_date: string | null;
  end_date: string | null;
  is_current: boolean;
  last_full_sync_at: string | null;
  last_live_sync_at: string | null;
};

export type LeagueDivision = {
  id: string;
  season_id: string;
  cl_division_id: number;
  name: string;
  rating_band: string | null;
  sort_order: number;
};

export type LeagueTeam = {
  id: string;
  division_id: string;
  cl_team_id: number;
  name: string;
  club_code: string | null;
  logo_url: string | null;
  cl_points: number;
};

export type LeagueRosterPlayer = {
  id: string;
  team_id: string;
  cl_player_id: number;
  name: string;
  rating: number | null;
  is_captain: boolean;
  wins: number;
  losses: number;
};

export type LeagueFixture = {
  id: string;
  division_id: string;
  cl_scorecard_id: number;
  match_date: string;
  start_time: string | null;
  home_team_id: string | null;
  away_team_id: string | null;
  venue_name: string | null;
  court: string | null;
  round: string | null;
  cl_status: string;
  home_rubbers: number;
  away_rubbers: number;
  home_games: number;
  away_games: number;
  home_points: number;
  away_points: number;
  home_extra: number;
  away_extra: number;
  home_deduct: number;
  away_deduct: number;
  updated_at: string;
};

export type LeagueRubber = {
  id: string;
  fixture_id: string;
  position: number;
  home_player_name: string | null;
  away_player_name: string | null;
  home_cl_player_id: number | null;
  away_cl_player_id: number | null;
  games: [number, number][];
  winner: 'home' | 'away' | null;
  is_live: boolean;
  is_complete: boolean;
  court: string | null;
  started_at: string | null;
  ended_at: string | null;
};

/** A rubber being played right now (lineup entered but no games yet doesn't count). */
export function isRubberInProgress(r: Pick<LeagueRubber, 'is_live' | 'is_complete' | 'games'>): boolean {
  return r.is_live || (!r.is_complete && r.games.length > 0);
}

export const FIXTURE_COLUMNS =
  'id, division_id, cl_scorecard_id, match_date, start_time, home_team_id, away_team_id, venue_name, court, round, cl_status, home_rubbers, away_rubbers, home_games, away_games, home_points, away_points, home_extra, away_extra, home_deduct, away_deduct, updated_at';

export const SEASON_COLUMNS =
  'id, cl_season_id, name, start_date, end_date, is_current, last_full_sync_at, last_live_sync_at';

export const TEAM_COLUMNS = 'id, division_id, cl_team_id, name, club_code, logo_url, cl_points';

// Club codes Club Locker appends to team names → venue names players know.
export const CLUB_NAMES: Record<string, string> = {
  DT: 'SAC Downtown',
  NG: 'SAC Northgate',
  PC: 'PRO Club',
  PRO: 'PRO Club',
  CAC: 'Columbia Athletic Club',
  UW: 'University of Washington',
  WAC: 'Washington Athletic Club',
};
