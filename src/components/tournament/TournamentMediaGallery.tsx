'use client';

import { useState } from 'react';
import Link from 'next/link';
import { X, Video, Images } from 'lucide-react';

export type TournamentMediaItem = {
  id: string;
  url: string;
  type: 'photo' | 'video';
  caption: string | null;
  match_id: string;
  match: {
    id: string;
    player1: { name: string } | null;
    player2: { name: string } | null;
  } | null;
};

type Props = {
  slug: string;
  items: TournamentMediaItem[];
};

export default function TournamentMediaGallery({ slug, items }: Props) {
  const [lightbox, setLightbox] = useState<TournamentMediaItem | null>(null);

  const photos = items.filter((i) => i.type === 'photo');
  const videos = items.filter((i) => i.type === 'video');

  if (items.length === 0) return null;

  return (
    <>
      <div className="bg-[var(--surface-card)] border border-[var(--border)] rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-[var(--text-primary)] flex items-center gap-2">
            <Images className="w-4 h-4 text-[var(--text-muted)]" strokeWidth={1.5} />
            Tournament Media
            <span className="text-xs font-normal text-[var(--text-muted)]">({items.length})</span>
          </h2>
        </div>

        {/* Photo grid */}
        {photos.length > 0 && (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5 mb-3">
            {photos.map((item) => (
              <button
                key={item.id}
                onClick={() => setLightbox(item)}
                className="relative aspect-square group focus:outline-none"
                aria-label={`View photo from ${matchLabel(item.match)}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.url}
                  alt={item.caption ?? matchLabel(item.match)}
                  className="w-full h-full object-cover rounded-lg group-hover:brightness-90 transition-all"
                  loading="lazy"
                />
              </button>
            ))}
          </div>
        )}

        {/* Video list */}
        {videos.length > 0 && (
          <div className="space-y-2">
            {videos.map((item) => (
              <div key={item.id} className="relative rounded-xl overflow-hidden bg-black group">
                <video
                  src={item.url}
                  controls
                  playsInline
                  preload="metadata"
                  className="w-full max-h-48 object-contain"
                />
                <div className="absolute top-2 left-2 flex items-center gap-1 bg-black/60 text-white text-xs px-2 py-0.5 rounded-full pointer-events-none">
                  <Video className="w-3 h-3" />
                  Video
                </div>
                {item.match && (
                  <Link
                    href={`/t/${slug}/match/${item.match.id}`}
                    className="absolute bottom-0 left-0 right-0 px-3 py-2 bg-gradient-to-t from-black/70 to-transparent text-white text-xs hover:from-black/90 transition-all"
                  >
                    {matchLabel(item.match)}
                  </Link>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/92 flex flex-col items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <button
            className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-colors z-10"
            onClick={() => setLightbox(null)}
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightbox.url}
            alt={lightbox.caption ?? matchLabel(lightbox.match)}
            className="max-w-full max-h-[85vh] object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />

          {lightbox.match && (
            <div className="mt-3 text-center" onClick={(e) => e.stopPropagation()}>
              <Link
                href={`/t/${slug}/match/${lightbox.match.id}`}
                className="text-white/80 text-sm hover:text-white transition-colors underline underline-offset-2"
              >
                {matchLabel(lightbox.match)}
              </Link>
            </div>
          )}
        </div>
      )}
    </>
  );
}

function matchLabel(match: TournamentMediaItem['match']): string {
  if (!match) return 'Match';
  const p1 = match.player1?.name ?? 'TBD';
  const p2 = match.player2?.name ?? 'TBD';
  return `${p1} vs ${p2}`;
}
