'use client';

import { useEffect, useState } from 'react';
import type { Sponsor } from './supabase/types';

/** Fetch all sponsors for a tournament. Returns active-only by default. */
export function useSponsors(tournamentId: string | undefined, opts: { activeOnly?: boolean } = { activeOnly: true }) {
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tournamentId) return;
    setLoading(true);
    fetch(`/api/tournaments/${tournamentId}/sponsors`)
      .then((r) => r.ok ? r.json() : [])
      .then((data: Sponsor[]) => {
        const filtered = opts.activeOnly ? data.filter((s) => s.active) : data;
        setSponsors(filtered);
      })
      .catch(() => setSponsors([]))
      .finally(() => setLoading(false));
  }, [tournamentId, opts.activeOnly]);

  return { sponsors, loading };
}
