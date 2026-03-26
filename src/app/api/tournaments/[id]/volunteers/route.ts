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

/** POST: Sign up as a volunteer + create auth account. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = createAdminClient();
  const body = await req.json();

  const { name, email, phone, role, notes, password } = body;
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  }
  if (!email || typeof email !== 'string' || email.trim().length === 0) {
    return NextResponse.json({ error: 'Email is required' }, { status: 400 });
  }
  if (!password || typeof password !== 'string' || password.length < 6) {
    return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
  }

  const validRoles = ['referee', 'volunteer', 'helper'];
  const safeRole = validRoles.includes(role) ? role : 'volunteer';

  // Check if email already has an account
  const { data: existingUsers } = await supabase.auth.admin.listUsers();
  const existing = existingUsers?.users?.find(
    (u) => u.email?.toLowerCase() === email.trim().toLowerCase(),
  );

  let userId: string;

  if (existing) {
    // User already has an account — just create the volunteer record
    userId = existing.id;
  } else {
    // Create auth user (auto-confirmed, no email verification needed)
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: email.trim(),
      password,
      email_confirm: true,
      user_metadata: { full_name: name.trim() },
    });

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 });
    }
    userId = authData.user.id;

    // Create profile (the trigger may handle this, but ensure it exists)
    await supabase
      .from('profiles')
      .upsert({
        id: userId,
        email: email.trim(),
        full_name: name.trim(),
        role: 'user',
      }, { onConflict: 'id' });
  }

  // Create volunteer record
  const { data, error } = await supabase
    .from('volunteers')
    .insert({
      tournament_id: id,
      name: name.trim(),
      email: email.trim(),
      phone: phone?.trim() || null,
      role: safeRole,
      notes: notes?.trim() || null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ...data, accountCreated: !existing }, { status: 201 });
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
