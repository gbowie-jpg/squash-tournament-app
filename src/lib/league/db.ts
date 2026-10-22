import { createClient } from '@supabase/supabase-js';
import {
  FIXTURE_COLUMNS, SEASON_COLUMNS, TEAM_COLUMNS, isRubberInProgress,
  type LeagueDivision, type LeagueFixture, type LeagueRubber, type LeagueSeason, type LeagueTeam,
} from './types';

// League data is public, so pages read it with the anon key and no session
// (RLS: public SELECT, no writes). Untyped like the admin client — rows are
// cast to the types in ./types.ts.
export function createLeagueReadClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Fixture ids (of those given) with a rubber in progress. */
export async function loadLiveFixtureIds(fixtureIds: string[]): Promise<Set<string>> {
  if (!fixtureIds.length) return new Set();
  const { data } = await createLeagueReadClient()
    .from('league_rubbers')
    .select('fixture_id, is_live, is_complete, games')
    .in('fixture_id', fixtureIds);
  const live = new Set<string>();
  for (const r of (data ?? []) as Pick<LeagueRubber, 'fixture_id' | 'is_live' | 'is_complete' | 'games'>[]) {
    if (isRubberInProgress(r)) live.add(r.fixture_id);
  }
  return live;
}

export type SeasonData = {
  season: LeagueSeason;
  divisions: LeagueDivision[];
  teams: LeagueTeam[];
  fixtures: LeagueFixture[];
};

/**
 * Everything for the current season in four small queries (~25 teams,
 * ~170 fixtures). Returns null if there's no season yet or the league tables
 * don't exist (migration not run) — callers render an empty state.
 */
export async function loadCurrentSeason(): Promise<SeasonData | null> {
  const db = createLeagueReadClient();
  const { data: season, error } = await db
    .from('league_seasons')
    .select(SEASON_COLUMNS)
    .eq('is_current', true)
    .order('start_date', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !season) {
    if (error) console.warn('[league] season lookup failed:', error.message);
    return null;
  }

  const { data: divisions } = await db
    .from('league_divisions')
    .select('id, season_id, cl_division_id, name, rating_band, sort_order')
    .eq('season_id', season.id)
    .order('sort_order');
  const divisionIds = (divisions ?? []).map((d) => d.id);
  if (!divisionIds.length) {
    return { season: season as LeagueSeason, divisions: [], teams: [], fixtures: [] };
  }

  const [{ data: teams }, { data: fixtures }] = await Promise.all([
    db.from('league_teams').select(TEAM_COLUMNS).in('division_id', divisionIds),
    db.from('league_fixtures').select(FIXTURE_COLUMNS).in('division_id', divisionIds)
      .order('match_date').order('start_time'),
  ]);

  return {
    season: season as LeagueSeason,
    divisions: (divisions ?? []) as LeagueDivision[],
    teams: (teams ?? []) as LeagueTeam[],
    fixtures: (fixtures ?? []) as LeagueFixture[],
  };
}
