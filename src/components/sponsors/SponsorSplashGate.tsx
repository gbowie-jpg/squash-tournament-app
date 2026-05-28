'use client';

import { use } from 'react';
import { useTournament } from '@/lib/useTournament';
import { SponsorSplash } from './SponsorSplash';

/**
 * Wrapper that resolves the slug → tournament.id then renders the splash.
 * Designed to drop into a server-side layout file.
 */
export function SponsorSplashGate({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const { tournament } = useTournament(slug);
  if (!tournament) return null;
  return <SponsorSplash tournamentId={tournament.id} slug={slug} />;
}
