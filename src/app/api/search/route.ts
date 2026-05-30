import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

type SearchResult = {
  type: 'player' | 'match' | 'court' | 'tournament';
  title: string;
  subtitle: string;
  href: string;
};

/**
 * GET /api/search?q=...&tournament=<slug>
 *
 * Global search across players, matches, courts, and tournaments.
 * If `tournament` slug is provided, results are scoped + deep-linked to it.
 */
export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get('q') || '').trim();
  const scopeSlug = req.nextUrl.searchParams.get('tournament') || null;

  if (q.length < 2) return NextResponse.json({ results: [] });

  const supabase = createAdminClient();
  const like = `%${q}%`;
  const results: SearchResult[] = [];

  // Resolve scope tournament id (if a slug was passed)
  let scopeId: string | null = null;
  let scopeName = '';
  if (scopeSlug) {
    const { data: t } = await supabase
      .from('tournaments')
      .select('id, name')
      .eq('slug', scopeSlug)
      .maybeSingle();
    if (t) { scopeId = t.id; scopeName = t.name; }
  }

  // Map of tournament id → slug for building links
  const { data: allT } = await supabase.from('tournaments').select('id, slug, name');
  const slugById: Record<string, { slug: string; name: string }> = {};
  for (const t of allT || []) slugById[t.id] = { slug: t.slug, name: t.name };

  // --- Players ---
  let playerQuery = supabase
    .from('players')
    .select('id, name, draw, tournament_id')
    .ilike('name', like)
    .limit(8);
  if (scopeId) playerQuery = playerQuery.eq('tournament_id', scopeId);
  const { data: players } = await playerQuery;
  for (const p of players || []) {
    const t = slugById[p.tournament_id];
    if (!t) continue;
    results.push({
      type: 'player',
      title: p.name,
      subtitle: [p.draw, scopeId ? null : t.name].filter(Boolean).join(' · ') || 'Player',
      href: `/t/${t.slug}/player/${p.id}`,
    });
  }

  // --- Courts ---
  let courtQuery = supabase
    .from('courts')
    .select('id, name, tournament_id')
    .ilike('name', like)
    .limit(5);
  if (scopeId) courtQuery = courtQuery.eq('tournament_id', scopeId);
  const { data: courts } = await courtQuery;
  for (const c of courts || []) {
    const t = slugById[c.tournament_id];
    if (!t) continue;
    results.push({
      type: 'court',
      title: c.name,
      subtitle: scopeId ? 'Court board' : t.name,
      href: `/t/${t.slug}/courts`,
    });
  }

  // --- Tournaments (only when not scoped) ---
  if (!scopeId) {
    const { data: tournaments } = await supabase
      .from('tournaments')
      .select('id, name, slug, location_city')
      .ilike('name', like)
      .limit(5);
    for (const t of tournaments || []) {
      results.push({
        type: 'tournament',
        title: t.name,
        subtitle: t.location_city || 'Tournament',
        href: `/t/${t.slug}`,
      });
    }
  }

  // --- Matches (search by player name within scope) ---
  // Find matches where either player's name matches.
  if (scopeId) {
    const matchingPlayerIds = (players || []).map((p) => p.id);
    if (matchingPlayerIds.length > 0) {
      const orClause = matchingPlayerIds
        .map((id) => `player1_id.eq.${id},player2_id.eq.${id}`)
        .join(',');
      const { data: matches } = await supabase
        .from('matches')
        .select('id, draw, round, scheduled_time, player1:player1_id(name), player2:player2_id(name)')
        .eq('tournament_id', scopeId)
        .or(orClause)
        .limit(6);
      for (const m of (matches || []) as unknown as Array<{
        id: string; draw: string | null; round: string | null; scheduled_time: string | null;
        player1: { name: string } | null; player2: { name: string } | null;
      }>) {
        const p1 = m.player1?.name || 'TBD';
        const p2 = m.player2?.name || 'TBD';
        results.push({
          type: 'match',
          title: `${p1} vs ${p2}`,
          subtitle: [m.draw, m.round].filter(Boolean).join(' · ') || 'Match',
          href: `/t/${scopeSlug}/match/${m.id}`,
        });
      }
    }
  }

  return NextResponse.json({ results, scope: scopeName || null });
}
