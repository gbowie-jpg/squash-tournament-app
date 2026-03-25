import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('matches')
    .select('*, player1:players!player1_id(*), player2:players!player2_id(*), court:courts!court_id(*)')
    .eq('tournament_id', id)
    .order('sort_order')
    .order('scheduled_time', { nullsFirst: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = createAdminClient();
  const body = await req.json();

  const { data, error } = await supabase
    .from('matches')
    .insert({ ...body, tournament_id: id })
    .select('*, player1:players!player1_id(*), player2:players!player2_id(*), court:courts!court_id(*)')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const supabase = createAdminClient();
  const body = await req.json();
  const { id: matchId, ...updates } = body;

  // Auto-set timestamps based on status changes
  if (updates.status === 'in_progress' && !updates.started_at) {
    updates.started_at = new Date().toISOString();
  }
  if (updates.status === 'completed' && !updates.completed_at) {
    updates.completed_at = new Date().toISOString();
  }

  updates.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from('matches')
    .update(updates)
    .eq('id', matchId)
    .select('*, player1:players!player1_id(*), player2:players!player2_id(*), court:courts!court_id(*)')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // On Deck logic: when a match starts on a court, set the next scheduled match to on_deck
  if (updates.status === 'in_progress' && data.court_id) {
    const { data: nextMatch } = await supabase
      .from('matches')
      .select('id')
      .eq('court_id', data.court_id)
      .eq('status', 'scheduled')
      .order('sort_order')
      .order('scheduled_time', { nullsFirst: false })
      .limit(1)
      .single();

    if (nextMatch) {
      await supabase
        .from('matches')
        .update({ status: 'on_deck', updated_at: new Date().toISOString() })
        .eq('id', nextMatch.id);
    }
  }

  return NextResponse.json(data);
}

export async function DELETE(req: NextRequest) {
  const supabase = createAdminClient();
  const { matchId } = await req.json();

  const { error } = await supabase.from('matches').delete().eq('id', matchId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
