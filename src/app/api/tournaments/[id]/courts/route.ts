import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireTournamentOrganizer } from '@/lib/supabase/require-role';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('courts')
    .select('*')
    .eq('tournament_id', id)
    .order('sort_order');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

const COURT_FIELDS = ['name', 'sort_order', 'status'] as const;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireTournamentOrganizer(id);
  if (auth.error) return auth.error;

  const supabase = createAdminClient();
  const body = await req.json();

  if (!body.name || typeof body.name !== 'string' || body.name.trim().length === 0) {
    return NextResponse.json({ error: 'Court name is required' }, { status: 400 });
  }

  const insert: Record<string, unknown> = { tournament_id: id, name: body.name.trim() };
  if (typeof body.sort_order === 'number') insert.sort_order = body.sort_order;
  if (body.status && ['available', 'in_use', 'maintenance'].includes(body.status)) {
    insert.status = body.status;
  }

  const { data, error } = await supabase
    .from('courts')
    .insert(insert)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireTournamentOrganizer(id);
  if (auth.error) return auth.error;

  const supabase = createAdminClient();
  const body = await req.json();
  const courtId = body.id;

  if (!courtId) return NextResponse.json({ error: 'Court id required' }, { status: 400 });

  // Whitelist fields
  const updates: Record<string, unknown> = {};
  if (typeof body.name === 'string' && body.name.trim()) updates.name = body.name.trim();
  if (typeof body.sort_order === 'number') updates.sort_order = body.sort_order;
  if (body.status && ['available', 'in_use', 'maintenance'].includes(body.status)) {
    updates.status = body.status;
  }

  const { data, error } = await supabase
    .from('courts')
    .update(updates)
    .eq('id', courtId)
    .eq('tournament_id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireTournamentOrganizer(id);
  if (auth.error) return auth.error;

  const supabase = createAdminClient();
  const { courtId } = await req.json();

  if (!courtId) return NextResponse.json({ error: 'courtId required' }, { status: 400 });

  // Check for matches assigned to this court
  const { data: assignedMatches } = await supabase
    .from('matches')
    .select('id')
    .eq('court_id', courtId)
    .in('status', ['scheduled', 'on_deck', 'in_progress'])
    .limit(1);

  if (assignedMatches && assignedMatches.length > 0) {
    return NextResponse.json(
      { error: 'Cannot delete: court has assigned matches. Reassign them first.' },
      { status: 409 },
    );
  }

  const { error } = await supabase.from('courts').delete().eq('id', courtId).eq('tournament_id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
