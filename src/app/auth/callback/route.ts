import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

/**
 * GET /auth/callback
 *
 * Supabase redirects here after a user clicks the confirmation link in their email.
 * We exchange the one-time code for a session, then redirect the user into the app.
 * If anything goes wrong we send them to /login with an error query param.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/';

  if (code) {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Signed in — check their role and send them to the right place
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
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

        return NextResponse.redirect(`${origin}${dest}`);
      }
    }
  }

  return NextResponse.redirect(`${origin}/login?error=Email+confirmation+failed.+Try+signing+in+again.`);
}
