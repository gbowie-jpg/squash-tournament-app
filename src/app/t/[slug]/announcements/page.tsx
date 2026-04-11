'use client';

import { use } from 'react';
import Link from 'next/link';
import { useTournament } from '@/lib/useTournament';
import { useRealtimeAnnouncements } from '@/lib/realtime/hooks';
import TournamentBottomNav from '@/components/layout/TournamentBottomNav';

export default function Announcements({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const { tournament, loading: tLoading } = useTournament(slug);
  const { announcements, loading } = useRealtimeAnnouncements(tournament?.id ?? '');

  if (tLoading || !tournament) {
    return <div className="flex items-center justify-center min-h-screen text-zinc-600">Loading…</div>;
  }

  return (
    <div className="min-h-screen bg-zinc-50 pb-20 md:pb-0">
      <header className="bg-white border-b border-zinc-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <Link href={`/t/${slug}`} className="text-xs text-zinc-500 hover:text-zinc-800 flex items-center gap-1 mb-0.5">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            {tournament.name}
          </Link>
          <h1 className="text-lg font-bold tracking-tight">Announcements</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-4">
        {loading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="bg-white border border-zinc-200 rounded-2xl p-4 animate-pulse">
                <div className="h-4 bg-zinc-100 rounded w-3/4 mb-2" />
                <div className="h-3 bg-zinc-100 rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : announcements.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-4xl mb-3">📢</p>
            <p className="text-zinc-500">No announcements yet. Check back soon.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {announcements.map((a) => (
              <div
                key={a.id}
                className={`border rounded-2xl p-4 ${
                  a.priority === 'urgent'
                    ? 'border-red-200 bg-red-50'
                    : 'bg-white border-zinc-200'
                }`}
              >
                {a.priority === 'urgent' && (
                  <p className="text-xs font-bold text-red-600 uppercase mb-1.5">⚠ Urgent</p>
                )}
                <p className="text-sm leading-relaxed">{a.message}</p>
                <p className="text-xs text-zinc-400 mt-2">
                  {new Date(a.created_at).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center gap-1.5 justify-center mt-8 pb-4">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-xs text-zinc-500">Updates automatically</span>
        </div>
      </main>

      <TournamentBottomNav slug={slug} />
    </div>
  );
}
