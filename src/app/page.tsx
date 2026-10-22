import { redirect } from 'next/navigation';
import SiteNav from '@/components/layout/SiteNav';
import SiteFooter from '@/components/layout/SiteFooter';
import HomeGrid from '@/components/home/HomeGrid';
import LeagueHub from '@/components/league/LeagueHub';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { Tournament } from '@/lib/supabase/types';
import { loadCurrentSeason, loadLiveFixtureIds } from '@/lib/league/db';
import { pacificToday } from '@/lib/league/time';
import { fetchPnwTournaments } from '@/lib/tournaments/pnw';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const featuredSlug = process.env.NEXT_PUBLIC_FEATURED_SLUG;
  if (featuredSlug) {
    redirect(`/t/${featuredSlug}/register`);
  }

  const supabase = await createServerSupabaseClient();

  const [{ data: tournaments }, league, pnwTournaments] = await Promise.all([
    supabase.from('tournaments').select('*').order('start_date', { ascending: false }),
    loadCurrentSeason(),
    fetchPnwTournaments(),
  ]);

  const today = pacificToday();
  const tonight = (league?.fixtures ?? []).filter((f) => f.match_date === today).map((f) => f.id);
  const liveLeagueNight = (await loadLiveFixtureIds(tonight)).size > 0;

  // News, about, donations etc. live on seattlesquash.com — this page is the
  // app's home: the ways to play, then this week in the league.
  return (
    <div className="min-h-screen flex flex-col bg-[var(--surface)]">
      <SiteNav />

      <h1 className="sr-only">Seattle Squash</h1>

      <HomeGrid
        league={league}
        liveLeagueNight={liveLeagueNight}
        appTournaments={(tournaments ?? []) as Tournament[]}
        pnwTournaments={pnwTournaments}
      />

      <div className="flex-1">
        <LeagueHub league={league} />
      </div>

      <SiteFooter />
    </div>
  );
}
