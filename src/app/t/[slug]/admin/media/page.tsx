'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useTournament } from '@/lib/useTournament';
import ThemeToggle from '@/components/ThemeToggle';
import RefreshButton from '@/components/RefreshButton';
import { ChevronLeft, Trash2, ImageOff, Play, X } from 'lucide-react';
import type { MatchMedia } from '@/lib/supabase/types';

type MediaItem = MatchMedia & {
  match: {
    id: string;
    draw: string | null;
    round: string | null;
    player1: { name: string } | null;
    player2: { name: string } | null;
  } | null;
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export default function AdminMediaPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const { tournament, loading: tLoading } = useTournament(slug);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'photo' | 'video'>('all');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<MediaItem | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadMedia = async (tournamentId: string) => {
    setLoading(true);
    const res = await fetch(`/api/tournaments/${tournamentId}/media`);
    if (res.ok) setMedia(await res.json());
    setLoading(false);
  };

  useEffect(() => {
    if (!tournament) return;
    loadMedia(tournament.id);
  }, [tournament]);

  const handleDelete = async (item: MediaItem) => {
    if (!tournament) return;
    if (!confirm('Remove this item? This cannot be undone.')) return;
    setError(null);
    setDeletingId(item.id);
    try {
      const res = await fetch(
        `/api/tournaments/${tournament.id}/media?mediaId=${item.id}`,
        { method: 'DELETE' },
      );
      if (res.ok) {
        setMedia((prev) => prev.filter((m) => m.id !== item.id));
        if (lightbox?.id === item.id) setLightbox(null);
      } else {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? 'Delete failed');
      }
    } catch {
      setError('Network error — please try again');
    } finally {
      setDeletingId(null);
    }
  };

  const filtered = media.filter((m) => filter === 'all' || m.type === filter);
  const photoCount = media.filter((m) => m.type === 'photo').length;
  const videoCount = media.filter((m) => m.type === 'video').length;

  if (tLoading) {
    return <div className="flex items-center justify-center min-h-screen text-[var(--text-secondary)]">Loading…</div>;
  }

  return (
    <div className="min-h-screen bg-[var(--surface)]">
      {/* Header */}
      <header className="bg-[var(--surface-card)] border-b border-[var(--border)] sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link
            href={`/t/${slug}/admin`}
            className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] p-1 -ml-1"
            aria-label="Back"
          >
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-[var(--text-muted)] truncate">{tournament?.name}</p>
            <h1 className="font-bold text-[var(--text-primary)] leading-tight">Match Media</h1>
          </div>
          <RefreshButton className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]" />
          <ThemeToggle />
        </div>

        {/* Filter tabs */}
        <div className="max-w-5xl mx-auto px-4 pb-3 flex gap-2">
          {(['all', 'photo', 'video'] as const).map((f) => {
            const count = f === 'all' ? media.length : f === 'photo' ? photoCount : videoCount;
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                  filter === f
                    ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900'
                    : 'bg-[var(--surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
                {count > 0 && <span className="ml-1.5 opacity-60 font-normal">{count}</span>}
              </button>
            );
          })}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        {error && (
          <div className="mb-4 px-4 py-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-700 dark:text-red-400">
            {error}
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="aspect-square bg-[var(--surface-card)] border border-[var(--border)] rounded-xl animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-[var(--text-secondary)]">
            <ImageOff className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <p className="font-medium text-[var(--text-primary)]">No media yet</p>
            <p className="text-sm mt-1">Photos and videos uploaded by players will appear here.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {filtered.map((item) => {
              const matchLabel = item.match
                ? `${item.match.player1?.name ?? '?'} vs ${item.match.player2?.name ?? '?'}`
                : null;
              return (
                <div
                  key={item.id}
                  className="relative group bg-[var(--surface-card)] border border-[var(--border)] rounded-xl overflow-hidden"
                >
                  {/* Thumbnail */}
                  <button
                    onClick={() => setLightbox(item)}
                    className="block w-full aspect-square relative bg-zinc-100 dark:bg-zinc-800"
                  >
                    {item.type === 'photo' ? (
                      <Image
                        src={item.url}
                        alt={matchLabel ?? 'Match photo'}
                        fill
                        className="object-cover"
                        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Play className="w-10 h-10 text-white opacity-80" />
                        <video
                          src={item.url}
                          className="absolute inset-0 w-full h-full object-cover opacity-70"
                          muted
                          preload="metadata"
                        />
                      </div>
                    )}
                  </button>

                  {/* Match label */}
                  {matchLabel && (
                    <div className="px-2 py-1.5">
                      <p className="text-xs text-[var(--text-secondary)] leading-tight truncate">{matchLabel}</p>
                      <p className="text-xs text-[var(--text-muted)]">{timeAgo(item.created_at)}</p>
                    </div>
                  )}

                  {/* Delete button — always visible on this admin page */}
                  <button
                    onClick={() => handleDelete(item)}
                    disabled={deletingId === item.id}
                    className="absolute top-2 right-2 w-7 h-7 flex items-center justify-center rounded-full bg-red-600 text-white opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity disabled:opacity-50 shadow-lg"
                    aria-label="Remove"
                    title="Remove"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <div
            className="relative max-w-3xl w-full"
            onClick={(e) => e.stopPropagation()}
          >
            {lightbox.type === 'photo' ? (
              <img
                src={lightbox.url}
                alt="Match photo"
                className="w-full max-h-[80vh] object-contain rounded-xl"
              />
            ) : (
              <video
                src={lightbox.url}
                controls
                autoPlay
                className="w-full max-h-[80vh] rounded-xl"
              />
            )}

            {/* Match info */}
            {lightbox.match && (
              <div className="mt-3 flex items-center justify-between gap-4">
                <div>
                  <p className="text-white font-medium text-sm">
                    {lightbox.match.player1?.name ?? '?'} vs {lightbox.match.player2?.name ?? '?'}
                  </p>
                  {(lightbox.match.draw || lightbox.match.round) && (
                    <p className="text-white/60 text-xs mt-0.5">
                      {[lightbox.match.draw, lightbox.match.round].filter(Boolean).join(' · ')}
                    </p>
                  )}
                </div>
                <Link
                  href={`/t/${slug}/match/${lightbox.match.id}`}
                  className="text-xs text-white/60 hover:text-white underline underline-offset-2 shrink-0"
                  onClick={() => setLightbox(null)}
                >
                  View match →
                </Link>
              </div>
            )}

            {/* Actions */}
            <div className="mt-4 flex items-center justify-between">
              <button
                onClick={() => handleDelete(lightbox)}
                disabled={deletingId === lightbox.id}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                Remove
              </button>
              <p className="text-white/40 text-xs">{timeAgo(lightbox.created_at)}</p>
            </div>

            {/* Close */}
            <button
              onClick={() => setLightbox(null)}
              className="absolute -top-10 right-0 text-white/60 hover:text-white"
              aria-label="Close"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
