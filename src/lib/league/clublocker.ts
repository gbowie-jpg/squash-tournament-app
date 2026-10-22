// Club Locker (US Squash) public league API.
//
// No auth needed for these endpoints — they're what clublocker.com/leagues/*
// loads for logged-out visitors. Undocumented, so parse defensively: anything
// unexpected becomes null/0 rather than throwing, and sync keeps the last good
// data if a request fails.
//
// Responses include captain emails/phones and roster payment fields. Only the
// fields named in the parse* functions below ever leave this module.

import { pacificLocalToIso } from './time';

const API_BASE ='https://api.ussquash.com/resources';
const TIMEOUT_MS = 15_000;

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}/${path}`, {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Club Locker ${path} → HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

type Raw = Record<string, unknown>;

const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : Number(v) || 0);
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);

// ── Parsed shapes ────────────────────────────────────────────────────────────

export type ClDivision = {
  clDivisionId: number;
  name: string;
  seasonName: string | null;
  startDate: string | null;
  endDate: string | null;
};

export type ClTeam = {
  clTeamId: number;
  name: string;
  clubCode: string | null;
  logoUrl: string | null;
  points: number;
};

export type ClRosterPlayer = {
  clPlayerId: number;
  name: string;
  rating: number | null;
  isCaptain: boolean;
  wins: number;
  losses: number;
};

export type ClFixture = {
  clScorecardId: number;
  clDivisionId: number;
  matchDate: string;          // YYYY-MM-DD
  startTime: string | null;   // HH:MM:SS
  homeClTeamId: number;
  awayClTeamId: number;
  venueName: string | null;
  court: string | null;
  round: string | null;
  clStatus: string;
  homeRubbers: number;
  awayRubbers: number;
  homeGames: number;
  awayGames: number;
  homePoints: number;
  awayPoints: number;
  homeExtra: number;
  awayExtra: number;
  homeDeduct: number;
  awayDeduct: number;
};

export type ClRubber = {
  position: number;
  homePlayerName: string | null;
  awayPlayerName: string | null;
  homeClPlayerId: number | null;
  awayClPlayerId: number | null;
  games: [number, number][];
  winner: 'home' | 'away' | null;
  isLive: boolean;
  isComplete: boolean;
  court: string | null;
  startedAt: string | null;
  endedAt: string | null;
};

// ── Parsers (pure, unit-tested) ──────────────────────────────────────────────

/** 'Wallbangers - DT' → { name: 'Wallbangers', clubCode: 'DT' }. Names without a suffix pass through. */
export function splitTeamName(raw: string): { name: string; clubCode: string | null } {
  const m = raw.trim().match(/^(.*\S)\s+-\s*([A-Za-z]{2,4})?\s*$/);
  if (!m) return { name: raw.trim(), clubCode: null };
  return { name: m[1], clubCode: m[2] ? m[2].toUpperCase() : null };
}

/** 'Gregory, Peter C.' → 'Peter C. Gregory'. */
export function formatRosterName(raw: string): string {
  const [last, first] = raw.split(',').map((s) => s.trim());
  return first ? `${first} ${last}` : raw.trim();
}

/** '10/20/26' → '2026-10-20'. Also accepts ISO 'YYYY-MM-DD…'. */
export function parseClDate(raw: unknown): string | null {
  const s = str(raw);
  if (!s) return null;
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const us = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
  if (!us) return null;
  const year = us[3].length === 2 ? `20${us[3]}` : us[3];
  return `${year}-${us[1].padStart(2, '0')}-${us[2].padStart(2, '0')}`;
}

/** '5-11, 11-7, 13-11' → [[5,11],[11,7],[13,11]] (home first). */
export function parseGames(raw: unknown): [number, number][] {
  const s = str(raw);
  if (!s) return [];
  const games: [number, number][] = [];
  for (const part of s.split(',')) {
    const m = part.trim().match(/^(\d+)\s*-\s*(\d+)$/);
    if (m) games.push([Number(m[1]), Number(m[2])]);
  }
  return games;
}

export function parseDivisions(rows: Raw[]): ClDivision[] {
  return rows
    .filter((r) => num(r.Leagueid) > 0)
    .map((r) => ({
      clDivisionId: num(r.Leagueid),
      name: str(r.LeagueDescr) ?? `Division ${num(r.Leagueid)}`,
      seasonName: str(r.SeasonDescr),
      startDate: parseClDate(r.SeasonStartDate),
      endDate: parseClDate(r.SeasonEndDate),
    }));
}

export function parseStandings(rows: Raw[]): ClTeam[] {
  return rows
    .filter((r) => num(r.teamid) > 0)
    .map((r) => {
      const { name, clubCode } = splitTeamName(str(r.Teamname) ?? '');
      return {
        clTeamId: num(r.teamid),
        name,
        clubCode,
        logoUrl: str(r.LogoImageUrl),
        points: num(r.TotalPointsTeamwins),
      };
    });
}

export function parseRoster(rows: Raw[]): ClRosterPlayer[] {
  return rows
    .filter((r) => num(r.playerid) > 0)
    .map((r) => {
      const rating = Number(r.CurrentRating ?? r.Rating);
      return {
        clPlayerId: num(r.playerid),
        name: formatRosterName(str(r.player) ?? ''),
        rating: Number.isFinite(rating) && rating > 0 ? Math.round(rating * 1000) / 1000 : null,
        isCaptain: num(r.IsCaptain) === 1,
        wins: num(r.wins),
        losses: num(r.losses),
      };
    });
}

export function parseSchedule(rows: Raw[], clDivisionId: number): ClFixture[] {
  const fixtures: ClFixture[] = [];
  for (const r of rows) {
    const matchDate = parseClDate(r.matchdate);
    if (num(r.scorecardid) <= 0 || !matchDate) continue;
    fixtures.push({
      clScorecardId: num(r.scorecardid),
      clDivisionId,
      matchDate,
      startTime: str(r.MatchTime),
      homeClTeamId: num(r.hteamid),
      awayClTeamId: num(r.vteamid),
      venueName: str(r.VenueName),
      court: str(r.CourtNumber),
      round: str(r.Round),
      clStatus: str(r.Score_Entered) ?? 'Scheduled',
      homeRubbers: num(r.Home_Matches_Won),
      awayRubbers: num(r.Visitor_Matches_Won),
      // Club Locker uses tennis terms: "sets" are games, "games" are rally points.
      homeGames: num(r.Visitor_Sets_lost),
      awayGames: num(r.Home_Sets_Lost),
      homePoints: num(r.Home_Games_Won),
      awayPoints: num(r.Visitor_Games_Won),
      homeExtra: num(r.hExtra_point_Manual),
      awayExtra: num(r.vExtra_point_Manual),
      homeDeduct: num(r.hDeduct_points),
      awayDeduct: num(r.vDeduct_points),
    });
  }
  return fixtures;
}

// Live-scoring timestamps are Seattle wall-clock time with no offset.
const isoOrNull = (v: unknown): string | null => {
  const s = str(v);
  if (!s || s.startsWith('1970')) return null;
  return /[zZ]|[+-]\d{2}:?\d{2}$/.test(s) ? s : pacificLocalToIso(s);
};

// Unplayed scorecards come back as one empty placeholder per position.
export function parseLiveScorecard(rows: Raw[]): ClRubber[] {
  return rows
    .filter((r) => num(r.positionNumber) > 0 && (str(r.playerHome1Name) || str(r.playerVisiting1Name) || str(r.score)))
    .map((r) => {
      const status = str(r.matchStatus);
      const winner = str(r.winner);
      return {
        position: num(r.positionNumber),
        homePlayerName: str(r.playerHome1Name),
        awayPlayerName: str(r.playerVisiting1Name),
        homeClPlayerId: num(r.playerHome1Id) || null,
        awayClPlayerId: num(r.playerVisiting1Id) || null,
        games: parseGames(r.score),
        winner: winner === 'H' ? 'home' : winner === 'V' ? 'away' : null,
        isLive: num(r.isLive) === 1,
        isComplete: status === 'C',
        court: str(r.court),
        startedAt: isoOrNull(r.startDate),
        endedAt: isoOrNull(r.endDate),
      };
    });
}

// ── Fetchers ─────────────────────────────────────────────────────────────────

export const fetchDivisions = async (clSeasonId: number) =>
  parseDivisions(await getJson<Raw[]>(`leagues/info/${clSeasonId}`));

export const fetchStandings = async (clDivisionId: number) =>
  parseStandings(await getJson<Raw[]>(`divisions/standings/${clDivisionId}`));

export const fetchSchedule = async (clDivisionId: number) =>
  parseSchedule(await getJson<Raw[]>(`divisions/schedule/${clDivisionId}/`), clDivisionId);

export const fetchRoster = async (clTeamId: number) =>
  parseRoster(await getJson<Raw[]>(`teams/${clTeamId}/players`));

export const fetchRubbers = async (clScorecardId: number) =>
  parseLiveScorecard(await getJson<Raw[]>(`leagues/scorecards/live?id=${clScorecardId}`));

export const clubLockerUrls = {
  season: (id: number) => `https://clublocker.com/leagues/${id}/home`,
  division: (id: number) => `https://clublocker.com/divisions/${id}/home`,
  team: (id: number) => `https://clublocker.com/teams/${id}/home`,
};
