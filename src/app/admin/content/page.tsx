'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import type { Tournament } from '@/lib/supabase/types';

function LoadingSkeleton() {
  return (
    <div className="min-h-screen bg-surface">
      <header className="bg-card border-b border-border sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-5 flex items-center justify-between">
          <div>
            <div className="h-4 w-24 bg-surface rounded animate-pulse" />
            <div className="h-6 w-32 bg-surface rounded animate-pulse mt-1" />
          </div>
          <div className="h-9 w-28 bg-surface rounded-lg animate-pulse" />
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-4 py-8 space-y-8">
        {[1].map((i) => (
          <div key={i} className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-border">
              <div className="h-5 w-40 bg-surface rounded animate-pulse" />
              <div className="h-3 w-64 bg-surface rounded animate-pulse mt-2" />
            </div>
            <div className="p-6 space-y-4">
              {[1, 2, 3].map((j) => (
                <div key={j} className="h-10 bg-surface rounded-lg animate-pulse" />
              ))}
            </div>
          </div>
        ))}
      </main>
    </div>
  );
}

export default function ContentAdmin() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch('/api/tournaments')
      .then((r) => r.json())
      .then((t) => {
        setTournaments(t);
        setLoaded(true);
      });
  }, []);

  if (!loaded) return <LoadingSkeleton />;

  const upcomingTournaments = tournaments.filter((t) => t.status !== 'completed');
  const pastTournaments = tournaments.filter((t) => t.status === 'completed');

  // The homepage hero editor lived here; the app homepage no longer has a
  // marketing hero (site content is on seattlesquash.com).
  return (
    <div className="min-h-screen bg-surface">
      <header className="bg-card border-b border-border sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-5">
          <Link href="/admin" className="text-sm text-muted-foreground hover:text-foreground">&larr; Dashboard</Link>
          <h1 className="text-xl font-bold tracking-tight mt-0.5 text-foreground">Tournament Graphics</h1>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-8">

        {/* Tournament Hero Images */}
        <section className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-border">
            <h2 className="font-semibold text-foreground">Tournament Hero Images</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Each tournament has its own graphic — click to edit</p>
          </div>
          <div className="divide-y divide-border">
            {[...upcomingTournaments, ...pastTournaments].map((t) => (
              <div key={t.id} className="flex items-center gap-4 px-6 py-4">
                <div className="w-14 h-14 rounded-lg overflow-hidden shrink-0 bg-surface flex items-center justify-center border border-border">
                  {t.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={t.image_url} alt={t.name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-2xl">🏆</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground truncate">{t.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {new Date(t.start_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    {t.hero_image_url && <span className="ml-2 text-green-600">✓ Hero bg</span>}
                    {t.image_url && <span className="ml-2 text-blue-600">✓ Graphic</span>}
                    {!t.hero_image_url && !t.image_url && <span className="ml-2 text-dim">No images</span>}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Link
                    href={`/t/${t.slug}/admin/settings`}
                    className="text-xs bg-surface hover:bg-surface text-foreground px-3 py-1.5 rounded-lg transition-colors font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    Edit Image
                  </Link>
                  <a href={`/t/${t.slug}`} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:underline">View →</a>
                </div>
              </div>
            ))}
            {tournaments.length === 0 && (
              <div className="px-6 py-10 text-center">
                <p className="text-2xl mb-2">🏟️</p>
                <p className="text-sm text-muted-foreground">No tournaments yet.</p>
                <p className="text-xs text-dim mt-1">Create a tournament to manage its hero images here.</p>
              </div>
            )}
          </div>
        </section>

      </main>
    </div>
  );
}
