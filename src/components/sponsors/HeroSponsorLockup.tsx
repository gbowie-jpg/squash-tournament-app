'use client';

import { useSponsors } from '@/lib/useSponsors';

/** Subtle full-width band that only renders when there are title sponsors. */
export function HeroSponsorBand({ tournamentId }: { tournamentId: string }) {
  const { sponsors } = useSponsors(tournamentId);
  const hasTitle = sponsors.some((s) => s.tier === 'title' && s.logo_url);
  if (!hasTitle) return null;
  return (
    <div className="bg-[var(--surface-card)] border-b border-[var(--border)]">
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-center">
        <HeroSponsorLockup tournamentId={tournamentId} textColor="var(--text-muted)" align="center" />
      </div>
    </div>
  );
}

/**
 * "Presented by [logo]" treatment for the tournament hero.
 * Shows all active title sponsors side-by-side. Subtle but prominent.
 */
export function HeroSponsorLockup({
  tournamentId,
  textColor,
  align = 'left',
}: {
  tournamentId: string;
  /** Text color for the "Presented by" label, matched to hero text colors */
  textColor?: string;
  align?: 'left' | 'center';
}) {
  const { sponsors } = useSponsors(tournamentId);
  const titles = sponsors.filter((s) => s.tier === 'title' && s.logo_url);
  if (titles.length === 0) return null;

  return (
    <div className={`mt-4 flex flex-col gap-2 ${align === 'center' ? 'items-center md:items-start' : 'items-center md:items-start'}`}>
      <p
        className="text-[10px] uppercase tracking-[0.2em] font-semibold"
        style={{ color: textColor || 'rgba(255,255,255,0.75)' }}
      >
        Presented by
      </p>
      <div className="flex flex-wrap items-center gap-4">
        {titles.map((s) => {
          /* eslint-disable-next-line @next/next/no-img-element */
          const logo = <img src={s.logo_url!} alt={s.name} className="h-20 sm:h-24 w-auto object-contain" />;
          return s.url ? (
            <a key={s.id} href={s.url} target="_blank" rel="noopener noreferrer" title={s.name} className="hover:opacity-80 transition-opacity">
              {logo}
            </a>
          ) : (
            <div key={s.id} title={s.name}>{logo}</div>
          );
        })}
      </div>
    </div>
  );
}
