import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/supabase/require-role';
import { inviteTokenMatches } from '@/lib/invite-token';
import { syncLeague, type SyncMode } from '@/lib/league/sync';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// POST /api/league/sync[?mode=auto|full|live]
//
// Called every 5 minutes by pg_cron (supabase/league-cron.sql) with
// `Authorization: Bearer <LEAGUE_SYNC_SECRET>`; mode=auto decides whether a
// full sync, a live sync or nothing is due. Admins can also call it from the
// browser (session cookie) to force a sync.
export async function POST(req: NextRequest) {
  const secret = process.env.LEAGUE_SYNC_SECRET;
  const bearer = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  const viaCron = !!bearer && inviteTokenMatches(bearer, secret);

  if (!viaCron) {
    const auth = await requireRole('admin');
    if (auth.error) return auth.error;
  }

  const raw = req.nextUrl.searchParams.get('mode') ?? 'auto';
  if (!['auto', 'full', 'live'].includes(raw)) {
    return NextResponse.json({ error: 'mode must be auto, full or live' }, { status: 400 });
  }

  try {
    const result = await syncLeague({ mode: raw as SyncMode | 'auto' });
    if (result.errors.length) console.warn('[league-sync] partial failure:', result.errors);
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    console.error('[league-sync] failed:', (e as Error).message);
    return NextResponse.json({ error: 'Sync failed' }, { status: 502, headers: { 'Cache-Control': 'no-store' } });
  }
}
