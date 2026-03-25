import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { autoSchedule } from '@/lib/draws/scheduler';

/** POST: Auto-schedule matches to courts and time slots. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: tournamentId } = await params;
  const supabase = createAdminClient();
  const body = await req.json();

  const {
    draw,
    startTime,
    matchDurationMinutes = 45,
    restPeriodMinutes = 30,
  } = body as {
    draw?: string;
    startTime: string;
    matchDurationMinutes?: number;
    restPeriodMinutes?: number;
  };

  if (!startTime) {
    return NextResponse.json({ error: 'startTime is required' }, { status: 400 });
  }

  // Fetch available courts
  const { data: courts, error: cErr } = await supabase
    .from('courts')
    .select('id, name, sort_order')
    .eq('tournament_id', tournamentId)
    .in('status', ['available', 'in_use'])
    .order('sort_order');

  if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 });
  if (!courts || courts.length === 0) {
    return NextResponse.json({ error: 'No available courts' }, { status: 400 });
  }

  // Fetch schedulable matches (both players known, not walkover)
  let query = supabase
    .from('matches')
    .select('*')
    .eq('tournament_id', tournamentId)
    .not('player1_id', 'is', null)
    .not('player2_id', 'is', null)
    .neq('status', 'walkover')
    .neq('status', 'completed');

  if (draw) {
    query = query.eq('draw', draw);
  }

  const { data: matches, error: mErr } = await query;
  if (mErr) return NextResponse.json({ error: mErr.message }, { status: 500 });
  if (!matches || matches.length === 0) {
    return NextResponse.json({ error: 'No matches to schedule' }, { status: 400 });
  }

  // Run scheduler
  const assignments = autoSchedule(
    matches.map((m) => ({
      player1_id: m.player1_id,
      player2_id: m.player2_id,
      draw: m.draw || '',
      round: m.round || '',
      match_number: m.match_number || 0,
      sort_order: m.sort_order || 0,
      notes: m.notes,
      status: m.status as 'scheduled' | 'walkover',
      winner_id: m.winner_id,
      id: m.id,
    })),
    {
      courts: courts.map((c) => ({ id: c.id, name: c.name })),
      startTime: new Date(startTime),
      matchDurationMinutes,
      restPeriodMinutes,
    },
  );

  // Build match_number → match_id mapping
  const matchByNumber = new Map(matches.map((m) => [m.match_number, m.id]));

  // Bulk update matches with court and time assignments
  const updates = [];
  for (const assignment of assignments) {
    const matchId = matchByNumber.get(assignment.matchNumber);
    if (!matchId) continue;

    updates.push(
      supabase
        .from('matches')
        .update({
          court_id: assignment.courtId,
          scheduled_time: assignment.scheduledTime.toISOString(),
        })
        .eq('id', matchId),
    );
  }

  await Promise.all(updates);

  // Fetch updated matches to return
  let returnQuery = supabase
    .from('matches')
    .select('*, player1:players!player1_id(id, name, seed), player2:players!player2_id(id, name, seed), court:courts(*)')
    .eq('tournament_id', tournamentId)
    .order('scheduled_time', { nullsFirst: false })
    .order('sort_order');

  if (draw) {
    returnQuery = returnQuery.eq('draw', draw);
  }

  const { data: updated } = await returnQuery;

  return NextResponse.json({
    scheduled: assignments.length,
    matches: updated,
  });
}
