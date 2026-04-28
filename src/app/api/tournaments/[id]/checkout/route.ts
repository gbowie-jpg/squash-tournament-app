import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getStripe } from '@/lib/stripe';
import { rateLimit, limits } from '@/lib/rateLimit';

/**
 * POST /api/tournaments/[id]/checkout
 * Creates a Stripe Checkout Session for tournament registration.
 * The player record is inserted immediately with payment_status='pending'.
 * The webhook updates it to 'paid' on successful payment.
 */
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

  const { name, email, phone, draw, club, notes } = body as Record<string, string | undefined>;

  if (!name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  if (!email?.trim() || !email.includes('@')) {
    return NextResponse.json({ error: 'A valid email address is required' }, { status: 400 });
  }

  // Fetch tournament
  const { data: tournament } = await supabase
    .from('tournaments')
    .select('id, status, slug, name, entry_fee, registration_opens, registration_deadline')
    .eq('id', id)
    .single();

  if (!tournament) return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
  if (tournament.status === 'completed') {
    return NextResponse.json({ error: 'Registration is closed' }, { status: 400 });
  }

  // Date gates
  const now = new Date();
  if (tournament.registration_opens) {
    if (now < new Date(tournament.registration_opens + 'T00:00:00')) {
      return NextResponse.json({ error: 'Registration is not open yet' }, { status: 400 });
    }
  }
  if (tournament.registration_deadline) {
    if (now > new Date(tournament.registration_deadline + 'T23:59:59')) {
      return NextResponse.json({ error: 'Registration deadline has passed' }, { status: 400 });
    }
  }

  const normalizedEmail = email.trim().toLowerCase();

  // Duplicate check
  const { data: existing } = await supabase
    .from('players')
    .select('id, payment_status')
    .eq('tournament_id', id)
    .eq('email', normalizedEmail)
    .maybeSingle();

  if (existing && existing.payment_status === 'paid') {
    return NextResponse.json(
      { error: 'This email is already registered for this tournament' },
      { status: 409 },
    );
  }

  // If no entry fee, just register directly (no payment needed)
  const entryFee = tournament.entry_fee ?? 0;
  if (entryFee === 0) {
    return NextResponse.json(
      { error: 'This tournament has no entry fee — use the standard registration endpoint' },
      { status: 400 },
    );
  }

  const stripe = await getStripe();
  if (!stripe) {
    return NextResponse.json(
      { error: 'Payment processing is not configured. Contact the organizer.' },
      { status: 503 },
    );
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://app.seattlesquash.com';

  // Create or reuse a pending player record
  let playerId: string;
  if (existing) {
    playerId = existing.id;
    await supabase.from('players').update({
      name: name.trim(),
      phone: phone?.trim() || null,
      draw: draw?.trim() || null,
      club: club?.trim() || null,
    }).eq('id', playerId);
  } else {
    const { data: player, error: insertErr } = await supabase
      .from('players')
      .insert({
        tournament_id: id,
        name: name.trim(),
        email: normalizedEmail,
        phone: phone?.trim() || null,
        draw: draw?.trim() || null,
        club: club?.trim() || null,
        payment_status: 'pending',
      })
      .select('id')
      .single();

    if (insertErr || !player) {
      return NextResponse.json({ error: insertErr?.message || 'Failed to create player' }, { status: 500 });
    }
    playerId = player.id;
  }

  // Create Stripe Checkout Session
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    mode: 'payment',
    customer_email: normalizedEmail,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: 'usd',
          unit_amount: entryFee, // already in cents
          product_data: {
            name: `${tournament.name} — Entry Fee`,
            description: draw?.trim() ? `Division: ${draw.trim()}` : undefined,
          },
        },
      },
    ],
    metadata: {
      tournament_id: id,
      player_id: playerId,
      tournament_slug: tournament.slug,
    },
    success_url: `${siteUrl}/t/${tournament.slug}/register/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${siteUrl}/t/${tournament.slug}/register?cancelled=1`,
  });

  // Store session ID on the player record
  await supabase
    .from('players')
    .update({ stripe_session_id: session.id, payment_status: 'pending' })
    .eq('id', playerId);

  return NextResponse.json({ url: session.url });
}
