import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import SiteNav from '@/components/layout/SiteNav';
import SiteFooter from '@/components/layout/SiteFooter';
import TournamentBottomNav from '@/components/layout/TournamentBottomNav';
import PullToRefresh from '@/components/PullToRefresh';
import DrawsClient from './DrawsClient';
import type { Tournament } from '@/lib/supabase/types';
import type { BracketMatch } from '@/components/tournament/Bracket';

export const dynamic = 'force-dynamic';

export default async function DrawsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const [{ slug }, { tab }] = await Promise.all([params, searchParams]);
  const supabase = await createServerSupabaseClient();

  const { data } = await supabase
    .from('tournaments')
    .select('id, name, slug, status')
    .eq('slug', slug)
    .single();

  const tournament = data as Pick<Tournament, 'id' | 'name' | 'slug' | 'status'> | null;
  if (!tournament) notFound();

  // Fetch all matches with player + court details
  const { data: rawMatches } = await supabase
    .from('matches')
    .select(`
      id, match_number, draw, round, status, scheduled_time,
      winner_id, scores, notes,
      player1:players!player1_id(id, name, seed),
      player2:players!player2_id(id, name, seed)
    `)
    .eq('tournament_id', tournament.id)
    .neq('status', 'cancelled')
    .order('sort_order')
    .order('match_number');

  const matches = (rawMatches || []) as unknown as BracketMatch[];

  // Draws that actually have matches
  const drawNames = [
    ...new Set(matches.map((m) => m.draw).filter(Boolean)),
  ] as string[];

  // Upcoming matches across all draws (next 10 scheduled/on_deck)
  const upcoming = matches
    .filter((m) => m.status === 'scheduled' || m.status === 'on_deck')
    .filter((m) => m.player1 && m.player2) // skip TBD slots
    .slice(0, 10);

  const defaultTab = (['bracket', 'live', 'done'] as const).includes(tab as 'bracket' | 'live' | 'done')
    ? (tab as 'bracket' | 'live' | 'done')
    : 'bracket';

  return (
    <PullToRefresh>
    <div className="min-h-screen bg-[var(--surface)] flex flex-col pb-16 md:pb-0">
      <SiteNav />

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <Link
            href={`/t/${slug}`}
            className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >
            ← {tournament.name}
          </Link>
          <h1 className="text-2xl font-bold text-[var(--text-primary)] mt-1">Draws & Brackets</h1>
        </div>

        {drawNames.length === 0 ? (
          <div className="bg-[var(--surface-card)] border border-[var(--border)] rounded-2xl p-10 text-center">
            <p className="text-3xl mb-3">🎾</p>
            <p className="font-semibold text-[var(--text-primary)]">Draws not yet generated</p>
            <p className="text-sm text-[var(--text-secondary)] mt-1">
              Check back closer to the tournament — the organizer will publish the draw once it&apos;s set.
            </p>
          </div>
        ) : (
          <DrawsClient
            slug={slug}
            drawNames={drawNames}
            matches={matches}
            upcoming={upcoming}
            defaultTab={defaultTab}
          />
        )}
      </main>

      <SiteFooter />
      <TournamentBottomNav slug={slug} />
    </div>
    </PullToRefresh>
  );
}
