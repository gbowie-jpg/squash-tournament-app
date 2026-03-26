import { NextResponse } from 'next/server';
import { createAdminClient } from './admin';
import { requireAuth } from './auth-check';

/**
 * Require the authenticated user to have a specific global role.
 */
export async function requireRole(role: 'admin' | 'superadmin') {
  const auth = await requireAuth();
  if (auth.error) return auth;

  const supabase = createAdminClient();
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', auth.user.id)
    .single();

  const userRole = profile?.role || 'user';

  // superadmin has all permissions
  if (userRole === 'superadmin') return auth;
  // admin role check
  if (role === 'admin' && (userRole === 'admin' || userRole === 'superadmin')) return auth;

  return {
    error: NextResponse.json(
      { error: 'Forbidden: insufficient permissions' },
      { status: 403 },
    ),
  } as { error: NextResponse; user?: never };
}

/**
 * Require the authenticated user to be an organizer for a specific tournament.
 */
export async function requireTournamentOrganizer(tournamentId: string) {
  const auth = await requireAuth();
  if (auth.error) return auth;

  const supabase = createAdminClient();

  // Superadmins can manage any tournament
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', auth.user.id)
    .single();

  if (profile?.role === 'superadmin') return auth;

  // Check organizer table
  const { data: organizer } = await supabase
    .from('organizers')
    .select('role')
    .eq('tournament_id', tournamentId)
    .eq('user_id', auth.user.id)
    .single();

  if (!organizer) {
    return {
      error: NextResponse.json(
        { error: 'Forbidden: not an organizer for this tournament' },
        { status: 403 },
      ),
    } as { error: NextResponse; user?: never };
  }

  return { ...auth, organizerRole: organizer.role as 'admin' | 'scorer' };
}
