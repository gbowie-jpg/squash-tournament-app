import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { safeRelativePath } from '@/lib/safe-redirect';
import { authErrorCodeFor } from '@/lib/auth-errors';

/**
 * GET /auth/callback
 *
 * Supabase redirects here after a user clicks the confirmation link in their email.
 * We exchange the one-time code for a session, then redirect the user into the app.
 * If anything goes wrong we send them to /login?error=<code> (codes only — see
 * src/lib/auth-errors.ts; /login maps them to fixed messages).
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  // Only same-origin relative paths — prevents open redirects via ?next=
  const next = safeRelativePath(searchParams.get('next'), '/');

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=invalid_link`);
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(`${origin}/login?error=${authErrorCodeFor(error.code)}`);
  }

  // Signed in — check their role and send them to the right place
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(`${origin}/login?error=confirm_failed`);
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle() as { data: { role: string } | null };

  const role = profile?.role;
  const dest = next !== '/'
    ? next
    : role === 'admin' || role === 'superadmin'
    ? '/admin'
    : '/';

  return NextResponse.redirect(new URL(dest, origin));
}
