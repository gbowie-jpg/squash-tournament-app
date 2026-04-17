import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendEmail, getEmailTemplateSettings } from '@/lib/email';

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
    .select('id, status, slug, name')
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
  const drawLine = player.draw ? `<p style="margin:0 0 8px 0;"><strong>Division:</strong> ${player.draw}</p>` : '';
  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:40px 20px;">
    <div style="background:${tmpl.headerBg || '#1a2332'};border-radius:12px 12px 0 0;padding:24px 32px;text-align:center;">
      <h1 style="color:white;margin:0;font-size:20px;">${tmpl.heading || tournament.name}</h1>
      <p style="color:rgba(255,255,255,0.65);margin:4px 0 0;font-size:13px;">Registration Confirmed</p>
    </div>
    <div style="background:white;padding:32px;border-radius:0 0 12px 12px;">
      <p style="margin:0 0 16px 0;">Hi ${player.name},</p>
      <p style="margin:0 0 16px 0;">You're registered for <strong>${tournament.name}</strong>. Here are your details:</p>
      <div style="background:#f4f4f5;border-radius:8px;padding:16px;margin:0 0 24px 0;">
        <p style="margin:0 0 8px 0;"><strong>Name:</strong> ${player.name}</p>
        ${drawLine}
        ${player.club ? `<p style="margin:0 0 8px 0;"><strong>Club:</strong> ${player.club}</p>` : ''}
      </div>
      <p style="margin:0 0 16px 0;">Visit the tournament page for draws, schedule, and results:</p>
      <div style="text-align:center;margin:0 0 24px 0;">
        <a href="${tournamentUrl}" style="display:inline-block;background:#18181b;color:white;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;">
          View Tournament →
        </a>
      </div>
      <p style="margin:0 0 4px 0;font-size:13px;color:#71717a;">Your personal player page (bookmark this to track your matches):</p>
      <p style="margin:0;font-size:13px;"><a href="${playerPageUrl}" style="color:#3b82f6;">${playerPageUrl}</a></p>
    </div>
    <div style="text-align:center;padding:24px 0;color:#71717a;font-size:12px;">
      <p>${tmpl.footerText || 'Seattle Squash Racquets Association'}</p>
    </div>
  </div>
</body></html>`;

  await sendEmail({
    to: normalizedEmail,
    subject: `You're registered — ${tournament.name}`,
    html,
  });

  return NextResponse.json(player, { status: 201 });
}
