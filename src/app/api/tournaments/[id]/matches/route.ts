import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getProgression } from '@/lib/draws/progression';
import { requireTournamentOrganizer } from '@/lib/supabase/require-role';

const MATCH_SELECT = '*, player1:players!player1_id(*), player2:players!player2_id(*), court:courts!court_id(*), referee:volunteers!referee_id(id, name)';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('matches')
    .select(MATCH_SELECT)
    .eq('tournament_id', id)
    .order('sort_order')
    .order('scheduled_time', { nullsFirst: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// Allowed fields for match creation
const MATCH_CREATE_FIELDS = [
  'player1_id', 'player2_id', 'court_id', 'draw', 'round',
  'match_number', 'status', 'scheduled_time', 'sort_order', 'notes',
] as const;

// Allowed fields for match updates
const MATCH_UPDATE_FIELDS = [
  'court_id', 'status', 'scheduled_time', 'scores', 'winner_id',
  'sort_order', 'notes', 'referee_id',
] as const;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireTournamentOrganizer(id);
  if (auth.error) return auth.error;

  const supabase = createAdminClient();
  const body = await req.json();

  // Whitelist fields
  const insert: Record<string, unknown> = { tournament_id: id };
  for (const key of MATCH_CREATE_FIELDS) {
    if (key in body) insert[key] = body[key];
  }

  const { data, error } = await supabase
    .from('matches')
    .insert(insert)
    .select(MATCH_SELECT)
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
  const { id: matchId, expected_updated_at } = body;

  if (!matchId) return NextResponse.json({ error: 'Match id required' }, { status: 400 });

  // Whitelist fields
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const key of MATCH_UPDATE_FIELDS) {
    if (key in body) updates[key] = body[key];
  }

  // Auto-set timestamps based on status changes
  if (updates.status === 'in_progress' && !body.started_at) {
    updates.started_at = new Date().toISOString();
  }
  if (updates.status === 'completed' && !body.completed_at) {
    updates.completed_at = new Date().toISOString();
  }

  // Optimistic locking: if client sends expected_updated_at, verify it matches
  let query = supabase
    .from('matches')
    .update(updates)
    .eq('id', matchId)
    .eq('tournament_id', id);

  if (expected_updated_at) {
    query = query.eq('updated_at', expected_updated_at);
  }

  const { data, error } = await query
    .select(MATCH_SELECT)
    .single();

  if (error) {
    // If no rows matched and we had an optimistic lock, it's a conflict
    if (expected_updated_at && error.code === 'PGRST116') {
      return NextResponse.json(
        { error: 'Conflict: this match was updated by someone else. Please refresh and try again.' },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

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

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireTournamentOrganizer(id);
  if (auth.error) return auth.error;

  const supabase = createAdminClient();
  const { matchId } = await req.json();

  if (!matchId) return NextResponse.json({ error: 'matchId required' }, { status: 400 });

  const { error } = await supabase.from('matches').delete().eq('id', matchId).eq('tournament_id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
