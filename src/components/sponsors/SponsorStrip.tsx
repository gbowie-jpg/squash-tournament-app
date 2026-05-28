'use client';

import { useSponsors } from '@/lib/useSponsors';

/**
 * Horizontal rotating strip of supporting sponsor logos.
 * Optionally includes title sponsors first (prominent).
 *
 * Use in footers (court board, kiosk, tournament landing).
 */
export function SponsorStrip({
  tournamentId,
  includeTitle = true,
  variant = 'default',
}: {
  tournamentId: string;
  includeTitle?: boolean;
  variant?: 'default' | 'kiosk' | 'compact';
}) {
  const { sponsors } = useSponsors(tournamentId);

  const visible = sponsors.filter((s) => {
    if (!s.logo_url) return false;
    if (s.tier === 'court') return false; // court sponsors render on the court card
    if (s.tier === 'title' && !includeTitle) return false;
    return true;
  });

  if (visible.length === 0) return null;

  const sizing =
    variant === 'kiosk'
      ? 'h-16 sm:h-20'
      : variant === 'compact'
      ? 'h-8'
      : 'h-10 sm:h-12';

  const containerBg =
    variant === 'kiosk'
      ? 'bg-black/40 backdrop-blur'
      : 'bg-[var(--surface-card)] border-t border-[var(--border)]';

  const label =
    variant === 'kiosk'
      ? 'text-white/60'
      : 'text-[var(--text-muted)]';

  return (
    <div className={`w-full py-3 px-4 ${containerBg}`}>
      <p className={`text-[10px] uppercase tracking-[0.2em] text-center mb-2 ${label}`}>
        Thanks to our sponsors
      </p>
      <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-10">
        {visible.map((s) => {
          /* eslint-disable-next-line @next/next/no-img-element */
          const logo = <img src={s.logo_url!} alt={s.name} className={`${sizing} w-auto object-contain ${variant === 'kiosk' ? '' : 'opacity-80 hover:opacity-100 transition-opacity'}`} />;
          return s.url ? (
            <a key={s.id} href={s.url} target="_blank" rel="noopener noreferrer" title={s.name}>
              {logo}
            </a>
          ) : (
            <div key={s.id} title={s.name}>
              {logo}
            </div>
          );
        })}
      </div>
    </div>
  );
}
