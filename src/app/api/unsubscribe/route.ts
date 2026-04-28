import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * GET /api/unsubscribe?token=<uuid>
 * Public — no auth required.
 * Sets subscribed = false on the matching recipient row (tournament or global).
 * Redirects to /unsubscribe?status=ok or ?status=notfound.
 */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://app.seattlesquash.com';

  if (!token || !/^[0-9a-f-]{36}$/.test(token)) {
    return NextResponse.redirect(new URL('/unsubscribe?status=invalid', siteUrl));
  }

  const supabase = createAdminClient();

  // Try tournament recipients first
  const { data: tournamentRow, error: tErr } = await supabase
    .from('email_recipients')
    .update({ subscribed: false })
    .eq('unsubscribe_token', token)
    .select('id')
    .maybeSingle();

  if (!tErr && tournamentRow) {
    return NextResponse.redirect(new URL('/unsubscribe?status=ok', siteUrl));
  }

  // Try global recipients
  const { data: globalRow, error: gErr } = await supabase
    .from('global_email_recipients')
    .update({ subscribed: false })
    .eq('unsubscribe_token', token)
    .select('id')
    .maybeSingle();

  if (!gErr && globalRow) {
    return NextResponse.redirect(new URL('/unsubscribe?status=ok', siteUrl));
  }

  return NextResponse.redirect(new URL('/unsubscribe?status=notfound', siteUrl));
}
