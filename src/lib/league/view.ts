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

/**
 * Club Locker court codes list each court as one character, G = glass court:
 * '2' → 'Court 2', '67' → 'Courts 6 & 7', '4G' → 'Courts 4 & Glass'.
 */
export function formatCourts(code: string | null): string | null {
  const c = code?.trim().toUpperCase();
  if (!c) return null;
  if (!/^[0-9G]+$/.test(c)) return `Court ${code!.trim()}`;
  const courts = [...c].map((ch) => (ch === 'G' ? 'Glass' : ch));
  if (courts.length === 1) return courts[0] === 'Glass' ? 'Glass court' : `Court ${courts[0]}`;
  return `Courts ${courts.slice(0, -1).join(', ')} & ${courts.at(-1)}`;
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
