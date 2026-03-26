import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAuth } from '@/lib/supabase/auth-check';

/** GET: List all volunteers for a tournament (public). */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('volunteers')
    .select('*')
    .eq('tournament_id', id)
    .order('role')
    .order('name');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

/** POST: Sign up as a volunteer (public, no auth required). */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = createAdminClient();
  const body = await req.json();

  const { name, email, phone, role, notes } = body;
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  }

  const validRoles = ['referee', 'volunteer', 'helper'];
  const safeRole = validRoles.includes(role) ? role : 'volunteer';

  const { data, error } = await supabase
    .from('volunteers')
    .insert({
      tournament_id: id,
      name: name.trim(),
      email: email?.trim() || null,
      phone: phone?.trim() || null,
      role: safeRole,
      notes: notes?.trim() || null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

/** DELETE: Remove a volunteer (auth required). */
export async function DELETE(req: NextRequest) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const supabase = createAdminClient();
  const { volunteerId } = await req.json();

  if (!volunteerId) return NextResponse.json({ error: 'volunteerId required' }, { status: 400 });

  // Clear referee_id from any matches assigned to this volunteer
  await supabase
    .from('matches')
    .update({ referee_id: null, updated_at: new Date().toISOString() })
    .eq('referee_id', volunteerId);

  const { error } = await supabase.from('volunteers').delete().eq('id', volunteerId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
