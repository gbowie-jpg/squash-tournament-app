import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireTournamentOrganizer } from '@/lib/supabase/require-role';
import { rateLimit, limits } from '@/lib/rateLimit';

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

  const limited = rateLimit(req, limits.publicSignup, id);
  if (limited) return limited;

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
  const normalizedEmail = email.trim().toLowerCase();

  // Attempt to create an auth account. If the email already exists, Supabase
  // returns an error — we treat that silently so we never reveal whether an
  // email is registered (fixes email enumeration + removes the O(n) listUsers call).
  if (password && typeof password === 'string' && password.length >= 6) {
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: normalizedEmail,
      password,
      email_confirm: true,
      user_metadata: { full_name: name.trim() },
    });

    // Only create profile for genuinely new accounts; ignore "already exists" silently
    if (!authError && authData?.user) {
      await supabase
        .from('profiles')
        .upsert({
          id: authData.user.id,
          email: normalizedEmail,
          full_name: name.trim(),
          role: 'user',
        }, { onConflict: 'id' });
    }
  }

  // Create volunteer record (no auth dependency — signup works with or without an account)
  const { data, error } = await supabase
    .from('volunteers')
    .insert({
      tournament_id: id,
      name: name.trim(),
      email: normalizedEmail,
      phone: phone?.trim() || null,
      role: safeRole,
      notes: notes?.trim() || null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Auto-sync volunteer into email_recipients
  await supabase.from('email_recipients').upsert(
    [{ tournament_id: id, name: name.trim(), email: normalizedEmail, type: 'volunteer' }],
    { onConflict: 'tournament_id,email', ignoreDuplicates: true },
  );

  // Never reveal whether an account was created or already existed
  return NextResponse.json({ ok: true, id: data.id }, { status: 201 });
}

/** DELETE: Remove a volunteer (organizer only). */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireTournamentOrganizer(id);
  if (auth.error) return auth.error;

  const supabase = createAdminClient();
  const { volunteerId } = await req.json();

  if (!volunteerId) return NextResponse.json({ error: 'volunteerId required' }, { status: 400 });

  // Clear referee_id from any matches assigned to this volunteer
  await supabase
    .from('matches')
    .update({ referee_id: null, updated_at: new Date().toISOString() })
    .eq('referee_id', volunteerId);

  // Scope deletion to this tournament — prevents cross-tournament deletion by guessing UUIDs
  const { error } = await supabase
    .from('volunteers')
    .delete()
    .eq('id', volunteerId)
    .eq('tournament_id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
