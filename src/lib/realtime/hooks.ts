'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { MatchWithDetails, Court, Announcement } from '@/lib/supabase/types';

export function useRealtimeMatches(tournamentId: string) {
  const [matches, setMatches] = useState<MatchWithDetails[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMatches = useCallback(async () => {
    if (!tournamentId) return; // Guard — don't fetch with empty ID
    const supabase = createClient();
    const { data } = await supabase
      .from('matches')
      .select('*, player1:players!player1_id(*), player2:players!player2_id(*), court:courts!court_id(*)')
      .eq('tournament_id', tournamentId)
      .order('sort_order');
    setMatches((data as MatchWithDetails[]) ?? []);
    setLoading(false);
  }, [tournamentId]);

  useEffect(() => {
    if (!tournamentId) return; // Don't subscribe with empty ID
    setLoading(true); // Reset so we never flash "not found" between ID changes
    fetchMatches();

    const supabase = createClient();
    const channel = supabase
      .channel(`matches:${tournamentId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'matches',
          filter: `tournament_id=eq.${tournamentId}`,
        },
        () => { fetchMatches(); },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [tournamentId, fetchMatches]);

  return { matches, loading };
}

export function useRealtimeCourts(tournamentId: string) {
  const [courts, setCourts] = useState<Court[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCourts = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from('courts')
      .select('*')
      .eq('tournament_id', tournamentId)
      .order('sort_order');
    setCourts((data as Court[]) ?? []);
    setLoading(false);
  }, [tournamentId]);

  useEffect(() => {
    fetchCourts();

    const supabase = createClient();
    const channel = supabase
      .channel(`courts:${tournamentId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'courts',
          filter: `tournament_id=eq.${tournamentId}`,
        },
        () => { fetchCourts(); },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [tournamentId, fetchCourts]);

  return { courts, loading };
}

export function useRealtimeAnnouncements(tournamentId: string) {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAnnouncements = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from('announcements')
      .select('*')
      .eq('tournament_id', tournamentId)
      .order('created_at', { ascending: false });
    setAnnouncements((data as Announcement[]) ?? []);
    setLoading(false);
  }, [tournamentId]);

  useEffect(() => {
    fetchAnnouncements();

    const supabase = createClient();
    const channel = supabase
      .channel(`announcements:${tournamentId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'announcements',
          filter: `tournament_id=eq.${tournamentId}`,
        },
        () => { fetchAnnouncements(); },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [tournamentId, fetchAnnouncements]);

  return { announcements, loading };
}
