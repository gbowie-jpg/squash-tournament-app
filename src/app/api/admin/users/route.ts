import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireRole } from '@/lib/supabase/require-role';

/** GET: List all users with their profiles and organizer memberships. Superadmin only. */
export async function GET() {
  const auth = await requireRole('superadmin');
  if (auth.error) return auth.error;

  const supabase = createAdminClient();

  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Get organizer memberships for each user
  const { data: organizers } = await supabase
    .from('organizers')
    .select('*, tournament:tournaments(id, name, slug)');

  // Merge
  const users = (profiles || []).map((p) => ({
    ...p,
    organizers: (organizers || []).filter((o) => o.user_id === p.id),
  }));

  return NextResponse.json(users);
}

/** PATCH: Update a user's global role. Superadmin only. */
export async function PATCH(req: NextRequest) {
  const auth = await requireRole('superadmin');
  if (auth.error) return auth.error;

  const supabase = createAdminClient();
  const { userId, role, full_name } = await req.json();

  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 });

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (role && ['user', 'admin', 'superadmin'].includes(role)) updates.role = role;
  if (full_name !== undefined) updates.full_name = full_name;

  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
