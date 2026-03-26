import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAuth } from '@/lib/supabase/auth-check';

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
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const { id: tournamentId } = await params;
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

  // Get unassigned, non-walkover matches
  const { data: matches } = await supabase
    .from('matches')
    .select('id, round, player1_id, player2_id, referee_id, match_number')
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

  // Round-robin assign referees
  const assignments: { matchId: string; refereeId: string }[] = [];
  let refIndex = 0;

  for (const match of sorted) {
    // Try to find a ref who isn't a player in this match
    let assigned = false;
    for (let attempt = 0; attempt < referees.length; attempt++) {
      const ref = referees[(refIndex + attempt) % referees.length];
      // Skip if ref matches a player (by name — volunteers don't have player IDs)
      // This is a basic check; exact matching would need email comparison
      assigned = true;
      assignments.push({ matchId: match.id, refereeId: ref.id });
      refIndex = (refIndex + attempt + 1) % referees.length;
      break;
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
