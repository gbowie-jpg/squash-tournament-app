import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getStripe } from '@/lib/stripe';
import { sendEmail, getEmailTemplateSettings } from '@/lib/email';

/**
 * POST /api/webhooks/stripe
 * Handles Stripe webhook events.
 * Must be added to your Stripe dashboard: https://dashboard.stripe.com/webhooks
 * Event to listen for: checkout.session.completed
 */
export async function POST(req: NextRequest) {
  const stripe = await getStripe();
  if (!stripe) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 503 });
  }

  const supabase = createAdminClient();
  const { data: whSecretRow } = await supabase
    .from('site_settings')
    .select('value')
    .eq('key', 'stripe_webhook_secret')
    .maybeSingle();

  const webhookSecret = whSecretRow?.value;
  if (!webhookSecret) {
    console.error('[stripe webhook] stripe_webhook_secret not configured');
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 503 });
  }

  const sig = req.headers.get('stripe-signature');
  if (!sig) return NextResponse.json({ error: 'Missing signature' }, { status: 400 });

  let event;
  try {
    const body = await req.text();
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    console.error('[stripe webhook] signature verification failed:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const { tournament_id, player_id, tournament_slug } = session.metadata ?? {};

    if (!tournament_id || !player_id) {
      console.error('[stripe webhook] Missing metadata on session:', session.id);
      return NextResponse.json({ ok: true }); // Acknowledge but skip
    }

    // Mark player as paid
    const { data: player } = await supabase
      .from('players')
      .update({ payment_status: 'paid' })
      .eq('id', player_id)
      .eq('tournament_id', tournament_id)
      .select()
      .single();

    if (!player) {
      console.error('[stripe webhook] Player not found:', player_id);
      return NextResponse.json({ ok: true });
    }

    // Sync to email_recipients
    await supabase.from('email_recipients').upsert(
      [{ tournament_id, name: player.name, email: player.email, type: 'player', tags: ['registered', 'paid'] }],
      { onConflict: 'tournament_id,email', ignoreDuplicates: true },
    );

    // Fetch tournament for email
    const { data: tournament } = await supabase
      .from('tournaments')
      .select('name, slug')
      .eq('id', tournament_id)
      .single();

    if (tournament) {
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://app.seattlesquash.com';
      const tournamentUrl = `${siteUrl}/t/${tournament_slug || tournament.slug}`;
      const playerPageUrl = `${siteUrl}/t/${tournament_slug || tournament.slug}/player/${player.id}`;
      const tmpl = await getEmailTemplateSettings(supabase);
      const amountPaid = session.amount_total
        ? `$${(session.amount_total / 100).toFixed(2)}`
        : null;

      const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:40px 20px;">
    <div style="background:${tmpl.headerBg || '#1a2332'};border-radius:12px 12px 0 0;padding:24px 32px;text-align:center;">
      <h1 style="color:white;margin:0;font-size:20px;">${tmpl.heading || tournament.name}</h1>
      <p style="color:rgba(255,255,255,0.65);margin:4px 0 0;font-size:13px;">Registration Confirmed ✓</p>
    </div>
    <div style="background:white;padding:32px;border-radius:0 0 12px 12px;">
      <p style="margin:0 0 16px 0;">Hi ${player.name},</p>
      <p style="margin:0 0 16px 0;">Your registration and payment for <strong>${tournament.name}</strong> are confirmed.</p>
      <div style="background:#f4f4f5;border-radius:8px;padding:16px;margin:0 0 24px 0;">
        <p style="margin:0 0 8px 0;"><strong>Name:</strong> ${player.name}</p>
        ${player.draw ? `<p style="margin:0 0 8px 0;"><strong>Division:</strong> ${player.draw}</p>` : ''}
        ${player.club ? `<p style="margin:0 0 8px 0;"><strong>Club:</strong> ${player.club}</p>` : ''}
        ${amountPaid ? `<p style="margin:0;"><strong>Entry fee paid:</strong> ${amountPaid}</p>` : ''}
      </div>
      <div style="text-align:center;margin:0 0 24px 0;">
        <a href="${tournamentUrl}" style="display:inline-block;background:#18181b;color:white;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;">
          View Tournament →
        </a>
      </div>
      <p style="margin:0 0 4px 0;font-size:13px;color:#71717a;">Your personal player page:</p>
      <p style="margin:0;font-size:13px;"><a href="${playerPageUrl}" style="color:#3b82f6;">${playerPageUrl}</a></p>
    </div>
    <div style="text-align:center;padding:24px 0;color:#71717a;font-size:12px;">
      <p>${tmpl.footerText || 'Seattle Squash Racquets Association'}</p>
    </div>
  </div>
</body></html>`;

      await sendEmail({
        to: player.email,
        subject: `Payment confirmed — ${tournament.name}`,
        html,
      });
    }
  }

  if (event.type === 'checkout.session.expired') {
    const session = event.data.object;
    const { player_id, tournament_id } = session.metadata ?? {};
    if (player_id && tournament_id) {
      // Clean up the pending player record so they can re-register
      await supabase
        .from('players')
        .delete()
        .eq('id', player_id)
        .eq('tournament_id', tournament_id)
        .eq('payment_status', 'pending');
    }
  }

  return NextResponse.json({ ok: true });
}
