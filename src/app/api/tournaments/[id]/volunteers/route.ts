import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireTournamentOrganizer } from '@/lib/supabase/require-role';
import { rateLimit, limits } from '@/lib/rateLimit';

/** GET: List all volunteers (incl. contact details) for a tournament — organizer only. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireTournamentOrganizer(id);
  if (auth.error) return auth.error;

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

/**
 * POST: Public volunteer / referee signup.
 * Records the signup only — it does NOT create an account. Accounts are
 * invite-only (/join/[token]); referees who need to score get the invite link.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  // Fixed bucket (IP only) so varying the tournament id in the path can't reset the limit
  const limited = rateLimit(req, { ...limits.publicSignup, bucket: 'volunteer-signup' });
  if (limited) return limited;

  let body: Record<string, unknown>;
  try {
    const parsed = await req.json();
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error();
    body = parsed as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const { name, email, phone, role, notes } = body;
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  }
  if (!email || typeof email !== 'string' || email.trim().length === 0) {
    return NextResponse.json({ error: 'Email is required' }, { status: 400 });
  }
  if (!email.includes('@')) {
    return NextResponse.json({ error: 'A valid email address is required' }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Tournament must exist and not be over
  const { data: tournament } = await supabase
    .from('tournaments')
    .select('id, status')
    .eq('id', id)
    .maybeSingle();
  if (!tournament) {
    return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
  }
  if (tournament.status === 'completed') {
    return NextResponse.json({ error: 'This tournament has finished — volunteer signup is closed' }, { status: 400 });
  }

  const validRoles = ['referee', 'volunteer', 'helper'];
  const safeRole = typeof role === 'string' && validRoles.includes(role) ? role : 'volunteer';
  const normalizedEmail = email.trim().toLowerCase();

  const { data, error } = await supabase
    .from('volunteers')
    .insert({
      tournament_id: id,
      name: name.trim(),
      email: normalizedEmail,
      phone: typeof phone === 'string' ? phone.trim() || null : null,
      role: safeRole,
      notes: typeof notes === 'string' ? notes.trim() || null : null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Auto-sync volunteer into email_recipients
  await supabase.from('email_recipients').upsert(
    [{ tournament_id: id, name: name.trim(), email: normalizedEmail, type: 'volunteer' }],
    { onConflict: 'tournament_id,email', ignoreDuplicates: true },
  );

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
