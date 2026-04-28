import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireTournamentOrganizer } from '@/lib/supabase/require-role';

/** Round priority: higher = more important match. */
function roundPriority(round: string | null): number {
  if (!round) return 0;
  if (round === 'F') return 1000;
  if (round === 'SF') return 900;
  if (round === 'QF') return 800;
  if (round.startsWith('R')) {
    const n = parseInt(round.slice(1));
    return n ? 500 - n : 400; // R2 > R1
  }
  if (round.startsWith('RR')) return 100;
  return 50;
}

/** POST: Auto-assign referees to matches by priority. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: tournamentId } = await params;
  const auth = await requireTournamentOrganizer(tournamentId);
  if (auth.error) return auth.error;
  const supabase = createAdminClient();

  // Get referees
  const { data: referees } = await supabase
    .from('volunteers')
    .select('*')
    .eq('tournament_id', tournamentId)
    .eq('role', 'referee')
    .order('name');

  if (!referees || referees.length === 0) {
    return NextResponse.json({ error: 'No referees signed up' }, { status: 400 });
  }

  // Get unassigned, non-walkover matches — include player emails for conflict detection
  const { data: matches } = await supabase
    .from('matches')
    .select('id, round, player1_id, player2_id, referee_id, match_number, player1:players!player1_id(email), player2:players!player2_id(email)')
    .eq('tournament_id', tournamentId)
    .is('referee_id', null)
    .not('status', 'in', '("walkover","cancelled","completed")');

  if (!matches || matches.length === 0) {
    return NextResponse.json({ error: 'No unassigned matches' }, { status: 400 });
  }

  // Sort matches by round priority (highest first)
  const sorted = [...matches].sort(
    (a, b) => roundPriority(b.round) - roundPriority(a.round),
  );

  // Round-robin assign referees, skipping refs who are playing in that match
  const assignments: { matchId: string; refereeId: string }[] = [];
  let refIndex = 0;

  for (const match of sorted) {
    // Collect the emails of both players in this match (lowercased for comparison)
    const playerEmails = new Set(
      [
        (match.player1 as { email?: string } | null)?.email,
        (match.player2 as { email?: string } | null)?.email,
      ]
        .filter(Boolean)
        .map((e) => e!.toLowerCase()),
    );

    // Try each referee in rotation; skip any who are a player in this match
    let assigned = false;
    for (let attempt = 0; attempt < referees.length; attempt++) {
      const ref = referees[(refIndex + attempt) % referees.length];
      const refEmail = (ref.email as string | null)?.toLowerCase() ?? '';

      if (playerEmails.has(refEmail)) continue; // Conflict — ref is also playing

      assigned = true;
      assignments.push({ matchId: match.id, refereeId: ref.id });
      refIndex = (refIndex + attempt + 1) % referees.length;
      break;
    }

    // If all refs are playing in this match, leave it unassigned (edge case)
    if (!assigned) {
      refIndex = (refIndex + 1) % referees.length;
    }
  }

  // Bulk update
  for (const a of assignments) {
    await supabase
      .from('matches')
      .update({ referee_id: a.refereeId, updated_at: new Date().toISOString() })
      .eq('id', a.matchId);
  }

  return NextResponse.json({
    assigned: assignments.length,
    totalReferees: referees.length,
    totalMatches: matches.length,
  });
}
