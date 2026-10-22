// Mirrors the current Club Locker league season into the league_* tables.
//
//  - full: divisions, team standings, schedule, rosters, and rubbers for recent
//    or not-yet-mirrored results (~35 requests + rubbers). Hourly.
//  - live: standings, schedule and rubbers for today's fixtures only. Every few
//    minutes on league nights.
//
// Called by /api/league/sync, which pg_cron hits every 5 minutes; decideSyncMode
// turns most of those calls into no-ops. A failed Club Locker request leaves the
// previous rows in place and is recorded in league_seasons.last_sync_error.

import { createAdminClient } from '@/lib/supabase/admin';
import {
  fetchDivisions, fetchRoster, fetchRubbers, fetchSchedule, fetchStandings,
  type ClFixture, type ClTeam,
} from './clublocker';
import { isPlayed } from './standings';
import { addDays, pacificMinutes, pacificToday } from './time';

export type SyncMode = 'full' | 'live';

const FULL_EVERY_MS = 60 * 60_000;
const LIVE_EVERY_MS = 4 * 60_000;
// Live window on a league night, Seattle time: 5:30 PM → midnight.
const LIVE_START_MIN = 17 * 60 + 30;
// How far back a full sync re-reads rubbers (late score entry / corrections).
const RUBBER_LOOKBACK_DAYS = 14;

export function decideSyncMode(opts: {
  lastFullSyncAt: string | null;
  lastLiveSyncAt: string | null;
  hasFixturesToday: boolean;
  now: Date;
}): SyncMode | null {
  const { lastFullSyncAt, lastLiveSyncAt, hasFixturesToday, now } = opts;
  const age = (iso: string | null) => (iso ? now.getTime() - new Date(iso).getTime() : Infinity);
  if (age(lastFullSyncAt) >= FULL_EVERY_MS) return 'full';
  if (hasFixturesToday && pacificMinutes(now) >= LIVE_START_MIN && age(lastLiveSyncAt) >= LIVE_EVERY_MS) {
    return 'live';
  }
  return null;
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return results;
}

export type SyncResult = {
  mode: SyncMode | null;
  skipped?: string;
  divisions?: number;
  teams?: number;
  fixtures?: number;
  rosters?: number;
  rubberCards?: number;
  errors: string[];
};

type Db = ReturnType<typeof createAdminClient>;

export async function syncLeague(opts: { mode?: SyncMode | 'auto'; now?: Date } = {}): Promise<SyncResult> {
  const now = opts.now ?? new Date();
  const db = createAdminClient();
  const errors: string[] = [];

  const { data: season, error: seasonErr } = await db
    .from('league_seasons')
    .select('id, cl_season_id, last_full_sync_at, last_live_sync_at')
    .eq('is_current', true)
    .order('start_date', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (seasonErr) throw new Error(`league_seasons: ${seasonErr.message}`);
  if (!season) return { mode: null, skipped: 'no current season', errors };

  const today = pacificToday(now);
  const { data: divisionRows } = await db.from('league_divisions').select('id, cl_division_id').eq('season_id', season.id);
  let divisions = (divisionRows ?? []) as { id: string; cl_division_id: number }[];

  let hasFixturesToday = false;
  if (divisions.length) {
    const { count } = await db
      .from('league_fixtures')
      .select('id', { count: 'exact', head: true })
      .in('division_id', divisions.map((d) => d.id))
      .eq('match_date', today);
    hasFixturesToday = (count ?? 0) > 0;
  }

  const mode = !opts.mode || opts.mode === 'auto'
    ? decideSyncMode({
        lastFullSyncAt: season.last_full_sync_at,
        lastLiveSyncAt: season.last_live_sync_at,
        hasFixturesToday,
        now,
      })
    : opts.mode;
  if (!mode) return { mode: null, skipped: 'nothing due', errors };

  const result: SyncResult = { mode, errors };

  // ── Divisions (full only) ──
  if (mode === 'full' || !divisions.length) {
    const clDivisions = await fetchDivisions(season.cl_season_id);
    const { data, error } = await db
      .from('league_divisions')
      .upsert(
        clDivisions.map((d, i) => ({ season_id: season.id, cl_division_id: d.clDivisionId, name: d.name, sort_order: i })),
        { onConflict: 'cl_division_id' },
      )
      .select('id, cl_division_id');
    if (error) throw new Error(`league_divisions upsert: ${error.message}`);
    divisions = data ?? [];
  }
  result.divisions = divisions.length;
  const divisionIdByCl = new Map(divisions.map((d) => [d.cl_division_id, d.id]));

  // ── Standings + schedule per division ──
  const perDivision = await mapLimit(divisions, 3, async (d) => {
    try {
      const [teams, fixtures] = await Promise.all([fetchStandings(d.cl_division_id), fetchSchedule(d.cl_division_id)]);
      return { division: d, teams, fixtures };
    } catch (e) {
      errors.push(`division ${d.cl_division_id}: ${(e as Error).message}`);
      return { division: d, teams: [] as ClTeam[], fixtures: [] as ClFixture[] };
    }
  });

  const teamRows = perDivision.flatMap(({ division, teams }) =>
    teams.map((t) => ({
      division_id: division.id,
      cl_team_id: t.clTeamId,
      name: t.name,
      club_code: t.clubCode,
      logo_url: t.logoUrl,
      cl_points: t.points,
      updated_at: now.toISOString(),
    })),
  );
  if (teamRows.length) {
    const { error } = await db.from('league_teams').upsert(teamRows, { onConflict: 'cl_team_id' });
    if (error) throw new Error(`league_teams upsert: ${error.message}`);
  }

  const { data: allTeams } = await db
    .from('league_teams')
    .select('id, cl_team_id')
    .in('division_id', divisions.map((d) => d.id));
  const teamIdByCl = new Map(((allTeams ?? []) as { id: string; cl_team_id: number }[]).map((t) => [t.cl_team_id, t.id]));
  result.teams = teamIdByCl.size;

  const clFixtures = perDivision.flatMap((p) => p.fixtures);
  const fixtureRows = clFixtures
    .filter((f) => divisionIdByCl.has(f.clDivisionId))
    .map((f) => ({
      division_id: divisionIdByCl.get(f.clDivisionId)!,
      cl_scorecard_id: f.clScorecardId,
      match_date: f.matchDate,
      start_time: f.startTime,
      home_team_id: teamIdByCl.get(f.homeClTeamId) ?? null,
      away_team_id: teamIdByCl.get(f.awayClTeamId) ?? null,
      venue_name: f.venueName,
      court: f.court,
      round: f.round,
      cl_status: f.clStatus,
      home_rubbers: f.homeRubbers,
      away_rubbers: f.awayRubbers,
      home_games: f.homeGames,
      away_games: f.awayGames,
      home_points: f.homePoints,
      away_points: f.awayPoints,
      home_extra: f.homeExtra,
      away_extra: f.awayExtra,
      home_deduct: f.homeDeduct,
      away_deduct: f.awayDeduct,
      updated_at: now.toISOString(),
    }));
  let fixtureIdByCl = new Map<number, string>();
  if (fixtureRows.length) {
    const { data, error } = await db
      .from('league_fixtures')
      .upsert(fixtureRows, { onConflict: 'cl_scorecard_id' })
      .select('id, cl_scorecard_id');
    if (error) throw new Error(`league_fixtures upsert: ${error.message}`);
    fixtureIdByCl = new Map(((data ?? []) as { id: string; cl_scorecard_id: number }[]).map((f) => [f.cl_scorecard_id, f.id]));
  }
  result.fixtures = fixtureIdByCl.size;

  // ── Rosters (full only) ──
  if (mode === 'full') {
    const teams = [...teamIdByCl.entries()];
    let synced = 0;
    await mapLimit(teams, 4, async ([clTeamId, teamId]) => {
      try {
        await syncRoster(db, teamId, await fetchRoster(clTeamId));
        synced++;
      } catch (e) {
        errors.push(`roster ${clTeamId}: ${(e as Error).message}`);
      }
    });
    result.rosters = synced;
  }

  // ── Rubbers ──
  const cardsToFetch = await pickScorecards(db, mode, clFixtures, fixtureIdByCl, today);
  let fetched = 0;
  await mapLimit(cardsToFetch, 4, async (clScorecardId) => {
    const fixtureId = fixtureIdByCl.get(clScorecardId);
    if (!fixtureId) return;
    try {
      await syncRubbers(db, fixtureId, await fetchRubbers(clScorecardId));
      fetched++;
    } catch (e) {
      errors.push(`scorecard ${clScorecardId}: ${(e as Error).message}`);
    }
  });
  result.rubberCards = fetched;

  await db
    .from('league_seasons')
    .update({
      ...(mode === 'full' ? { last_full_sync_at: now.toISOString() } : {}),
      last_live_sync_at: now.toISOString(),
      last_sync_error: errors.length ? errors.slice(0, 10).join('\n') : null,
    })
    .eq('id', season.id);

  return result;
}

async function pickScorecards(
  db: Db,
  mode: SyncMode,
  clFixtures: ClFixture[],
  fixtureIdByCl: Map<number, string>,
  today: string,
): Promise<number[]> {
  const todays = clFixtures.filter((f) => f.matchDate === today).map((f) => f.clScorecardId);
  if (mode === 'live') return todays;

  const since = addDays(today, -RUBBER_LOOKBACK_DAYS);
  const played = clFixtures.filter((f) =>
    isPlayed({ cl_status: f.clStatus, home_rubbers: f.homeRubbers, away_rubbers: f.awayRubbers }),
  );
  const recent = played.filter((f) => f.matchDate >= since && f.matchDate <= today).map((f) => f.clScorecardId);

  // Older results we've never mirrored (first sync of a season, or after an outage).
  const playedIds = played.map((f) => fixtureIdByCl.get(f.clScorecardId)).filter((id): id is string => !!id);
  const withRubbers = new Set<string>();
  if (playedIds.length) {
    const { data } = await db.from('league_rubbers').select('fixture_id').in('fixture_id', playedIds);
    for (const r of (data ?? []) as { fixture_id: string }[]) withRubbers.add(r.fixture_id);
  }
  const missing = played
    .filter((f) => !withRubbers.has(fixtureIdByCl.get(f.clScorecardId) ?? ''))
    .map((f) => f.clScorecardId);

  return [...new Set([...todays, ...recent, ...missing])];
}

async function syncRoster(db: Db, teamId: string, players: Awaited<ReturnType<typeof fetchRoster>>) {
  // An empty response is treated as a glitch, not "everyone left".
  if (!players.length) return;
  {
    const { error } = await db.from('league_roster').upsert(
      players.map((p) => ({
        team_id: teamId,
        cl_player_id: p.clPlayerId,
        name: p.name,
        rating: p.rating,
        is_captain: p.isCaptain,
        wins: p.wins,
        losses: p.losses,
      })),
      { onConflict: 'team_id,cl_player_id' },
    );
    if (error) throw new Error(error.message);
  }
  // Drop players removed from the roster.
  {
    const keep = players.map((p) => p.clPlayerId);
    const { error } = await db
      .from('league_roster')
      .delete()
      .eq('team_id', teamId)
      .not('cl_player_id', 'in', `(${keep.join(',')})`);
    if (error) throw new Error(error.message);
  }
}

async function syncRubbers(db: Db, fixtureId: string, rubbers: Awaited<ReturnType<typeof fetchRubbers>>) {
  if (!rubbers.length) return;
  const { error } = await db.from('league_rubbers').upsert(
    rubbers.map((r) => ({
      fixture_id: fixtureId,
      position: r.position,
      home_player_name: r.homePlayerName,
      away_player_name: r.awayPlayerName,
      home_cl_player_id: r.homeClPlayerId,
      away_cl_player_id: r.awayClPlayerId,
      games: r.games,
      winner: r.winner,
      is_live: r.isLive,
      is_complete: r.isComplete,
      court: r.court,
      started_at: r.startedAt,
      ended_at: r.endedAt,
    })),
    { onConflict: 'fixture_id,position' },
  );
  if (error) throw new Error(error.message);
}
