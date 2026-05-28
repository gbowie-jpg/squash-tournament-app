'use client';

import { useSponsors } from '@/lib/useSponsors';

/** Small "Court sponsored by" badge for an individual court card. */
export function CourtSponsorBadge({
  tournamentId,
  courtId,
  variant = 'default',
}: {
  tournamentId: string;
  courtId: string;
  variant?: 'default' | 'kiosk';
}) {
  const { sponsors } = useSponsors(tournamentId);
  const courtSponsor = sponsors.find((s) => s.tier === 'court' && s.court_id === courtId && s.logo_url);
  if (!courtSponsor) return null;

  const labelClass = variant === 'kiosk' ? 'text-white/60' : 'text-[var(--text-muted)]';

  /* eslint-disable-next-line @next/next/no-img-element */
  const logo = <img src={courtSponsor.logo_url!} alt={courtSponsor.name} className="h-7 w-auto object-contain" />;

  return (
    <div className="flex items-center gap-2 mt-2">
      <span className={`text-[10px] uppercase tracking-wider ${labelClass}`}>Court sponsor</span>
      {courtSponsor.url ? (
        <a href={courtSponsor.url} target="_blank" rel="noopener noreferrer" title={courtSponsor.name}>{logo}</a>
      ) : logo}
    </div>
  );
}
