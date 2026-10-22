// League nights are Pacific time; the server runs in UTC.

const TZ = 'America/Los_Angeles';

/** Today's date in Seattle as YYYY-MM-DD. */
export function pacificToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

/** Minutes since midnight in Seattle. */
export function pacificMinutes(now: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return get('hour') * 60 + get('minute');
}

/** Seattle wall-clock '2026-10-20T18:45:26' (no offset) → UTC ISO string. */
export function pacificLocalToIso(local: string): string | null {
  const guess = new Date(`${local.slice(0, 19)}Z`);
  if (Number.isNaN(guess.getTime())) return null;
  const wall = new Intl.DateTimeFormat('sv-SE', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).format(guess);
  const offsetMs = guess.getTime() - new Date(`${wall.replace(' ', 'T')}Z`).getTime();
  return new Date(guess.getTime() + offsetMs).toISOString();
}

/** YYYY-MM-DD shifted by n days (calendar arithmetic, no timezone). */
export function addDays(date: string, n: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** '2026-10-20' → 'Tue, Oct 20'. */
export function formatLeagueDate(date: string, opts: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric' }): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', { ...opts, timeZone: 'UTC' });
}

/** '18:30:00' → '6:30 PM'. */
export function formatLeagueTime(time: string | null): string | null {
  if (!time) return null;
  const [h, m] = time.split(':').map(Number);
  if (!Number.isFinite(h)) return null;
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(m || 0).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

/** '3 min ago' style label for "last updated". */
export function timeAgo(iso: string | null, now: Date = new Date()): string | null {
  if (!iso) return null;
  const mins = Math.round((now.getTime() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hr ago`;
  return `${Math.round(hours / 24)} days ago`;
}
