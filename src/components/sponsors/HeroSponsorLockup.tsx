'use client';

import { useSponsors } from '@/lib/useSponsors';

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
          const logo = <img src={s.logo_url!} alt={s.name} className="h-10 sm:h-12 w-auto object-contain" />;
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
