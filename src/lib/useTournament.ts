'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Tournament } from '@/lib/supabase/types';

export function useTournament(slug: string) {
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from('tournaments')
      .select('*')
      .eq('slug', slug)
      .single()
      .then(({ data }) => {
        setTournament(data as Tournament | null);
        setLoading(false);
      });
  }, [slug]);

  return { tournament, loading };
}
