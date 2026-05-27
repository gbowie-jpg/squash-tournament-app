'use client';

import { use, useEffect, useRef, useState, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useTournament } from '@/lib/useTournament';
import { useRealtimeMatches, useRealtimeCourts } from '@/lib/realtime/hooks';
import { formatScore } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import type { Court, MatchWithDetails } from '@/lib/supabase/types';
import type { BracketMatch } from '@/components/tournament/Bracket';
import Bracket from '@/components/tournament/Bracket';
import TournamentBottomNav from '@/components/layout/TournamentBottomNav';
import { ChevronLeft, Search, LogOut } from 'lucide-react';
import PullToRefresh from '@/components/PullToRefresh';
import RefreshButton from '@/components/RefreshButton';
import ThemeToggle from '@/components/ThemeToggle';

const COURT_STATUS_COLORS: Record<string, string> = {
  available: 'border-green-400 dark:border-green-700 bg-green-50 dark:bg-green-950/30',
  in_use: 'border-amber-400 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30',
  maintenance: 'border-[var(--border)] bg-[var(--surface-card)]',
};

const COURT_STATUS_COLORS_KIOSK: Record<string, string> = {
  available: 'border-green-500 bg-green-950/40',
  in_use: 'border-amber-400 bg-amber-950/40',
  maintenance: 'border-zinc-700 bg-zinc-900/60',
};

const COURT_STATUS_DOT: Record<string, string> = {
  available: 'bg-green-500',
  in_use: 'bg-amber-500 animate-pulse',
  maintenance: 'bg-[var(--text-muted)]',
};

type KioskTab = 'courts' | 'bracket';

function KioskClock() {
  const [time, setTime] = useState('');
  useEffect(() => {
    const tick = () =>
      setTime(new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return <span className="text-3xl font-bold tabular-nums text-white/80">{time}</span>;
}

function CourtBoardInner({ slug }: { slug: string }) {
  const searchParams = useSearchParams();
  const isKiosk = searchParams.get('kiosk') === '1';

  const { tournament, loading: tLoading } = useTournament(slug);
  const { matches, loading: mLoading } = useRealtimeMatches(tournament?.id ?? '');
  const { courts, loading: cLoading } = useRealtimeCourts(tournament?.id ?? '');

  // Player search (normal mode only)
  const [playerSearch, setPlayerSearch] = useState('');

  // Tab initialised from URL so reloads land on the same tab
  const initialTab = (searchParams.get('tab') === 'bracket' ? 'bracket' : 'courts') as KioskTab;
  const [kioskTab, setKioskTab] = useState<KioskTab>(initialTab);

  function switchTab(tab: KioskTab) {
    setKioskTab(tab);
    if (isKiosk) {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', tab);
      window.history.replaceState(null, '', url.toString());
    }
  }

  // Bracket data — fetched once when bracket tab is first opened
  const [bracketMatches, setBracketMatches] = useState<BracketMatch[]>([]);
  const [bracketLoading, setBracketLoading] = useState(false);
  const [activeDraw, setActiveDraw] = useState('');

  const fetchBracket = useCallback(async (tournamentId: string) => {
    setBracketLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from('matches')
      .select(`
        id, match_number, draw, round, status, scheduled_time,
        winner_id, scores, notes,
        player1:players!player1_id(id, name, seed),
        player2:players!player2_id(id, name, seed)
      `)
      .eq('tournament_id', tournamentId)
      .neq('status', 'cancelled')
      .order('sort_order')
      .order('match_number');
    const rows = (data || []) as unknown as BracketMatch[];
    setBracketMatches(rows);
    const draws = [...new Set(rows.map((m) => m.draw).filter(Boolean))] as string[];
    if (draws.length > 0) setActiveDraw((prev) => prev || draws[0]);
    setBracketLoading(false);
  }, []);

  // Fetch bracket when tab opens
  useEffect(() => {
    if (!isKiosk || kioskTab !== 'bracket' || !tournament?.id) return;
    fetchBracket(tournament.id);
  }, [isKiosk, kioskTab, tournament?.id, fetchBracket]);

  // Auto-refresh every 60 seconds — reloads same URL so tab param is preserved
  useEffect(() => {
    if (!isKiosk) return;
    const id = setInterval(() => window.location.reload(), 60_000);
    return () => clearInterval(id);
  }, [isKiosk]);

  if (tLoading || !tournament) {
    return (
      <div
        className="flex items-center justify-center min-h-screen"
        style={isKiosk ? { background: '#0a0a0a', color: '#fff' } : { color: 'var(--text-secondary)' }}
      >
        Loading…
      </div>
    );
  }

  const loading = mLoading || cLoading;

  const getCourtMatches = (court: Court) => {
    const courtMatches = matches.filter((m) => m.court_id === court.id);
    const current = courtMatches.find((m) => m.status === 'in_progress');
    const onDeck = courtMatches.find((m) => m.status === 'on_deck');
    const nextScheduled = courtMatches.find((m) => m.status === 'scheduled');
    return { current, next: onDeck || nextScheduled };
  };

  // ─── Kiosk layout ────────────────────────────────────────────────────────────
  if (isKiosk) {
    const drawNames = [...new Set(bracketMatches.map((m) => m.draw).filter(Boolean))] as string[];
    const drawMatches = bracketMatches.filter((m) => m.draw === activeDraw);

    return (
      <div className="h-screen overflow-hidden flex flex-col" style={{ background: '#0a0a0a' }}>
        {/* Kiosk header */}
        <header className="px-6 py-4 flex items-center justify-between border-b border-white/10 shrink-0">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
              <span className="text-green-400 text-sm font-bold uppercase tracking-widest">Live</span>
            </span>
            <span className="text-white/30 text-sm">·</span>
            <span className="text-white font-bold text-lg">{tournament.name}</span>
          </div>
          <div className="flex items-center gap-4">
            <KioskClock />
            <Link
              href={`/t/${slug}/courts`}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/20 text-white/40 hover:text-white hover:border-white/50 transition-colors text-xs font-medium"
              title="Exit kiosk mode"
            >
              <LogOut className="w-3.5 h-3.5" />
              Exit
            </Link>
          </div>
        </header>

        {/* Content area — minimal padding to maximise space */}
        <main className="flex-1 overflow-hidden p-3">

          {/* Courts tab */}
          {kioskTab === 'courts' && (
            loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="rounded-2xl p-6 animate-pulse border border-white/10 bg-white/5" style={{ minHeight: 180 }} />
                ))}
              </div>
            ) : courts.length === 0 ? (
              <p className="text-white/50 text-center py-20 text-lg">No courts set up yet.</p>
            ) : (
              <div className={`grid gap-4 h-full ${
                courts.length <= 3 ? 'grid-cols-1 sm:grid-cols-3' :
                courts.length <= 6 ? 'grid-cols-2 sm:grid-cols-3' :
                'grid-cols-2 sm:grid-cols-4'
              }`}>
                {courts.map((court) => {
                  const { current, next } = getCourtMatches(court);
                  return (
                    <div
                      key={court.id}
                      className={`border-2 rounded-2xl p-5 flex flex-col transition-all ${COURT_STATUS_COLORS_KIOSK[court.status]}`}
                    >
                      <div className="flex items-center justify-between mb-4">
                        <h2 className="font-bold text-xl text-white">{court.name}</h2>
                        <span className={`w-4 h-4 rounded-full ${COURT_STATUS_DOT[court.status]}`} />
                      </div>

                      {current ? (
                        <div className="flex-1">
                          <p className="text-xs font-bold text-green-400 uppercase tracking-widest mb-2">Now Playing</p>
                          <KioskMatchDisplay match={current} />
                        </div>
                      ) : court.status === 'maintenance' ? (
                        <p className="text-white/40 text-base flex-1">Under maintenance</p>
                      ) : (
                        <p className="text-white/40 text-base flex-1">Court available</p>
                      )}

                      {next && (
                        <div className="mt-4 pt-4 border-t border-white/10">
                          <p className="text-xs font-bold text-amber-400 uppercase tracking-widest mb-2">
                            {next.status === 'on_deck' ? 'On Deck' : 'Up Next'}
                          </p>
                          <KioskMatchDisplay match={next} compact />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )
          )}

          {/* Bracket tab */}
          {kioskTab === 'bracket' && (
            <div className="flex flex-col h-full">
              {/* Draw selector */}
              {drawNames.length > 1 && (
                <div className="flex gap-2 mb-3 shrink-0">
                  {drawNames.map((d) => (
                    <button
                      key={d}
                      onClick={() => setActiveDraw(d)}
                      className={`px-4 py-1.5 rounded-xl text-sm font-semibold border transition-colors ${
                        activeDraw === d
                          ? 'bg-white text-black border-white'
                          : 'border-white/20 text-white/60 hover:text-white hover:border-white/40'
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              )}

              {bracketLoading ? (
                <div className="flex-1 flex items-center justify-center text-white/50">Loading bracket…</div>
              ) : drawMatches.length === 0 ? (
                <div className="flex-1 flex items-center justify-center text-white/50 text-lg">
                  {drawNames.length === 0 ? 'Draws not published yet.' : 'No matches in this draw.'}
                </div>
              ) : (
                <KioskBracketFit matches={drawMatches} slug={slug} />
              )}
            </div>
          )}
        </main>

        {/* Kiosk tab bar */}
        <nav className="shrink-0 border-t border-white/10 flex" style={{ background: '#111' }}>
          {([
            { id: 'courts', label: 'Courts' },
            { id: 'bracket', label: 'Bracket' },
          ] as const).map((tab) => (
            <button
              key={tab.id}
              onClick={() => switchTab(tab.id)}
              className={`flex-1 py-4 text-sm font-bold uppercase tracking-widest transition-colors ${
                kioskTab === tab.id
                  ? 'text-white border-t-2 border-white'
                  : 'text-white/40 hover:text-white/70'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>
    );
  }

  // ─── Normal layout ────────────────────────────────────────────────────────────

  // Helper: does this match involve the searched player?
  const q = playerSearch.trim().toLowerCase();
  const matchHasPlayer = (m: MatchWithDetails) =>
    !!q && !!(m.player1?.name?.toLowerCase().includes(q) || m.player2?.name?.toLowerCase().includes(q));

  return (
    <PullToRefresh>
    <div className="min-h-screen bg-[var(--surface)] pb-20 md:pb-0">
      <header className="bg-[var(--surface-card)] border-b border-[var(--border)] sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 pt-3 pb-2">
          <div className="flex items-center justify-between mb-2">
            <div>
              <Link href={`/t/${slug}`} className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center gap-1 mb-0.5">
                <ChevronLeft className="w-3.5 h-3.5" /> {tournament.name}
              </Link>
              <h1 className="text-lg font-bold tracking-tight text-[var(--text-primary)]">Court Board</h1>
            </div>
            <div className="flex items-center gap-1">
              <span className="flex items-center gap-1.5 mr-1">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-xs text-[var(--text-secondary)] font-medium">Live</span>
              </span>
              <ThemeToggle />
              <RefreshButton />
            </div>
          </div>
          {/* Player self-lookup */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" strokeWidth={1.5} />
            <input
              type="search"
              placeholder="Find my matches — type your name…"
              value={playerSearch}
              onChange={(e) => setPlayerSearch(e.target.value)}
              className="w-full border border-[var(--border)] rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-[var(--surface)] text-[var(--text-primary)]"
            />
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-4">
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-[var(--surface-card)] border border-[var(--border)] rounded-2xl p-5 animate-pulse">
                <div className="h-5 bg-surface rounded w-24 mb-4" />
                <div className="h-4 bg-surface rounded w-full mb-2" />
                <div className="h-4 bg-surface rounded w-3/4" />
              </div>
            ))}
          </div>
        ) : courts.length === 0 ? (
          <p className="text-[var(--text-secondary)] text-center py-16">No courts set up yet.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {courts.map((court) => {
              const { current, next } = getCourtMatches(court);
              const isPlayerCourt = !!q && ((!!current && matchHasPlayer(current)) || (!!next && matchHasPlayer(next)));
              return (
                <div
                  key={court.id}
                  className={`border-2 rounded-2xl p-4 transition-all ${COURT_STATUS_COLORS[court.status]}${
                    q ? (isPlayerCourt ? ' ring-2 ring-blue-500 ring-offset-2 ring-offset-[var(--surface)]' : ' opacity-40') : ''
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="font-bold text-base text-[var(--text-primary)]">{court.name}</h2>
                    <div className="flex items-center gap-2">
                      {isPlayerCourt && (
                        <span className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wide">👤 You</span>
                      )}
                      <span className={`w-3 h-3 rounded-full ${COURT_STATUS_DOT[court.status]}`} />
                    </div>
                  </div>

                  {current ? (
                    <div className="mb-3">
                      <p className="text-xs font-semibold text-green-700 dark:text-green-400 uppercase tracking-wider mb-1.5">Now Playing</p>
                      <MatchDisplay match={current} slug={slug} />
                    </div>
                  ) : court.status === 'maintenance' ? (
                    <p className="text-sm text-[var(--text-secondary)] mb-3">Under maintenance</p>
                  ) : (
                    <p className="text-sm text-[var(--text-secondary)] mb-3">Court available</p>
                  )}

                  {next && (
                    <div className="pt-3 border-t border-border/60">
                      <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider mb-1.5">
                        {next.status === 'on_deck' ? 'On Deck' : 'Up Next'}
                      </p>
                      <MatchDisplay match={next} compact slug={slug} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      <TournamentBottomNav slug={slug} />
    </div>
    </PullToRefresh>
  );
}

// Mirror layout constants from Bracket.tsx to compute natural dimensions
const B_CARD_W = 220;
const B_COL_GAP = 44;
const B_SLOT_H = 128;
const B_LABEL_H = 24;
const B_NAMED_ORDER: Record<string, number> = { F: 100, SF: 90, QF: 80 };
function bRoundOrder(r: string): number {
  if (B_NAMED_ORDER[r] !== undefined) return B_NAMED_ORDER[r];
  const m = r.match(/^R(\d+)$/);
  return m ? parseInt(m[1]) : 50;
}

function KioskBracketFit({ matches, slug }: { matches: BracketMatch[]; slug: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState({ scale: 1, colGap: B_COL_GAP, x: 0, y: 0 });

  const roundNames = [...new Set(matches.map((m) => m.round))].sort(
    (a, b) => bRoundOrder(a) - bRoundOrder(b),
  );
  const byRound: Record<string, BracketMatch[]> = {};
  for (const r of roundNames) byRound[r] = matches.filter((m) => m.round === r);
  const firstCount = byRound[roundNames[0]]?.length ?? 1;
  const numRounds  = roundNames.length;
  const naturalH   = B_LABEL_H + firstCount * B_SLOT_H + 16;

  useEffect(() => {
    function measure() {
      if (!containerRef.current) return;
      const { width, height } = containerRef.current.getBoundingClientRect();
      if (!width || !height) return;

      // Compute the column gap that fills the viewport width at the height-fit scale.
      // naturalW = numRounds * (CARD_W + gap) - gap + 8  =>  gap = (targetW - numRounds*CARD_W - 8) / (numRounds-1)
      const scaleH = height / naturalH;
      const targetW = width / scaleH;
      const idealGap = numRounds > 1
        ? (targetW - numRounds * B_CARD_W - 8) / (numRounds - 1)
        : B_COL_GAP;
      const colGap  = Math.max(B_COL_GAP, Math.round(idealGap));
      const naturalW = numRounds * (B_CARD_W + colGap) - colGap + 8;
      const scale   = Math.min(width / naturalW, height / naturalH);

      setFit({
        scale,
        colGap,
        x: Math.max(0, (width  - naturalW * scale) / 2),
        y: Math.max(0, (height - naturalH * scale) / 2),
      });
    }
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [naturalH, numRounds]);

  const naturalW = numRounds * (B_CARD_W + fit.colGap) - fit.colGap + 8;

  return (
    <div ref={containerRef} className="flex-1 overflow-hidden">
      <div style={{
        transform: `scale(${fit.scale})`,
        transformOrigin: 'top left',
        width: naturalW,
        height: naturalH,
        marginLeft: fit.x,
        marginTop: fit.y,
      }}>
        <Bracket matches={matches} slug={slug} colGap={fit.colGap} />
      </div>
    </div>
  );
}

function KioskMatchDisplay({ match: m, compact }: { match: MatchWithDetails; compact?: boolean }) {
  return (
    <div>
      <p className={`font-bold text-white ${compact ? 'text-base' : 'text-xl'}`}>
        {m.player1?.name || 'TBD'}
      </p>
      <p className={`text-white/40 ${compact ? 'text-xs' : 'text-sm'} my-0.5`}>vs</p>
      <p className={`font-bold text-white ${compact ? 'text-base' : 'text-xl'}`}>
        {m.player2?.name || 'TBD'}
      </p>
      <div className="flex items-center gap-2 mt-1.5">
        {m.draw && <span className={`text-white/50 ${compact ? 'text-xs' : 'text-sm'}`}>{m.draw}</span>}
        {m.round && <span className={`text-white/50 ${compact ? 'text-xs' : 'text-sm'}`}>· {m.round}</span>}
      </div>
      {m.scores && m.scores.length > 0 && (
        <p className={`font-mono font-bold mt-1.5 text-green-400 ${compact ? 'text-sm' : 'text-2xl'}`}>
          {formatScore(m.scores)}
        </p>
      )}
    </div>
  );
}

function MatchDisplay({ match: m, compact, slug }: { match: MatchWithDetails; compact?: boolean; slug: string }) {
  return (
    <Link href={`/t/${slug}/match/${m.id}`} className="block group">
      <p className={`font-semibold text-[var(--text-primary)] group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors ${compact ? 'text-sm' : ''}`}>
        {m.player1?.name || 'TBD'} <span className="text-[var(--text-muted)] font-normal">vs</span> {m.player2?.name || 'TBD'}
      </p>
      <div className="flex items-center gap-2 mt-0.5">
        {m.draw && <span className="text-xs text-[var(--text-secondary)]">{m.draw}</span>}
        {m.round && <span className="text-xs text-[var(--text-secondary)]">· {m.round}</span>}
      </div>
      {m.scores && m.scores.length > 0 && (
        <p className="text-sm font-mono font-semibold mt-1 text-[var(--text-primary)]">{formatScore(m.scores)}</p>
      )}
      {!compact && m.scheduled_time && (
        <p className="text-xs text-[var(--text-secondary)] mt-1">
          {new Date(m.scheduled_time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
        </p>
      )}
    </Link>
  );
}

export default function CourtBoard({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen text-[var(--text-secondary)]">Loading…</div>}>
      <CourtBoardInner slug={slug} />
    </Suspense>
  );
}
