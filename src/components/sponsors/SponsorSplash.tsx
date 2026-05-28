'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useSponsors } from '@/lib/useSponsors';

/**
 * Full-screen "Presented by" splash, shown once per session per tournament.
 * Auto-dismisses after 1.8s. Skip button appears after 500ms.
 *
 * Only renders if there's at least one active title-tier sponsor with a logo.
 */
export function SponsorSplash({ tournamentId, slug }: { tournamentId: string; slug: string }) {
  const { sponsors } = useSponsors(tournamentId);
  const [show, setShow] = useState(false);
  const [skippable, setSkippable] = useState(false);
  const [fadingOut, setFadingOut] = useState(false);

  const titleSponsors = sponsors.filter((s) => s.tier === 'title' && s.logo_url);

  useEffect(() => {
    if (!slug || titleSponsors.length === 0) return;

    // Once per session per tournament
    const key = `sponsor-splash-${slug}`;
    if (typeof window === 'undefined' || sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, '1');

    setShow(true);
    const t1 = setTimeout(() => setSkippable(true), 500);
    const t2 = setTimeout(() => setFadingOut(true), 1500);
    const t3 = setTimeout(() => setShow(false), 1800);

    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [slug, titleSponsors.length]);

  if (!show || titleSponsors.length === 0) return null;

  // Pick one title sponsor at random per render to rotate over multiple sessions
  const sponsor = titleSponsors[Math.floor(Math.random() * titleSponsors.length)];

  return (
    <div
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-white dark:bg-zinc-950 transition-opacity duration-300 ${fadingOut ? 'opacity-0' : 'opacity-100'}`}
      onClick={() => skippable && setShow(false)}
      role="dialog"
      aria-label="Sponsor message"
    >
      <p className="text-xs uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400 mb-6 font-medium">
        Presented by
      </p>
      {sponsor.logo_url && (
        <div className="relative w-[280px] h-[140px] sm:w-[400px] sm:h-[200px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={sponsor.logo_url}
            alt={sponsor.name}
            className="w-full h-full object-contain"
          />
        </div>
      )}
      <p className="text-base font-semibold text-zinc-900 dark:text-zinc-100 mt-4">{sponsor.name}</p>

      {skippable && (
        <button
          onClick={() => setShow(false)}
          className="absolute top-4 right-4 text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 transition-colors"
        >
          Skip
        </button>
      )}
    </div>
  );
}
// Image import used implicitly via <img> for now to avoid Next/Image config for arbitrary remote hosts
void Image;
