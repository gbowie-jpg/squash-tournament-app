import Link from 'next/link';
import { ChevronRight, LayoutGrid, ListOrdered, Trophy, Users, type LucideIcon } from 'lucide-react';
import type { SeasonData } from '@/lib/league/db';
import { formatLeagueDate, pacificToday } from '@/lib/league/time';
import type { PnwTournament } from '@/lib/tournaments/pnw';
import type { Tournament } from '@/lib/supabase/types';

type Tile = {
  title: string;
  desc: string;
  Icon: LucideIcon;
  accent: string;         // icon tint; inline so Tailwind can't purge it
  href?: string;          // absent = coming soon
  status?: string;
  live?: boolean;
  detail?: string;
};

/**
 * "What do you want to play?" — the four ways to use the app. Status lines
 * come from live data; tiles without an href are shown as coming soon.
 */
export default function HomeGrid({
  league,
  liveLeagueNight,
  appTournaments,
  pnwTournaments,
}: {
  league: SeasonData | null;
  liveLeagueNight: boolean;
  appTournaments: Tournament[];
  pnwTournaments: PnwTournament[];
}) {
  const today = pacificToday();

  // Winter League
  const nextNight = league?.fixtures.find((f) => f.match_date >= today)?.match_date;
  const nightCount = nextNight ? league!.fixtures.filter((f) => f.match_date === nextNight).length : 0;
  const leagueTile: Tile = {
    title: 'Winter League',
    desc: 'Team matches every Tuesday and Friday, November to March.',
    Icon: Users,
    accent: '#2563eb',
    href: '/league',
    live: liveLeagueNight,
    status: !league
      ? undefined
      : liveLeagueNight
        ? `Live now · ${nightCount} matches tonight`
        : nextNight === today
          ? `Tonight · ${nightCount} matches`
          : nextNight
              ? `Next: ${formatLeagueDate(nextNight)} · ${nightCount} matches`
            : 'Season complete',
    detail: league ? `${league.teams.length} teams · ${league.divisions.length} divisions` : undefined,
  };

  // Tournaments: a live app tournament beats everything, then the next PNW event.
  const activeApp = appTournaments.find((t) => t.status === 'active');
  const nextPnw = pnwTournaments[0];
  const tournamentTile: Tile = {
    title: 'Tournaments',
    desc: 'Events across Washington and Oregon, with live draws and scores for SSRA tournaments.',
    Icon: Trophy,
    accent: '#d97706',
    href: '/tournaments',
    live: !!activeApp,
    status: activeApp
      ? `Live now · ${activeApp.name}`
      : nextPnw
        ? `Next: ${nextPnw.name.replace(/^\d{4}\s+/, '').replace(/\s*\(.*\)\s*$/, '')} ·${formatLeagueDate(nextPnw.startDate, { month: 'short', day: 'numeric' })}`
        : undefined,
    detail: pnwTournaments.length ? `${pnwTournaments.length} upcoming in the Pacific Northwest` : undefined,
  };

  const tiles: Tile[] = [
    leagueTile,
    tournamentTile,
    {
      title: 'Box Leagues',
      desc: 'Groups of 5–6 by rating. Play everyone on your own schedule, then move up or down a box.',
      Icon: LayoutGrid,
      accent: '#059669',
    },
    {
      title: 'Ladders',
      desc: 'Challenge players above you and climb. Both players confirm the result.',
      Icon: ListOrdered,
      accent: '#7c3aed',
    },
  ];

  return (
    <section className="max-w-6xl mx-auto w-full px-4 pt-8 pb-4">
      <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-4">What do you want to play?</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
        {tiles.map((t) => <GridTile key={t.title} tile={t} />)}
      </div>
    </section>
  );
}

function GridTile({ tile: t }: { tile: Tile }) {
  const comingSoon = !t.href;
  const body = (
    <>
      <div className="flex items-start gap-3">
        <span
          className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: `${t.accent}1f`, color: t.accent }}
        >
          <t.Icon className="w-6 h-6" aria-hidden />
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-lg text-[var(--text-primary)]">{t.title}</h3>
            {comingSoon && (
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full border border-[var(--border)] text-[var(--text-muted)]">
                Coming soon
              </span>
            )}
          </div>
          <p className="text-sm text-[var(--text-secondary)] mt-1 leading-snug">{t.desc}</p>
        </div>
        {!comingSoon && <ChevronRight className="w-5 h-5 shrink-0 text-[var(--text-muted)] mt-1" aria-hidden />}
      </div>
      {(t.status || t.detail) && (
        <div className="mt-4 pt-3 border-t border-[var(--border)] text-sm">
          {t.status && (
            <p className="font-medium truncate" style={{ color: t.live ? '#dc2626' : 'var(--text-primary)' }}>
              {t.live && '● '}{t.status}
            </p>
          )}
          {t.detail && <p className="text-xs text-[var(--text-muted)] mt-0.5">{t.detail}</p>}
        </div>
      )}
    </>
  );

  const cls = 'block h-full bg-[var(--surface-card)] border border-[var(--border)] rounded-2xl p-4 md:p-5';
  return comingSoon ? (
    <div className={cls} style={{ opacity: 0.75 }}>{body}</div>
  ) : (
    <Link href={t.href!} className={`${cls} hover:border-blue-400 hover:shadow-md transition-all`}>{body}</Link>
  );
}
