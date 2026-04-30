import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAuth } from '@/lib/supabase/auth-check';
import { rateLimit, limits } from '@/lib/rateLimit';

type Params = { params: Promise<{ id: string; matchId: string }> };

/** GET: Fetch a single match with player/court details. Public. */
export async function GET(_req: NextRequest, { params }: Params) {
  const { id, matchId } = await params;
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('matches')
    .select('*, player1:players!player1_id(*), player2:players!player2_id(*), court:courts!court_id(*)')
    .eq('id', matchId)
    .eq('tournament_id', id)
    .single();

  if (error || !data) return NextResponse.json({ error: 'Match not found' }, { status: 404 });
  return NextResponse.json(data);
}

/**
 * PATCH: Update scores/status for a match.
 * Auth required — must be:
 *   1. An organizer (admin/scorer) for this tournament, OR
 *   2. A player in this match (email matches), OR
 *   3. The assigned referee (volunteer) for this match
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  const limited = rateLimit(req, limits.scoring);
  if (limited) return limited;

  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const { id, matchId } = await params;
  const supabase = createAdminClient();

  // Fetch match
  const { data: match } = await supabase
    .from('matches')
    .select('*, player1:players!player1_id(email), player2:players!player2_id(email), referee:volunteers!referee_id(id)')
    .eq('id', matchId)
    .eq('tournament_id', id)
    .single();

  if (!match) return NextResponse.json({ error: 'Match not found' }, { status: 404 });

  // Check permissions
  const isOrganizer = await supabase
    .from('organizers')
    .select('id')
    .eq('tournament_id', id)
    .eq('user_id', auth.user.id)
    .maybeSingle()
    .then(({ data }) => !!data);

  const playerEmails = [
    (match.player1 as { email?: string } | null)?.email,
    (match.player2 as { email?: string } | null)?.email,
  ].filter(Boolean);
  const isPlayer = playerEmails.includes(auth.user.email);

  // Check if user is the assigned referee (volunteer with same user_id via auth email)
  const isReferee = !!(match.referee as { id: string } | null)?.id && await supabase
    .from('volunteers')
    .select('id')
    .eq('id', (match.referee as { id: string }).id)
    .eq('email', auth.user.email)
    .maybeSingle()
    .then(({ data }) => !!data);

  // Also allow global admin/superadmin
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', auth.user.id)
    .single();
  const isAdmin = profile?.role === 'admin' || profile?.role === 'superadmin';

  if (!isOrganizer && !isPlayer && !isReferee && !isAdmin) {
    return NextResponse.json({ error: 'Not authorized to score this match' }, { status: 403 });
  }

  const body = await req.json();
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if ('scores' in body) {
    const scores = body.scores;
    if (!Array.isArray(scores)) {
      return NextResponse.json({ error: 'scores must be an array' }, { status: 400 });
    }
    // US Squash PAR scoring: best of 3 or 5, so max 5 games
    if (scores.length > 5) {
      return NextResponse.json({ error: 'Squash is best of 5 — cannot have more than 5 games' }, { status: 400 });
    }

    let p1GamesWon = 0;
    let p2GamesWon = 0;

    for (let i = 0; i < scores.length; i++) {
      const game = scores[i];
      if (typeof game !== 'object' || game === null) {
        return NextResponse.json({ error: 'Each game must be an object with p1 and p2' }, { status: 400 });
      }
      const p1 = (game as Record<string, unknown>).p1;
      const p2 = (game as Record<string, unknown>).p2;
      if (typeof p1 !== 'number' || !Number.isInteger(p1) || p1 < 0) {
        return NextResponse.json({ error: `Game ${i + 1}: p1 must be a non-negative integer` }, { status: 400 });
      }
      if (typeof p2 !== 'number' || !Number.isInteger(p2) || p2 < 0) {
        return NextResponse.json({ error: `Game ${i + 1}: p2 must be a non-negative integer` }, { status: 400 });
      }

      // A completed game: one player must have won
      // Win condition: reach 11, OR if 10-all win by 2 (PAR scoring)
      const isCompletedGame = (p1 !== p2) && (
        (p1 >= 11 || p2 >= 11) &&                         // someone reached 11+
        (Math.max(p1, p2) >= 11) &&                       // winner has at least 11
        (Math.max(p1, p2) - Math.min(p1, p2) >= 1) &&    // someone is ahead
        !(Math.min(p1, p2) >= 10 && Math.max(p1, p2) - Math.min(p1, p2) < 2) // if 10+ each, must win by 2
      );

      // Allow in-progress game scores (last game may be incomplete)
      const isLastGame = i === scores.length - 1;
      if (!isLastGame && !isCompletedGame) {
        return NextResponse.json({
          error: `Game ${i + 1} score ${p1}–${p2} is not a valid completed game. ` +
            `Games are played to 11; if tied at 10-all, win by 2.`,
        }, { status: 400 });
      }

      if (p1 > p2) p1GamesWon++;
      else if (p2 > p1) p2GamesWon++;

      // Make sure match hasn't already been decided before this game
      if (i < scores.length - 1) {
        if (p1GamesWon === 3 || p2GamesWon === 3) {
          return NextResponse.json({
            error: `Match was already decided after game ${i + 1} — extra games should not be recorded`,
          }, { status: 400 });
        }
      }
    }

    updates.scores = scores;
  }

  const validStatuses = ['scheduled', 'on_deck', 'in_progress', 'completed', 'cancelled', 'walkover'];
  if ('status' in body) {
    if (!validStatuses.includes(body.status)) {
      return NextResponse.json({ error: 'Invalid status value' }, { status: 400 });
    }
    updates.status = body.status;
    if (body.status === 'in_progress' && !match.started_at) {
      updates.started_at = new Date().toISOString();
    }
    if (body.status === 'completed') {
      updates.completed_at = new Date().toISOString();
    }
  }

  if ('winner_id' in body) {
    // winner_id must be null or one of the two players in this match
    // Use the FK columns directly — the join only selects (email) so .id would be undefined
    const validWinners = [match.player1_id, match.player2_id, null];
    if (!validWinners.includes(body.winner_id)) {
      return NextResponse.json({ error: 'winner_id must be a player in this match' }, { status: 400 });
    }
    updates.winner_id = body.winner_id;
  }

  const { data, error } = await supabase
    .from('matches')
    .update(updates)
    .eq('id', matchId)
    .select('*, player1:players!player1_id(*), player2:players!player2_id(*), court:courts!court_id(*)')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // On Deck logic: when a match starts, mark next match on that court as on_deck
  if (body.status === 'in_progress' && data.court_id) {
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
      await supabase.from('matches').update({ status: 'on_deck' }).eq('id', nextMatch.id);
    }
  }

  return NextResponse.json(data);
}
