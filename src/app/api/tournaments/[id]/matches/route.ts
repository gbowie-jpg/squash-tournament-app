import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getProgression } from '@/lib/draws/progression';
import { requireAuth } from '@/lib/supabase/auth-check';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('matches')
    .select('*, player1:players!player1_id(*), player2:players!player2_id(*), court:courts!court_id(*), referee:volunteers!referee_id(id, name)')
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
  const auth = await requireAuth();
  if (auth.error) return auth.error;

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
  const auth = await requireAuth();
  if (auth.error) return auth.error;

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

  // Winner progression: advance winner to next round match
  if (updates.status === 'completed' && (updates.winner_id || data.winner_id) && data.match_number && data.draw) {
    const winnerId = updates.winner_id || data.winner_id;
    // Fetch all matches in same draw to find progression target
    const { data: drawMatches } = await supabase
      .from('matches')
      .select('id, match_number, notes')
      .eq('tournament_id', data.tournament_id)
      .eq('draw', data.draw);

    if (drawMatches) {
      const progression = getProgression(
        data.match_number,
        drawMatches.map((m) => m.match_number),
        drawMatches,
      );

      if (progression) {
        const target = drawMatches.find(
          (m) => m.match_number === progression.feedsIntoMatchNumber,
        );
        if (target) {
          await supabase
            .from('matches')
            .update({
              [progression.slot]: winnerId,
              updated_at: new Date().toISOString(),
            })
            .eq('id', target.id);
        }
      }
    }
  }

  return NextResponse.json(data);
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const supabase = createAdminClient();
  const { matchId } = await req.json();

  const { error } = await supabase.from('matches').delete().eq('id', matchId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
