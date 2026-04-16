import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireRole } from '@/lib/supabase/require-role';

// GET all tournaments (public)
export async function GET() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('tournaments')
    .select('*')
    .order('start_date', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST create tournament (admin only)
export async function POST(req: NextRequest) {
  const auth = await requireRole('admin');
  if (auth.error) return auth.error;

  const supabase = createAdminClient();
  const body = await req.json();

  // Validate required fields
  if (!body.name || typeof body.name !== 'string' || body.name.trim().length === 0) {
    return NextResponse.json({ error: 'Tournament name is required' }, { status: 400 });
  }
  if (!body.start_date) {
    return NextResponse.json({ error: 'Start date is required' }, { status: 400 });
  }

  // Whitelist fields
  const insert: Record<string, unknown> = {
    name: body.name.trim(),
    slug: body.slug || body.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    start_date: body.start_date,
  };
  const optional = [
    'end_date', 'venue', 'address', 'location_city', 'court_count',
    'category', 'description', 'status',
  ];
  for (const key of optional) {
    if (body[key] !== undefined) insert[key] = body[key] === '' ? null : body[key];
  }

  const { data, error } = await supabase
    .from('tournaments')
    .insert(insert)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Auto-create courts based on court_count
  if (body.court_count && body.court_count > 0) {
    const courts = Array.from({ length: body.court_count }, (_, i) => ({
      tournament_id: data.id,
      name: `Court ${i + 1}`,
      sort_order: i,
    }));
    await supabase.from('courts').insert(courts);
  }

  // Auto-add creator as organizer
  await supabase.from('organizers').insert({
    tournament_id: data.id,
    user_id: auth.user.id,
    role: 'admin',
  });

  return NextResponse.json(data, { status: 201 });
}
