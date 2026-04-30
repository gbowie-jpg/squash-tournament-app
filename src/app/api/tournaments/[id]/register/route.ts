import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendEmail, getEmailTemplateSettings, buildRegistrationHtml } from '@/lib/email';
import { rateLimit, limits } from '@/lib/rateLimit';

/** POST /api/tournaments/[id]/register — public player self-registration. No auth required. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const limited = rateLimit(req, limits.publicSignup, id);
  if (limited) return limited;
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

  // Fetch tournament (include date gate fields)
  const { data: tournament, error: tErr } = await supabase
    .from('tournaments')
    .select('id, status, slug, name, registration_opens, registration_deadline')
    .eq('id', id)
    .single();

  if (tErr || !tournament) {
    return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
  }

  // Status gate
  if (tournament.status === 'completed') {
    return NextResponse.json({ error: 'Registration is closed' }, { status: 400 });
  }

  // Date gates — enforce server-side so direct API calls can't bypass the UI checks
  const now = new Date();
  if (tournament.registration_opens) {
    const opensAt = new Date(tournament.registration_opens + 'T00:00:00');
    if (now < opensAt) {
      return NextResponse.json({ error: 'Registration is not open yet' }, { status: 400 });
    }
  }
  if (tournament.registration_deadline) {
    const deadlineAt = new Date(tournament.registration_deadline + 'T23:59:59');
    if (now > deadlineAt) {
      return NextResponse.json({ error: 'Registration deadline has passed' }, { status: 400 });
    }
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

  // Sync to email_recipients (best-effort)
  await supabase.from('email_recipients').upsert(
    [{ tournament_id: id, name: name.trim(), email: normalizedEmail, type: 'player', tags: ['registered'] }],
    { onConflict: 'tournament_id,email', ignoreDuplicates: true },
  );

  // Send confirmation email with direct link to their player page (best-effort)
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://seattlesquash.com';
  const tournamentUrl = `${siteUrl}/t/${tournament.slug}`;
  const playerPageUrl = `${siteUrl}/t/${tournament.slug}/player/${player.id}`;

  const tmpl = await getEmailTemplateSettings(supabase);
  const html = buildRegistrationHtml({
    playerName: player.name,
    tournamentName: tournament.name,
    tournamentUrl,
    playerPageUrl,
    draw: player.draw,
    club: player.club,
    template: tmpl,
  });

  await sendEmail({
    to: normalizedEmail,
    subject: `You're registered — ${tournament.name}`,
    html,
  });

  return NextResponse.json(player, { status: 201 });
}
