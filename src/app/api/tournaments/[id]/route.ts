import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireTournamentOrganizer } from '@/lib/supabase/require-role';

// GET single tournament (public)
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('tournaments')
    .select('*')
    .eq('id', id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 404 });
  return NextResponse.json(data);
}

// Allowed fields for tournament updates
const TOURNAMENT_FIELDS = [
  'name', 'slug', 'start_date', 'end_date', 'status', 'venue', 'address',
  'location_city', 'court_count', 'category', 'description',
  'image_url', 'hero_image_url', 'hero_gradient', 'hero_text_color', 'hero_overlay',
  'contact_name', 'contact_email', 'contact_phone',
  'registration_opens', 'registration_deadline', 'draw_lock_date', 'entry_close_date',
  'info_latest', 'info_accommodations', 'info_entry', 'info_rules',
] as const;

// PATCH update tournament (organizer only)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireTournamentOrganizer(id);
  if (auth.error) return auth.error;

  const supabase = createAdminClient();
  const body = await req.json();

  // Whitelist allowed fields
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const key of TOURNAMENT_FIELDS) {
    if (key in body) updates[key] = body[key] === '' ? null : body[key];
  }

  const { data, error } = await supabase
    .from('tournaments')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// DELETE tournament (organizer only)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireTournamentOrganizer(id);
  if (auth.error) return auth.error;

  const supabase = createAdminClient();
  const { error } = await supabase.from('tournaments').delete().eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
