import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

/** GET: Returns summary of draws in a tournament (player counts, match counts). */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = createAdminClient();

  // Get all players grouped by draw
  const { data: players, error: pErr } = await supabase
    .from('players')
    .select('id, draw, seed')
    .eq('tournament_id', id);

  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });

  // Get all matches grouped by draw
  const { data: matches, error: mErr } = await supabase
    .from('matches')
    .select('id, draw, status')
    .eq('tournament_id', id);

  if (mErr) return NextResponse.json({ error: mErr.message }, { status: 500 });

  // Build summary per draw
  const drawNames = [...new Set((players || []).map((p) => p.draw || 'Unassigned'))].sort();

  const draws = drawNames.map((draw) => {
    const drawPlayers = (players || []).filter((p) => (p.draw || 'Unassigned') === draw);
    const drawMatches = (matches || []).filter((m) => m.draw === draw);
    const completedMatches = drawMatches.filter((m) => m.status === 'completed');

    return {
      draw,
      playerCount: drawPlayers.length,
      seededCount: drawPlayers.filter((p) => p.seed != null).length,
      matchCount: drawMatches.length,
      completedCount: completedMatches.length,
      hasMatches: drawMatches.length > 0,
    };
  });

  return NextResponse.json(draws);
}
