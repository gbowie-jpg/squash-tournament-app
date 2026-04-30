import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAuth } from '@/lib/supabase/auth-check';
import { rateLimit, limits } from '@/lib/rateLimit';

type Params = { params: Promise<{ id: string; matchId: string }> };

// ── Round ordering (matches Bracket.tsx) ────────────────────────────────────
const NAMED_ORDER: Record<string, number> = { F: 100, SF: 90, QF: 80 };
function roundOrderVal(r: string): number {
  if (NAMED_ORDER[r] !== undefined) return NAMED_ORDER[r];
  const m = r.match(/^R(\d+)$/);
  return m ? parseInt(m[1]) : 50;
}

// ── Bracket advancement ──────────────────────────────────────────────────────
// After a match completes:
//   • Advance the WINNER to the next round in the same draw.
//   • If it is the FIRST round and a consolation draw exists (any draw name
//     containing "plate" or "consolation"), place the LOSER there.
async function advanceBracket(
  supabase: ReturnType<typeof createAdminClient>,
  tournamentId: string,
  completedMatchId: string,
  draw: string | null,
  winnerId: string,
  loserId: string | null,
) {
  if (!draw) return;

  // Fetch all matches in the same draw
  const { data: drawMatches } = await supabase
    .from('matches')
    .select('id, round, match_number, sort_order, player1_id, player2_id')
    .eq('tournament_id', tournamentId)
    .eq('draw', draw)
    .not('round', 'is', null);

  if (!drawMatches?.length) return;

  // Sort rounds early → late
  const rounds = [...new Set(drawMatches.map((m) => m.round as string))].sort(
    (a, b) => roundOrderVal(a) - roundOrderVal(b),
  );

  const completedRound = drawMatches.find((m) => m.id === completedMatchId)?.round ?? '';
  const currentRoundIdx = rounds.indexOf(completedRound);
  if (currentRoundIdx === -1 || currentRoundIdx >= rounds.length - 1) {
    // Already in the final round — no advancement needed
  } else {
    const nextRound = rounds[currentRoundIdx + 1];

    // Matches in the current round, sorted by sort_order then match_number
    const currentRoundMatches = drawMatches
      .filter((m) => m.round === completedRound)
      .sort((a, b) =>
        (a.sort_order ?? 0) !== (b.sort_order ?? 0)
          ? (a.sort_order ?? 0) - (b.sort_order ?? 0)
          : (a.match_number ?? 0) - (b.match_number ?? 0),
      );

    const posInRound = currentRoundMatches.findIndex((m) => m.id === completedMatchId);
    if (posInRound !== -1) {
      const nextRoundMatches = drawMatches
        .filter((m) => m.round === nextRound)
        .sort((a, b) =>
          (a.sort_order ?? 0) !== (b.sort_order ?? 0)
            ? (a.sort_order ?? 0) - (b.sort_order ?? 0)
            : (a.match_number ?? 0) - (b.match_number ?? 0),
        );

      const targetIdx = Math.floor(posInRound / 2);
      const targetMatch = nextRoundMatches[targetIdx];
      if (targetMatch) {
        // Even position (0,2,4…) → player1 slot; odd (1,3,5…) → player2 slot
        const slot = posInRound % 2 === 0 ? 'player1_id' : 'player2_id';
        await supabase.from('matches').update({ [slot]: winnerId }).eq('id', targetMatch.id);
      }
    }
  }

  // ── Consolation/Plate loser placement ────────────────────────────────────
  // Only for the first round of the main draw so every player gets ≥ 3 matches.
  if (currentRoundIdx === 0 && loserId) {
    // Look for a consolation draw in this tournament (plate / consolation in name)
    const { data: allDraws } = await supabase
      .from('matches')
      .select('draw')
      .eq('tournament_id', tournamentId)
      .not('draw', 'eq', draw)
      .not('round', 'is', null);

    if (allDraws?.length) {
      const consolationDrawName = [
        ...new Set(allDraws.map((m) => m.draw as string)),
      ].find(
        (d) =>
          d.toLowerCase().includes('plate') ||
          d.toLowerCase().includes('consolation') ||
          d.toLowerCase() === (draw.toLowerCase() + ' b'),
      );

      if (consolationDrawName) {
        const { data: consolationMatches } = await supabase
          .from('matches')
          .select('id, round, match_number, sort_order, player1_id, player2_id')
          .eq('tournament_id', tournamentId)
          .eq('draw', consolationDrawName)
          .not('round', 'is', null);

        if (consolationMatches?.length) {
          // First round of the consolation draw
          const consolRounds = [
            ...new Set(consolationMatches.map((m) => m.round as string)),
          ].sort((a, b) => roundOrderVal(a) - roundOrderVal(b));

          const firstConsRound = consolRounds[0];
          const firstRoundMatches = consolationMatches
            .filter((m) => m.round === firstConsRound)
            .sort((a, b) =>
              (a.sort_order ?? 0) !== (b.sort_order ?? 0)
                ? (a.sort_order ?? 0) - (b.sort_order ?? 0)
                : (a.match_number ?? 0) - (b.match_number ?? 0),
            );

          // Find first match with an empty slot
          for (const cm of firstRoundMatches) {
            if (!cm.player1_id) {
              await supabase.from('matches').update({ player1_id: loserId }).eq('id', cm.id);
              break;
            } else if (!cm.player2_id) {
              await supabase.from('matches').update({ player2_id: loserId }).eq('id', cm.id);
              break;
            }
          }
        }
      }
    }
  }
}

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
 *   4. A global admin/superadmin
 *
 * Scorer lock: once a scorer claims the match (in_progress), only they can
 * continue (plus organizers/admins).
 *
 * Correction window: after a match completes, non-admins may only correct
 * scores within 10 minutes, and only if they are the original scorer.
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

  const existingScorerId = (match.scorer_user_id as string | null) ?? null;

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
  const isPlayer = !!(auth.user.email && playerEmails.includes(auth.user.email));

  const isReferee = !!(match.referee as { id: string } | null)?.id && await supabase
    .from('volunteers')
    .select('id')
    .eq('id', (match.referee as { id: string }).id)
    .eq('email', auth.user.email)
    .maybeSingle()
    .then(({ data }) => !!data);

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', auth.user.id)
    .single();
  const isAdmin = profile?.role === 'admin' || profile?.role === 'superadmin';

  if (!isOrganizer && !isPlayer && !isReferee && !isAdmin) {
    return NextResponse.json({ error: 'Not authorized to score this match' }, { status: 403 });
  }

  // If another scorer has already claimed this match, block everyone except them (and organizers/admins)
  if (existingScorerId && existingScorerId !== auth.user.id && !isOrganizer && !isAdmin) {
    return NextResponse.json({ error: 'This match is already being scored by someone else' }, { status: 423 });
  }

  // ── 10-minute correction window ─────────────────────────────────────────
  // Organizers and admins can always edit. Regular users can only correct within
  // 10 minutes of completion and must be the original scorer.
  const isCompleted = match.status === 'completed' || match.status === 'walkover';
  if (isCompleted && !isOrganizer && !isAdmin) {
    const completedAt = match.completed_at ? new Date(match.completed_at).getTime() : null;
    const withinWindow = completedAt !== null && (Date.now() - completedAt) < 10 * 60 * 1000;
    if (!withinWindow) {
      return NextResponse.json(
        { error: 'The 10-minute correction window has expired' },
        { status: 403 },
      );
    }
    if (existingScorerId && existingScorerId !== auth.user.id) {
      return NextResponse.json(
        { error: 'Only the original scorer can correct this match' },
        { status: 403 },
      );
    }
  }

  const body = await req.json();

  // ── _check: just validate auth, don't modify ────────────────────────────
  if (body._check === true) {
    return NextResponse.json({ ok: true, role: isOrganizer ? 'organizer' : isPlayer ? 'player' : isReferee ? 'referee' : 'admin' });
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if ('court_id' in body) {
    updates.court_id = body.court_id ?? null;
  }

  if ('scores' in body) {
    const scores = body.scores;
    if (!Array.isArray(scores)) {
      return NextResponse.json({ error: 'scores must be an array' }, { status: 400 });
    }
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

      const isCompletedGame = (p1 !== p2) && (
        (p1 >= 11 || p2 >= 11) &&
        (Math.max(p1, p2) >= 11) &&
        (Math.max(p1, p2) - Math.min(p1, p2) >= 1) &&
        !(Math.min(p1, p2) >= 10 && Math.max(p1, p2) - Math.min(p1, p2) < 2)
      );

      const isLastGame = i === scores.length - 1;
      if (!isLastGame && !isCompletedGame) {
        return NextResponse.json({
          error: `Game ${i + 1} score ${p1}–${p2} is not a valid completed game. ` +
            `Games are played to 11; if tied at 10-all, win by 2.`,
        }, { status: 400 });
      }

      if (p1 > p2) p1GamesWon++;
      else if (p2 > p1) p2GamesWon++;

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
    if (body.status === 'in_progress') {
      if (!match.started_at) updates.started_at = new Date().toISOString();
      if (!existingScorerId) updates.scorer_user_id = auth.user.id;
    }
    if (body.status === 'completed' || body.status === 'walkover') {
      updates.completed_at = new Date().toISOString();
    }
  }

  if ('winner_id' in body) {
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

  // ── Court status ─────────────────────────────────────────────────────────
  const courtId = data.court_id ?? match.court_id;
  if (courtId) {
    if (body.status === 'in_progress') {
      await supabase.from('courts').update({ status: 'in_use' }).eq('id', courtId);
    } else if (body.status === 'completed' || body.status === 'walkover' || body.status === 'cancelled') {
      await supabase.from('courts').update({ status: 'available' }).eq('id', courtId);
    }
  }

  // ── On-Deck logic ────────────────────────────────────────────────────────
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

  // ── Bracket advancement ──────────────────────────────────────────────────
  const winnerIdFinal = (body.winner_id ?? data.winner_id) as string | null;
  if (
    (body.status === 'completed' || body.status === 'walkover') &&
    winnerIdFinal
  ) {
    const loserIdFinal = (
      winnerIdFinal === data.player1_id ? data.player2_id : data.player1_id
    ) as string | null;

    await advanceBracket(
      supabase,
      id,
      matchId,
      data.draw,
      winnerIdFinal,
      loserIdFinal,
    );
  }

  return NextResponse.json(data);
}
