import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAuth } from '@/lib/supabase/auth-check';

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

// POST create tournament (auth required)
export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const supabase = createAdminClient();
  const body = await req.json();

  const { data, error } = await supabase
    .from('tournaments')
    .insert(body)
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
