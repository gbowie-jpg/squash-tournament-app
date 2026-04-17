import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

/** POST /api/tournaments/[id]/register — public player self-registration. No auth required. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = createAdminClient();

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { name, email, phone, draw, club, notes } = body as {
    name?: string;
    email?: string;
    phone?: string;
    draw?: string;
    club?: string;
    notes?: string;
  };

  // Validate required fields
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  }
  if (!email || typeof email !== 'string' || email.trim().length === 0) {
    return NextResponse.json({ error: 'Email is required' }, { status: 400 });
  }
  if (!email.includes('@')) {
    return NextResponse.json({ error: 'A valid email address is required' }, { status: 400 });
  }

  // Fetch tournament
  const { data: tournament, error: tErr } = await supabase
    .from('tournaments')
    .select('id, status')
    .eq('id', id)
    .single();

  if (tErr || !tournament) {
    return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
  }
  if (tournament.status === 'completed') {
    return NextResponse.json({ error: 'Registration is closed' }, { status: 400 });
  }

  const normalizedEmail = email.trim().toLowerCase();

  // Check for duplicate registration
  const { data: existing } = await supabase
    .from('players')
    .select('id')
    .eq('tournament_id', id)
    .eq('email', normalizedEmail)
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      { error: 'This email is already registered for this tournament' },
      { status: 409 },
    );
  }

  // Insert player
  const { data: player, error: insertErr } = await supabase
    .from('players')
    .insert({
      tournament_id: id,
      name: name.trim(),
      email: normalizedEmail,
      phone: phone?.trim() || null,
      draw: draw?.trim() || null,
      club: club?.trim() || null,
    })
    .select()
    .single();

  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  // Sync to email_recipients (best-effort, ignore errors)
  await supabase.from('email_recipients').upsert(
    [
      {
        tournament_id: id,
        name: name.trim(),
        email: normalizedEmail,
        type: 'player',
        tags: ['registered'],
      },
    ],
    { onConflict: 'tournament_id,email', ignoreDuplicates: true },
  );

  return NextResponse.json(player, { status: 201 });
}
