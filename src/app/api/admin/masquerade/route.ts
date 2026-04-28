import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAuth } from '@/lib/supabase/auth-check';

/**
 * POST /api/admin/masquerade
 * Body: { userId: string }
 *
 * Generates a one-time magic link that signs into the target user's account.
 * Requires admin or superadmin role.
 * Returns: { magicLink, name, email }
 */
export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const supabase = createAdminClient();

  // Verify caller is admin or superadmin
  const { data: callerProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', auth.user.id)
    .single();

  const callerRole = callerProfile?.role;
  if (!callerRole || !['admin', 'superadmin'].includes(callerRole)) {
    return NextResponse.json({ error: 'Admin role required' }, { status: 403 });
  }

  const body = await req.json();
  const { userId } = body;
  if (!userId || typeof userId !== 'string') {
    return NextResponse.json({ error: 'userId required' }, { status: 400 });
  }

  // Prevent masquerading as yourself
  if (userId === auth.user.id) {
    return NextResponse.json({ error: 'Cannot masquerade as yourself' }, { status: 400 });
  }

  // Get target user's profile to check their role before generating the link
  const { data: targetProfile } = await supabase
    .from('profiles')
    .select('full_name, role')
    .eq('id', userId)
    .single();

  // Role hierarchy: superadmin > admin > user.
  // An admin cannot masquerade as a superadmin (privilege escalation).
  const roleRank: Record<string, number> = { user: 0, admin: 1, superadmin: 2 };
  const callerRank = roleRank[callerRole] ?? 0;
  const targetRank = roleRank[targetProfile?.role ?? 'user'] ?? 0;
  if (targetRank >= callerRank) {
    return NextResponse.json(
      { error: 'Cannot masquerade as a user with equal or higher privileges' },
      { status: 403 },
    );
  }

  // Get target user from Supabase Auth
  const { data: targetAuth, error: authErr } = await supabase.auth.admin.getUserById(userId);
  if (authErr || !targetAuth.user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const email = targetAuth.user.email;
  if (!email) {
    return NextResponse.json({ error: 'Target user has no email address' }, { status: 400 });
  }

  const name = targetProfile?.full_name || email;


  // Build the redirect URL — go back to homepage after sign-in
  const origin = req.headers.get('origin') ?? req.headers.get('x-forwarded-host')
    ? `https://${req.headers.get('x-forwarded-host')}`
    : 'http://localhost:3000';

  // Generate a one-time magic link for the target user
  const { data: linkData, error: linkErr } = await supabase.auth.admin.generateLink({
    type: 'magiclink',
    email,
    options: {
      redirectTo: `${origin}/`,
    },
  });

  if (linkErr || !linkData?.properties?.action_link) {
    console.error('[masquerade] generateLink error:', linkErr);
    return NextResponse.json(
      { error: linkErr?.message || 'Failed to generate login link' },
      { status: 500 },
    );
  }

  return NextResponse.json({
    magicLink: linkData.properties.action_link,
    email,
    name,
  });
}
