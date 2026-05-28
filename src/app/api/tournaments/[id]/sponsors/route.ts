import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireTournamentOrganizer } from '@/lib/supabase/require-role';

/** GET — public: list active sponsors for a tournament. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('sponsors')
    .select('*')
    .eq('tournament_id', id)
    .order('tier')
    .order('display_order')
    .order('name');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data || []);
}

const TIERS = new Set(['title', 'court', 'supporting']);

/** POST — organizer: create a sponsor. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireTournamentOrganizer(id);
  if (auth.error) return auth.error;

  const supabase = createAdminClient();
  const body = await req.json();

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const tier = typeof body.tier === 'string' ? body.tier : '';
  if (!name) return NextResponse.json({ error: 'Name required' }, { status: 400 });
  if (!TIERS.has(tier)) return NextResponse.json({ error: 'Invalid tier' }, { status: 400 });

  const record = {
    tournament_id: id,
    name,
    logo_url: body.logo_url || null,
    url: body.url || null,
    tier,
    court_id: tier === 'court' ? (body.court_id || null) : null,
    display_order: typeof body.display_order === 'number' ? body.display_order : 0,
    active: body.active !== false,
  };

  const { data, error } = await supabase.from('sponsors').insert(record).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

/** PATCH — organizer: update a sponsor. */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireTournamentOrganizer(id);
  if (auth.error) return auth.error;

  const supabase = createAdminClient();
  const body = await req.json();
  const { id: sponsorId, ...rest } = body;
  if (!sponsorId) return NextResponse.json({ error: 'Sponsor id required' }, { status: 400 });

  // Whitelist updatable fields
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof rest.name === 'string') updates.name = rest.name.trim();
  if ('logo_url' in rest) updates.logo_url = rest.logo_url || null;
  if ('url' in rest) updates.url = rest.url || null;
  if (typeof rest.tier === 'string' && TIERS.has(rest.tier)) updates.tier = rest.tier;
  if ('court_id' in rest) updates.court_id = rest.court_id || null;
  if (typeof rest.display_order === 'number') updates.display_order = rest.display_order;
  if (typeof rest.active === 'boolean') updates.active = rest.active;

  const { data, error } = await supabase
    .from('sponsors')
    .update(updates)
    .eq('id', sponsorId)
    .eq('tournament_id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

/** DELETE — organizer: remove a sponsor. */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireTournamentOrganizer(id);
  if (auth.error) return auth.error;

  const supabase = createAdminClient();
  const body = await req.json();
  const sponsorId = body.sponsorId;
  if (!sponsorId) return NextResponse.json({ error: 'sponsorId required' }, { status: 400 });

  const { error } = await supabase
    .from('sponsors')
    .delete()
    .eq('id', sponsorId)
    .eq('tournament_id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
