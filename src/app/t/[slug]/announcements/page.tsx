'use client';

import { use } from 'react';
import Link from 'next/link';
import { useTournament } from '@/lib/useTournament';
import { useRealtimeAnnouncements } from '@/lib/realtime/hooks';

export default function Announcements({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const { tournament, loading: tLoading } = useTournament(slug);
  const { announcements, loading } = useRealtimeAnnouncements(tournament?.id ?? '');

  if (tLoading || !tournament) {
    return <div className="flex items-center justify-center min-h-screen text-zinc-600">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="bg-white border-b border-zinc-200">
        <div className="max-w-2xl mx-auto px-4 py-6">
          <Link href={`/t/${slug}`} className="text-sm text-zinc-600 hover:text-zinc-800">&larr; {tournament.name}</Link>
          <h1 className="text-2xl font-bold tracking-tight mt-2">Announcements</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        {loading ? (
          <p className="text-zinc-600 text-center py-12">Loading...</p>
        ) : announcements.length === 0 ? (
          <p className="text-zinc-600 text-center py-12">No announcements yet. Check back soon.</p>
        ) : (
          <div className="space-y-3">
            {announcements.map((a) => (
              <div
                key={a.id}
                className={`border rounded-xl p-4 ${
                  a.priority === 'urgent'
                    ? 'border-red-200 bg-red-50'
                    : 'bg-white border-zinc-200'
                }`}
              >
                {a.priority === 'urgent' && (
                  <p className="text-xs font-semibold text-red-600 uppercase mb-1">⚠ Urgent</p>
                )}
                <p className="text-sm">{a.message}</p>
                <p className="text-xs text-zinc-600 mt-2">
                  {new Date(a.created_at).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center gap-1.5 justify-center mt-8">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-xs text-zinc-600">Updates automatically</span>
        </div>
      </main>
    </div>
  );
}
