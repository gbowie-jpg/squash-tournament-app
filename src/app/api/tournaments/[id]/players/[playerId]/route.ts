import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { rateLimit, limits } from '@/lib/rateLimit';
import {
  PUBLIC_PLAYER_COLUMNS,
  PUBLIC_PROFILE_COLUMNS,
  type PublicPlayer,
  type PublicProfile,
} from '@/lib/supabase/types';
import { emailsMatch, escapeLikePattern, isUuid, normalizeEmail } from '@/lib/player-access';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string; playerId: string }> };

/**
 * GET /api/tournaments/[id]/players/[playerId] — public player page data.
 *
 * Returns { player, profile, isOwn }:
 *   player  — public columns only (never email/phone/payment fields)
 *   profile — the linked account's public profile fields, returned only to the
 *             owner (their auth email matches) or to staff of this tournament
 *             (site admin/superadmin, or an organizer with role 'admin'). Anyone
 *             can create a player row with any email via /register, so for other
 *             viewers the email→account lookup would reveal whether an address
 *             has an account; they get null.
 *   isOwn   — the signed-in viewer's email matches the player's email
 *
 * The player's email is read with the service role and used only for the
 * comparisons below; it is never returned.
 */
export async function GET(req: NextRequest, { params }: Params) {
  const { id, playerId } = await params;
  if (!isUuid(id) || !isUuid(playerId)) {
    return NextResponse.json({ error: 'Player not found' }, { status: 404 });
  }

  // Fixed bucket so varying playerId can't reset the limit; scoped per
  // (validated) tournament so one busy event doesn't throttle another.
  const limited = rateLimit(req, { ...limits.publicRead, bucket: 'player-detail' }, id);
  if (limited) return limited;

  const admin = createAdminClient();
  const { data: row, error } = await admin
    .from('players')
    .select(`${PUBLIC_PLAYER_COLUMNS}, email`)
    .eq('id', playerId)
    .eq('tournament_id', id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: 'Failed to load player' }, { status: 500 });
  if (!row) return NextResponse.json({ error: 'Player not found' }, { status: 404 });

  const { email: rawEmail, ...player } = row as PublicPlayer & { email: string | null };
  const playerEmail = normalizeEmail(rawEmail);

  let isOwn = false;
  let profile: PublicProfile | null = null;

  if (playerEmail) {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      isOwn = emailsMatch(user.email, playerEmail);

      // Linking by email is only trustworthy for the owner (their verified auth
      // email matches) or for staff who manage this tournament. Anyone can
      // create a player row with any email via /register, so for other viewers
      // this lookup would show whether an address has an account.
      let canLink = isOwn;
      if (!canLink) {
        const [{ data: me }, { data: org }] = await Promise.all([
          admin.from('profiles').select('role').eq('id', user.id).maybeSingle(),
          admin
            .from('organizers')
            .select('id')
            .eq('tournament_id', id)
            .eq('user_id', user.id)
            .eq('role', 'admin')
            .maybeSingle(),
        ]);
        canLink = me?.role === 'admin' || me?.role === 'superadmin' || !!org;
      }

      if (canLink) {
        // Case-insensitive lookup; the pattern can over-match (see
        // escapeLikePattern), so re-check each candidate exactly.
        const { data: candidates } = await admin
          .from('profiles')
          .select(`${PUBLIC_PROFILE_COLUMNS}, email`)
          .ilike('email', escapeLikePattern(playerEmail))
          .limit(10);

        const match = (candidates ?? []).find((c) => emailsMatch(c.email, playerEmail));
        if (match) {
          profile = {
            full_name: match.full_name ?? null,
            photo_url: match.photo_url ?? null,
            bio: match.bio ?? null,
            club: match.club ?? null,
            squash_ranking: match.squash_ranking ?? null,
          };
        }
      }
    }
  }

  return NextResponse.json(
    { player: player as PublicPlayer, profile, isOwn },
    { headers: { 'Cache-Control': 'private, no-store' } },
  );
}
