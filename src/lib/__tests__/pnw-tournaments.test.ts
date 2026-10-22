import { describe, expect, it } from 'vitest';
import { parseMdy, parsePnwTournaments } from '@/lib/tournaments/pnw';

const row = (over: Record<string, unknown>) => ({
  TournamentID: 19741,
  TournamentName: '2026 Oregon State Championships',
  StartDate: '10-30-2026',
  EndDate: '11-01-2026',
  SiteCity: 'Portland, OR',
  EventType: 'Open/Adult',
  Entry_Close: '10-23-2026',
  ContactEmail: 'organizer@example.com',
  ContactPhone: '5035550100',
  ...over,
});

describe('PNW tournaments', () => {
  it('parses Club Locker MM-DD-YYYY dates', () => {
    expect(parseMdy('10-30-2026')).toBe('2026-10-30');
    expect(parseMdy('1-8-2027')).toBe('2027-01-08');
    expect(parseMdy(null)).toBeNull();
  });

  it('keeps upcoming events soonest first, drops past ones and duplicates', () => {
    const list = parsePnwTournaments([
      row({ TournamentID: 3, TournamentName: 'Later', StartDate: '02-19-2027', EndDate: '02-21-2027' }),
      row({ TournamentID: 1 }),
      row({ TournamentID: 1 }),
      row({ TournamentID: 2, TournamentName: 'Over', StartDate: '05-29-2026', EndDate: '05-31-2026' }),
    ], '2026-10-22');
    expect(list.map((t) => t.clTournamentId)).toEqual([1, 3]);
  });

  it('keeps an event that is in progress today', () => {
    expect(parsePnwTournaments([row({ StartDate: '10-21-2026', EndDate: '10-23-2026' })], '2026-10-22')).toHaveLength(1);
  });

  it('exposes only public fields and flags junior events', () => {
    const [t] = parsePnwTournaments([row({ EventType: 'Junior Silver' })], '2026-10-22');
    expect(t).not.toHaveProperty('ContactEmail');
    expect(JSON.stringify(t)).not.toContain('organizer@example.com');
    expect(t).toMatchObject({ isJunior: true, entryClose: '2026-10-23', url: 'https://clublocker.com/tournaments/19741/info' });
  });
});
