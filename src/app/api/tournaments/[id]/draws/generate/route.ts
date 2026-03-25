import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateSingleElimination } from '@/lib/draws/singleElimination';
import { generateRoundRobin } from '@/lib/draws/roundRobin';
import type { DrawFormat } from '@/lib/draws/types';

/** POST: Generate matches for a draw. Deletes existing matches for that draw first. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: tournamentId } = await params;
  const supabase = createAdminClient();
  const body = await req.json();

  const { draw, format } = body as { draw: string; format: DrawFormat };

  if (!draw || !format) {
    return NextResponse.json(
      { error: 'draw and format are required' },
      { status: 400 },
    );
  }

  // Fetch players for this draw
  const { data: players, error: pErr } = await supabase
    .from('players')
    .select('id, name, seed, draw')
    .eq('tournament_id', tournamentId)
    .eq('draw', draw)
    .order('seed', { nullsFirst: false })
    .order('name');

  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });
  if (!players || players.length < 2) {
    return NextResponse.json(
      { error: `Need at least 2 players in "${draw}" draw (found ${players?.length || 0})` },
      { status: 400 },
    );
  }

  // Check for in-progress or completed matches that shouldn't be deleted
  const { data: existingMatches } = await supabase
    .from('matches')
    .select('id, status')
    .eq('tournament_id', tournamentId)
    .eq('draw', draw);

  const activeMatches = (existingMatches || []).filter(
    (m) => m.status === 'in_progress' || m.status === 'completed',
  );
  if (activeMatches.length > 0) {
    return NextResponse.json(
      { error: `Cannot regenerate: ${activeMatches.length} matches are in progress or completed. Delete them manually first.` },
      { status: 409 },
    );
  }

  // Delete existing matches for this draw
  if (existingMatches && existingMatches.length > 0) {
    const { error: delErr } = await supabase
      .from('matches')
      .delete()
      .eq('tournament_id', tournamentId)
      .eq('draw', draw);

    if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });
  }

  // Generate matches
  let result;
  try {
    if (format === 'single_elimination') {
      result = generateSingleElimination(players, draw);
    } else if (format === 'round_robin') {
      result = generateRoundRobin(players, draw);
    } else {
      return NextResponse.json({ error: `Unknown format: ${format}` }, { status: 400 });
    }
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Generation failed' },
      { status: 400 },
    );
  }

  // Bulk insert matches
  const records = result.matches.map((m) => ({
    tournament_id: tournamentId,
    player1_id: m.player1_id,
    player2_id: m.player2_id,
    draw: m.draw,
    round: m.round,
    match_number: m.match_number,
    sort_order: m.sort_order,
    notes: m.notes,
    status: m.status,
    winner_id: m.winner_id,
  }));

  const { data: created, error: insertErr } = await supabase
    .from('matches')
    .insert(records)
    .select('*, player1:players!player1_id(id, name, seed), player2:players!player2_id(id, name, seed)');

  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });

  return NextResponse.json({
    matches: created,
    format,
    draw,
    playerCount: players.length,
    matchCount: created?.length || 0,
  }, { status: 201 });
}
