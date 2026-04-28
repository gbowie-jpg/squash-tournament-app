import { notFound } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { Tournament } from '@/lib/supabase/types';
import SiteNav from '@/components/layout/SiteNav';
import SiteFooter from '@/components/layout/SiteFooter';
import RegisterForm from './RegisterForm';

export const dynamic = 'force-dynamic';

function fmtDate(d: string | null, opts?: Intl.DateTimeFormatOptions) {
  if (!d) return null;
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', opts ?? {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export default async function RegisterPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createServerSupabaseClient();

  const { data } = await supabase
    .from('tournaments')
    .select('*')
    .eq('slug', slug)
    .single();

  const tournament = data as Tournament | null;
  if (!tournament) notFound();

  // Fetch distinct draws/divisions from matches
  const { data: drawRows } = await supabase
    .from('matches')
    .select('draw')
    .eq('tournament_id', tournament.id)
    .not('draw', 'is', null);

  const draws = [
    ...new Set(
      (drawRows ?? [])
        .map((r: { draw: string | null }) => r.draw)
        .filter(Boolean) as string[],
    ),
  ];

  const startDateStr = fmtDate(tournament.start_date, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
  const endDateStr = tournament.end_date
    ? fmtDate(tournament.end_date, { weekday: 'long', month: 'long', day: 'numeric' })
    : null;

  const registrationDeadline = fmtDate(tournament.registration_deadline);
  const registrationOpens = tournament.registration_opens
    ? new Date(tournament.registration_opens + 'T00:00:00')
    : null;
  const registrationIsOpen =
    !registrationOpens || registrationOpens <= new Date();

  return (
    <div className="min-h-screen bg-[var(--surface)] flex flex-col">
      <SiteNav />

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-10">
        {/* Tournament header */}
        <div className="mb-8">
          <p className="text-sm text-[var(--text-secondary)] mb-1 uppercase tracking-wide font-medium">
            Player Registration
          </p>
          <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-2 tracking-tight">
            {tournament.name}
          </h1>
          <p className="text-[var(--text-secondary)] text-sm">
            {startDateStr}
            {endDateStr ? ` – ${endDateStr}` : ''}
          </p>
          {registrationDeadline && (
            <p className="text-[var(--text-secondary)] text-sm mt-1">
              Registration deadline:{' '}
              <span className="text-[var(--text-primary)] font-medium">
                {registrationDeadline}
              </span>
            </p>
          )}
        </div>

        {tournament.status === 'completed' ? (
          <div className="bg-[var(--surface-card)] border border-[var(--border)] rounded-2xl p-8 text-center">
            <p className="text-2xl mb-2">🔒</p>
            <h2 className="text-xl font-bold text-[var(--text-primary)]">
              Registration Closed
            </h2>
            <p className="text-[var(--text-secondary)] mt-2 text-sm">
              This tournament has already concluded. Registration is no longer
              available.
            </p>
          </div>
        ) : !registrationIsOpen ? (
          <div className="bg-[var(--surface-card)] border border-[var(--border)] rounded-2xl p-8 text-center">
            <p className="text-2xl mb-2">📅</p>
            <h2 className="text-xl font-bold text-[var(--text-primary)]">
              Registration Opens{' '}
              {fmtDate(tournament.registration_opens, {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}
            </h2>
            <p className="text-[var(--text-secondary)] mt-2 text-sm">
              Check back when registration opens to sign up.
            </p>
          </div>
        ) : (
          <RegisterForm
            tournamentId={tournament.id}
            tournamentSlug={slug}
            draws={draws}
            entryFee={tournament.entry_fee ?? 0}
          />
        )}
      </main>

      <SiteFooter />
    </div>
  );
}
