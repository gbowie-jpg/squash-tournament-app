// Upcoming US Squash tournaments in the Pacific Northwest, from Club Locker's
// public tournament search (no token). Read at request time and cached for an
// hour — nothing is stored. Club Locker returns organizer contact emails and
// phones; parsePnwTournaments keeps only public event fields.

import { pacificToday } from '@/lib/league/time';

const SEARCH_URL = 'https://api.ussquash.com/resources/tournaments/';
// Idaho returns nothing today but costs one request; BC isn't on Club Locker.
export const PNW_STATES = ['WA', 'OR', 'ID'] as const;

export type PnwTournament = {
  clTournamentId: number;
  name: string;
  startDate: string;          // YYYY-MM-DD
  endDate: string;
  city: string | null;
  venueName: string | null;
  eventType: string | null;   // 'Open/Adult', 'Junior Silver', …
  isJunior: boolean;
  entryClose: string | null;  // YYYY-MM-DD
  logoUrl: string | null;
  url: string;
};

/** '10-30-2026' → '2026-10-30'. */
export function parseMdy(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const m = raw.trim().match(/^(\d{1,2})-(\d{1,2})-(\d{4})/);
  return m ? `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}` : null;
}

const text = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);

/** Upcoming (not yet ended) tournaments, soonest first, de-duplicated across states. */
export function parsePnwTournaments(rows: Record<string, unknown>[], today: string): PnwTournament[] {
  const byId = new Map<number, PnwTournament>();
  for (const r of rows) {
    const id = Number(r.TournamentID);
    const name = text(r.TournamentName);
    const startDate = parseMdy(r.StartDate);
    const endDate = parseMdy(r.EndDate) ?? startDate;
    if (!id || !name || !startDate || !endDate || endDate < today) continue;
    const eventType = text(r.EventType);
    byId.set(id, {
      clTournamentId: id,
      name,
      startDate,
      endDate,
      city: text(r.SiteCity),
      venueName: text(r.VenueName),
      eventType,
      isJunior: /junior/i.test(eventType ?? ''),
      entryClose: parseMdy(r.Entry_Close),
      logoUrl: text(r.LogoImageUrl) ?? text(r.OrganizerLogoUrl),
      url: `https://clublocker.com/tournaments/${id}/info`,
    });
  }
  return [...byId.values()].sort((a, b) => a.startDate.localeCompare(b.startDate) || a.name.localeCompare(b.name));
}

/** Never throws: a Club Locker outage just means an empty list. */
export async function fetchPnwTournaments(): Promise<PnwTournament[]> {
  const results = await Promise.allSettled(
    PNW_STATES.map(async (state) => {
      const res = await fetch(`${SEARCH_URL}?state=${state}`, {
        headers: { Accept: 'application/json' },
        next: { revalidate: 3600 },
        signal: AbortSignal.timeout(8_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.json();
      return Array.isArray(body) ? (body as Record<string, unknown>[]) : [];
    }),
  );
  const rows = results.flatMap((r, i) => {
    if (r.status === 'fulfilled') return r.value;
    console.warn(`[pnw-tournaments] ${PNW_STATES[i]} failed:`, (r.reason as Error).message);
    return [];
  });
  return parsePnwTournaments(rows, pacificToday());
}
