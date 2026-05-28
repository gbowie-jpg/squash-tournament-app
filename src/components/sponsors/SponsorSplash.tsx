'use client';

import { useEffect, useState } from 'react';
import { useSponsors } from '@/lib/useSponsors';

const DEFAULT_DURATION_MS = 3000;
const FADE_MS = 300;

/**
 * Full-screen "Presented by" splash, shown once per session per tournament.
 * Duration is configurable via site_settings.sponsor_splash_duration_ms
 * (default 3000ms). Skip button appears after 500ms.
 *
 * Shows ALL active title-tier sponsors side-by-side (co-sponsor friendly).
 */
export function SponsorSplash({ tournamentId, slug }: { tournamentId: string; slug: string }) {
  const { sponsors } = useSponsors(tournamentId);
  const [show, setShow] = useState(false);
  const [skippable, setSkippable] = useState(false);
  const [fadingOut, setFadingOut] = useState(false);
  const [durationMs, setDurationMs] = useState<number | null>(null);

  const titleSponsors = sponsors.filter((s) => s.tier === 'title' && s.logo_url);

  // Fetch configured duration — sets to a number when ready (use default on failure)
  useEffect(() => {
    fetch('/api/site-settings')
      .then((r) => r.ok ? r.json() : {})
      .then((data: Record<string, string | null>) => {
        const v = parseInt(data.sponsor_splash_duration_ms || '');
        setDurationMs(!isNaN(v) && v > 0 ? v : DEFAULT_DURATION_MS);
      })
      .catch(() => setDurationMs(DEFAULT_DURATION_MS));
  }, []);

  // Only run once durationMs is loaded AND sponsors are loaded
  useEffect(() => {
    if (!slug || titleSponsors.length === 0 || durationMs === null) return;

    // Once per session per tournament
    const key = `sponsor-splash-${slug}`;
    if (typeof window === 'undefined' || sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, '1');

    setShow(true);
    const t1 = setTimeout(() => setSkippable(true), 500);
    const t2 = setTimeout(() => setFadingOut(true), durationMs - FADE_MS);
    const t3 = setTimeout(() => setShow(false), durationMs);

    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, titleSponsors.length, durationMs !== null]);

  if (!show || titleSponsors.length === 0) return null;

  const isMulti = titleSponsors.length > 1;

  return (
    <div
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-white dark:bg-zinc-950 transition-opacity duration-300 ${fadingOut ? 'opacity-0' : 'opacity-100'}`}
      onClick={() => skippable && setShow(false)}
      role="dialog"
      aria-label="Sponsor message"
    >
      <p className="text-xs uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400 mb-6 font-medium">
        {isMulti ? 'Presented by' : 'Presented by'}
      </p>

      <div className="flex flex-wrap items-center justify-center gap-8 sm:gap-12 px-6 max-w-[90vw]">
        {titleSponsors.map((s, i) => (
          <div key={s.id} className="flex flex-col items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={s.logo_url!}
              alt={s.name}
              className={`object-contain ${isMulti ? 'max-h-[120px] sm:max-h-[160px]' : 'max-h-[180px] sm:max-h-[240px]'} max-w-[280px] sm:max-w-[400px]`}
            />
            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{s.name}</p>
            {/* Visual divider between sponsors */}
            {isMulti && i < titleSponsors.length - 1 && (
              <div className="hidden sm:block absolute" />
            )}
          </div>
        ))}
      </div>

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
