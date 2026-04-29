import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import SiteNav from '@/components/layout/SiteNav';
import SiteFooter from '@/components/layout/SiteFooter';
import TournamentBottomNav from '@/components/layout/TournamentBottomNav';
import type { Tournament, Player } from '@/lib/supabase/types';

export const dynamic = 'force-dynamic';

export default async function RegistrantsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createServerSupabaseClient();

  const { data } = await supabase
    .from('tournaments')
    .select('id, name, slug, status')
    .eq('slug', slug)
    .single();

  const tournament = data as Pick<Tournament, 'id' | 'name' | 'slug' | 'status'> | null;
  if (!tournament) notFound();

  // Fetch players — name, club, draw, seed only (no contact info)
  const { data: players } = await supabase
    .from('players')
    .select('id, name, club, draw, seed, payment_status')
    .eq('tournament_id', tournament.id)
    .neq('payment_status', 'pending') // exclude incomplete payments
    .order('seed', { ascending: true, nullsFirst: false })
    .order('name', { ascending: true });

  type PlayerRow = Pick<Player, 'id' | 'name' | 'club' | 'draw' | 'seed' | 'payment_status'>;
  const allPlayers = (players || []) as PlayerRow[];

  // Group by draw / division
  const groups: Record<string, typeof allPlayers> = {};
  for (const p of allPlayers) {
    const key = p.draw || 'Unassigned';
    if (!groups[key]) groups[key] = [];
    groups[key].push(p);
  }

  // Sort group keys — put known divisions first, then alpha
  const DIVISION_ORDER = ['Open', 'A', 'B', 'C', 'D'];
  const sortedGroups = Object.entries(groups).sort(([a], [b]) => {
    const ai = DIVISION_ORDER.indexOf(a);
    const bi = DIVISION_ORDER.indexOf(b);
    if (ai !== -1 && bi !== -1) return ai - bi;
    if (ai !== -1) return -1;
    if (bi !== -1) return 1;
    if (a === 'Unassigned') return 1;
    if (b === 'Unassigned') return -1;
    return a.localeCompare(b);
  });

  return (
    <div className="min-h-screen bg-[var(--surface)] flex flex-col pb-16 md:pb-0">
      <SiteNav />

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <Link
            href={`/t/${slug}`}
            className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >
            ← {tournament.name}
          </Link>
          <h1 className="text-2xl font-bold text-[var(--text-primary)] mt-1">Registrants</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-0.5">
            {allPlayers.length} player{allPlayers.length !== 1 ? 's' : ''} registered
          </p>
        </div>

        {allPlayers.length === 0 ? (
          <div className="bg-[var(--surface-card)] border border-[var(--border)] rounded-2xl p-10 text-center">
            <p className="text-3xl mb-3">🎾</p>
            <p className="font-semibold text-[var(--text-primary)]">No registrants yet</p>
            <p className="text-sm text-[var(--text-secondary)] mt-1">
              Be the first —{' '}
              <Link href={`/t/${slug}/register`} className="underline hover:text-[var(--text-primary)]">
                register now
              </Link>
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {sortedGroups.map(([division, divPlayers]) => (
              <div key={division} className="bg-[var(--surface-card)] border border-[var(--border)] rounded-2xl overflow-hidden">
                {/* Division header */}
                <div className="px-5 py-3 border-b border-[var(--border)] flex items-center justify-between">
                  <h2 className="font-semibold text-[var(--text-primary)]">{division}</h2>
                  <span className="text-xs text-[var(--text-secondary)] bg-[var(--surface)] border border-[var(--border)] px-2 py-0.5 rounded-full">
                    {divPlayers.length} player{divPlayers.length !== 1 ? 's' : ''}
                  </span>
                </div>

                {/* Player rows */}
                <ul className="divide-y divide-[var(--border)]">
                  {divPlayers.map((p, i) => (
                    <li key={p.id} className="flex items-center gap-3 px-5 py-3">
                      {/* Seed or position number */}
                      <span className="w-6 text-center text-xs font-mono text-[var(--text-secondary)] shrink-0">
                        {p.seed ?? i + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[var(--text-primary)] truncate">{p.name}</p>
                        {p.club && (
                          <p className="text-xs text-[var(--text-secondary)] truncate">{p.club}</p>
                        )}
                      </div>
                      {p.seed && (
                        <span className="text-xs text-[var(--text-secondary)] shrink-0">
                          #{p.seed} seed
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </main>

      <SiteFooter />
      <TournamentBottomNav slug={slug} />
    </div>
  );
}
