import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/supabase/require-role';
import { getVapidStatus } from '@/lib/push';

export const dynamic = 'force-dynamic';

/**
 * Admin-only VAPID diagnostic for /admin/settings. Uses the same check as the
 * send path, so the two can't disagree. Returns only ok / reason and the
 * 12-hex sha256 fingerprint of the public key, never key values.
 */
export async function GET() {
  const auth = await requireRole('admin');
  if (auth.error) return auth.error;
  return NextResponse.json(getVapidStatus(), { headers: { 'Cache-Control': 'no-store' } });
}
