import { isPlayed } from './standings';
import { addDays } from './time';
import type { LeagueFixture } from './types';

/** Fixtures from the next league date (today or later) through the following 6 days. */
export function upcomingFixtures(fixtures: LeagueFixture[], today: string): LeagueFixture[] {
  const next = fixtures.filter((f) => f.match_date >= today).map((f) => f.match_date).sort()[0];
  if (!next) return [];
  const until = addDays(next, 6);
  return fixtures.filter((f) => f.match_date >= next && f.match_date <= until);
}

/** Played fixtures from the week ending on the most recent played date before today. */
export function recentResults(fixtures: LeagueFixture[], today: string): LeagueFixture[] {
  const played = fixtures.filter((f) => f.match_date < today && isPlayed(f));
  const last = played.map((f) => f.match_date).sort().at(-1);
  if (!last) return [];
  const from = addDays(last, -6);
  return played.filter((f) => f.match_date >= from).sort((a, b) => b.match_date.localeCompare(a.match_date));
}

export function groupByDate(fixtures: LeagueFixture[]): [string, LeagueFixture[]][] {
  const map = new Map<string, LeagueFixture[]>();
  for (const f of fixtures) {
    const list = map.get(f.match_date) ?? [];
    list.push(f);
    map.set(f.match_date, list);
  }
  return [...map.entries()];
}
