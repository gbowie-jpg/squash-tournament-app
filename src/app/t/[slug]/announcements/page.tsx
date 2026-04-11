'use client';

import { use } from 'react';
import Link from 'next/link';
import { useTournament } from '@/lib/useTournament';
import { useRealtimeAnnouncements } from '@/lib/realtime/hooks';
import TournamentBottomNav from '@/components/layout/TournamentBottomNav';
import { ChevronLeft, AlertTriangle, Radio } from 'lucide-react';
import PullToRefresh from '@/components/PullToRefresh';
import RefreshButton from '@/components/RefreshButton';
import ThemeToggle from '@/components/ThemeToggle';

export default function Announcements({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const { tournament, loading: tLoading } = useTournament(slug);
  const { announcements, loading } = useRealtimeAnnouncements(tournament?.id ?? '');

  if (tLoading || !tournament) {
    return <div className="flex items-center justify-center min-h-screen text-[var(--text-secondary)]">Loading…</div>;
  }

  return (
    <PullToRefresh>
    <div className="min-h-screen bg-[var(--surface)] pb-20 md:pb-0">
      <header className="bg-[var(--surface-card)] border-b border-[var(--border)] sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <Link href={`/t/${slug}`} className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center gap-1 mb-0.5">
              <ChevronLeft className="w-3.5 h-3.5" /> {tournament.name}
            </Link>
            <h1 className="text-lg font-bold tracking-tight text-[var(--text-primary)]">Announcements</h1>
          </div>
          <ThemeToggle />
          <RefreshButton />
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-4">
        {loading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="bg-[var(--surface-card)] border border-[var(--border)] rounded-2xl p-4 animate-pulse">
                <div className="h-4 bg-zinc-100 dark:bg-zinc-800 rounded w-3/4 mb-2" />
                <div className="h-3 bg-zinc-100 dark:bg-zinc-800 rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : announcements.length === 0 ? (
          <div className="text-center py-16">
            <Radio className="w-8 h-8 text-zinc-300 dark:text-zinc-700 mx-auto mb-3" strokeWidth={1.5} />
            <p className="text-[var(--text-secondary)]">No announcements yet. Check back soon.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {announcements.map((a) => (
              <div
                key={a.id}
                className={`border rounded-2xl p-4 ${
                  a.priority === 'urgent'
                    ? 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30'
                    : 'bg-[var(--surface-card)] border-[var(--border)]'
                }`}
              >
                {a.priority === 'urgent' && (
                  <p className="text-xs font-bold text-red-600 dark:text-red-400 uppercase mb-1.5 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" /> Urgent
                  </p>
                )}
                <p className="text-sm leading-relaxed text-[var(--text-primary)]">{a.message}</p>
                <p className="text-xs text-[var(--text-muted)] mt-2">
                  {new Date(a.created_at).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center gap-1.5 justify-center mt-8 pb-4">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-xs text-[var(--text-secondary)]">Updates automatically</span>
        </div>
      </main>

      <TournamentBottomNav slug={slug} />
    </div>
    </PullToRefresh>
  );
}
