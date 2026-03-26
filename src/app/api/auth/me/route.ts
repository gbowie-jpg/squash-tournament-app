import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAuth } from '@/lib/supabase/auth-check';

/** GET: Return the current user's profile with role and organizer memberships. */
export async function GET() {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const supabase = createAdminClient();

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', auth.user.id)
    .single();

  const { data: organizers } = await supabase
    .from('organizers')
    .select('*, tournament:tournaments(id, name, slug)')
    .eq('user_id', auth.user.id);

  return NextResponse.json({
    ...profile,
    email: auth.user.email,
    organizers: organizers || [],
  });
}
