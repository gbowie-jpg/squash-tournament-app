'use client';

import { use, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useTournament } from '@/lib/useTournament';
import { useRealtimeMatches } from '@/lib/realtime/hooks';
import { formatScore } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import {
  Camera,
  ChevronLeft,
  Clock,
  Loader2,
  MapPin,
  Trash2,
  Trophy,
  Swords,
  Video,
  X,
} from 'lucide-react';
import PullToRefresh from '@/components/PullToRefresh';
import RefreshButton from '@/components/RefreshButton';
import ThemeToggle from '@/components/ThemeToggle';
import type { MatchMedia, MatchWithDetails } from '@/lib/supabase/types';

const STATUS_CONFIG: Record<string, { label: string; color: string; dot?: string }> = {
  in_progress: { label: 'Live Now', color: 'bg-green-600 text-white', dot: 'bg-white animate-pulse' },
  on_deck:     { label: 'On Deck',  color: 'bg-amber-500 text-white', dot: 'bg-white' },
  scheduled:   { label: 'Upcoming', color: 'bg-blue-100 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300' },
  completed:   { label: 'Completed', color: 'bg-surface text-muted-foreground' },
  walkover:    { label: 'Walkover',  color: 'bg-purple-100 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400' },
  cancelled:   { label: 'Cancelled', color: 'bg-red-100 dark:bg-red-950/50 text-red-500 dark:text-red-400' },
};

// ─── Media Section ───────────────────────────────────────────────────────────

function MatchMediaSection({
  tournamentId,
  matchId,
  currentUserId,
  canDeleteAll,
}: {
  tournamentId: string;
  matchId: string;
  currentUserId: string | null;
  canDeleteAll: boolean;
}) {
  const [media, setMedia] = useState<MatchMedia[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchMedia = useCallback(async () => {
    const res = await fetch(`/api/tournaments/${tournamentId}/matches/${matchId}/media`);
    if (res.ok) {
      const data: MatchMedia[] = await res.json();
      setMedia(data);
    }
    setLoading(false);
  }, [tournamentId, matchId]);

  useEffect(() => {
    fetchMedia();
  }, [fetchMedia]);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    setUploading(true);

    try {
      const supabase = createClient();
      const ext = file.name.split('.').pop() ?? 'bin';
      const path = `${tournamentId}/${matchId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

      const { error: storageError } = await supabase.storage
        .from('match-media')
        .upload(path, file, { cacheControl: '3600', upsert: false });

      if (storageError) throw new Error(storageError.message);

      const { data: urlData } = supabase.storage.from('match-media').getPublicUrl(path);
      const url = urlData.publicUrl;

      const type = file.type.startsWith('video/') ? 'video' : 'photo';

      const postRes = await fetch(`/api/tournaments/${tournamentId}/matches/${matchId}/media`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, type }),
      });

      if (!postRes.ok) {
        const d = await postRes.json().catch(() => ({}));
        throw new Error(d.error ?? 'Failed to save media record');
      }

      await fetchMedia();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
      // Reset input so same file can be re-selected
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleDelete(item: MatchMedia) {
    if (!confirm('Remove this media?')) return;
    setDeleteError(null);
    setDeletingId(item.id);
    try {
      const res = await fetch(
        `/api/tournaments/${tournamentId}/matches/${matchId}/media?mediaId=${item.id}`,
        { method: 'DELETE' }
      );
      if (res.ok) {
        setMedia((prev) => prev.filter((m) => m.id !== item.id));
      } else {
        const d = await res.json().catch(() => ({}));
        setDeleteError(d.error ?? `Delete failed (${res.status})`);
      }
    } catch {
      setDeleteError('Network error — please try again');
    } finally {
      setDeletingId(null);
    }
  }

  const photos = media.filter((m) => m.type === 'photo');
  const videos = media.filter((m) => m.type === 'video');

  return (
    <div className="bg-[var(--surface-card)] border border-[var(--border)] rounded-2xl overflow-hidden mb-4">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
          Photos &amp; Videos
          {media.length > 0 && (
            <span className="ml-1.5 text-[var(--text-secondary)] normal-case font-normal tracking-normal">
              ({media.length})
            </span>
          )}
        </p>
        {currentUserId && (
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:opacity-80 transition-opacity disabled:opacity-50"
          >
            {uploading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Camera className="w-3.5 h-3.5" />
            )}
            {uploading ? 'Uploading…' : 'Add'}
          </button>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {uploadError && (
        <p className="mx-4 mb-2 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 rounded-lg px-3 py-2">
          {uploadError}
        </p>
      )}

      {deleteError && (
        <p className="mx-4 mb-2 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 rounded-lg px-3 py-2 flex items-center justify-between gap-2">
          <span>{deleteError}</span>
          <button onClick={() => setDeleteError(null)} className="shrink-0 underline">Dismiss</button>
        </p>
      )}

      {loading ? (
        <div className="px-4 pb-4 text-sm text-[var(--text-muted)]">Loading…</div>
      ) : media.length === 0 ? (
        <div className="px-4 pb-5 text-sm text-[var(--text-secondary)]">
          {currentUserId
            ? 'No media yet — be the first to add a photo or video!'
            : 'No photos or videos yet.'}
        </div>
      ) : (
        <div className="px-4 pb-4 space-y-4">
          {/* Photo grid */}
          {photos.length > 0 && (
            <div>
              {videos.length > 0 && (
                <p className="text-xs text-[var(--text-muted)] font-medium mb-2">Photos</p>
              )}
              <div className="grid grid-cols-3 gap-1.5">
                {photos.map((item) => (
                  <div key={item.id} className="relative group aspect-square">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.url}
                      alt={item.caption ?? 'Match photo'}
                      className="w-full h-full object-cover rounded-xl cursor-pointer"
                      onClick={() => setLightbox(item.url)}
                    />
                    {currentUserId && (canDeleteAll || item.uploaded_by === currentUserId) && (
                      <button
                        onClick={() => handleDelete(item)}
                        disabled={deletingId === item.id}
                        className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-80"
                        aria-label="Delete"
                      >
                        {deletingId === item.id
                          ? <Loader2 className="w-3 h-3 animate-spin" />
                          : <Trash2 className="w-3 h-3" />}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Video list */}
          {videos.length > 0 && (
            <div>
              {photos.length > 0 && (
                <p className="text-xs text-[var(--text-muted)] font-medium mb-2">Videos</p>
              )}
              <div className="space-y-3">
                {videos.map((item) => (
                  <div key={item.id} className="relative group rounded-xl overflow-hidden bg-black">
                    <video
                      src={item.url}
                      controls
                      playsInline
                      className="w-full max-h-64 object-contain"
                      preload="metadata"
                    />
                    <div className="absolute top-2 left-2 flex items-center gap-1 bg-black/60 text-white text-xs px-2 py-0.5 rounded-full pointer-events-none">
                      <Video className="w-3 h-3" />
                      Video
                    </div>
                    {currentUserId && (canDeleteAll || item.uploaded_by === currentUserId) && (
                      <button
                        onClick={() => handleDelete(item)}
                        disabled={deletingId === item.id}
                        className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-80"
                        aria-label="Delete video"
                      >
                        {deletingId === item.id
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          : <Trash2 className="w-3.5 h-3.5" />}
                      </button>
                    )}
                    {item.caption && (
                      <p className="text-xs text-[var(--text-secondary)] px-1 pt-1">{item.caption}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <button
            className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-colors"
            onClick={() => setLightbox(null)}
          >
            <X className="w-5 h-5" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightbox}
            alt="Full size"
            className="max-w-full max-h-full object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MatchDetail({
  params,
}: {
  params: Promise<{ slug: string; matchId: string }>;
}) {
  const { slug, matchId } = use(params);
  const { tournament, loading: tLoading } = useTournament(slug);
  const { matches, loading: mLoading } = useRealtimeMatches(tournament?.id ?? '');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [canDeleteAllMedia, setCanDeleteAllMedia] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      setCurrentUserId(user.id);

      // Check if user is a global admin/superadmin or an organizer for this tournament.
      // Both are allowed to delete any media item.
      if (!tournament?.id) return;
      const [profileRes, organizerRes] = await Promise.all([
        supabase.from('profiles').select('role').eq('id', user.id).single(),
        supabase.from('organizers').select('id').eq('tournament_id', tournament.id).eq('user_id', user.id).maybeSingle(),
      ]);
      const profile = profileRes.data as { role: string } | null;
      const isGlobalAdmin = profile?.role === 'admin' || profile?.role === 'superadmin';
      const isOrganizer = !!organizerRes.data;
      setCanDeleteAllMedia(isGlobalAdmin || isOrganizer);
    });
  }, [tournament?.id]);

  if (tLoading || !tournament) {
    return (
      <div className="flex items-center justify-center min-h-screen text-[var(--text-secondary)]">
        Loading…
      </div>
    );
  }

  const match: MatchWithDetails | undefined = matches.find((m) => m.id === matchId);

  if (!mLoading && !match) {
    return (
      <div className="min-h-screen bg-[var(--surface)] flex flex-col items-center justify-center gap-4">
        <p className="text-[var(--text-secondary)]">Match not found.</p>
        <Link href={`/t/${slug}`} className="text-sm text-blue-600 dark:text-blue-400 underline">
          Back to tournament
        </Link>
      </div>
    );
  }

  const statusCfg = match ? STATUS_CONFIG[match.status] ?? STATUS_CONFIG.scheduled : null;
  const isLive = match?.status === 'in_progress';
  const isOnDeck = match?.status === 'on_deck';
  const isCompleted = match?.status === 'completed' || match?.status === 'walkover';

  return (
    <PullToRefresh>
      <div className="min-h-screen bg-[var(--surface)]">
        {/* Header */}
        <header className="bg-[var(--surface-card)] border-b border-[var(--border)] sticky top-0 z-10">
          <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
            <div>
              <Link
                href={`/t/${slug}/courts`}
                className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center gap-1 mb-0.5"
              >
                <ChevronLeft className="w-3.5 h-3.5" /> Court Board
              </Link>
              <h1 className="text-lg font-bold tracking-tight text-[var(--text-primary)]">Match</h1>
            </div>
            <ThemeToggle />
            <RefreshButton />
          </div>
        </header>

        <main className="max-w-2xl mx-auto px-4 py-5 pb-24">
          {mLoading || !match ? (
            /* Skeleton */
            <div className="space-y-4 animate-pulse">
              <div className="bg-[var(--surface-card)] border border-[var(--border)] rounded-2xl h-40" />
              <div className="bg-[var(--surface-card)] border border-[var(--border)] rounded-2xl h-28" />
            </div>
          ) : (
            <>
              {/* Status + Score Hero Card */}
              <div className={`rounded-2xl p-5 mb-4 ${isLive ? 'bg-green-600' : isOnDeck ? 'bg-amber-500' : 'bg-[var(--surface-card)] border border-[var(--border)]'}`}>
                {/* Status badge */}
                <div className="flex items-center justify-between mb-4">
                  {statusCfg && (
                    <span className={`inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ${isLive || isOnDeck ? 'bg-white/20 text-white' : statusCfg.color}`}>
                      {statusCfg.dot && <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dot}`} />}
                      {statusCfg.label}
                    </span>
                  )}
                  <div className="flex items-center gap-2 text-xs">
                    {match.draw && (
                      <span className={`font-medium ${isLive || isOnDeck ? 'text-white/80' : 'text-[var(--text-secondary)]'}`}>
                        {match.draw}
                      </span>
                    )}
                    {match.round && (
                      <span className={`font-medium ${isLive || isOnDeck ? 'text-white/80' : 'text-[var(--text-secondary)]'}`}>
                        · {match.round}
                      </span>
                    )}
                  </div>
                </div>

                {/* Players vs */}
                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 mb-4">
                  {/* Player 1 */}
                  <div className="text-center">
                    <Link
                      href={match.player1_id ? `/t/${slug}/player/${match.player1_id}` : '#'}
                      className={`block font-bold text-lg leading-tight ${isLive || isOnDeck ? 'text-white' : 'text-[var(--text-primary)]'} ${match.player1_id ? 'hover:underline underline-offset-2' : ''}`}
                    >
                      {match.player1?.name || 'TBD'}
                    </Link>
                    {match.player1?.club && (
                      <p className={`text-xs mt-0.5 ${isLive || isOnDeck ? 'text-white/70' : 'text-[var(--text-muted)]'}`}>
                        {match.player1.club}
                      </p>
                    )}
                    {isCompleted && match.winner_id === match.player1_id && (
                      <span className={`inline-flex items-center gap-1 text-xs font-bold mt-1 ${isLive || isOnDeck ? 'text-white' : 'text-green-600 dark:text-green-400'}`}>
                        <Trophy className="w-3 h-3" /> Winner
                      </span>
                    )}
                  </div>

                  {/* VS */}
                  <div className={`text-sm font-bold ${isLive || isOnDeck ? 'text-white/60' : 'text-[var(--text-muted)]'}`}>
                    <Swords className="w-4 h-4" strokeWidth={1.5} />
                  </div>

                  {/* Player 2 */}
                  <div className="text-center">
                    <Link
                      href={match.player2_id ? `/t/${slug}/player/${match.player2_id}` : '#'}
                      className={`block font-bold text-lg leading-tight ${isLive || isOnDeck ? 'text-white' : 'text-[var(--text-primary)]'} ${match.player2_id ? 'hover:underline underline-offset-2' : ''}`}
                    >
                      {match.player2?.name || 'TBD'}
                    </Link>
                    {match.player2?.club && (
                      <p className={`text-xs mt-0.5 ${isLive || isOnDeck ? 'text-white/70' : 'text-[var(--text-muted)]'}`}>
                        {match.player2.club}
                      </p>
                    )}
                    {isCompleted && match.winner_id === match.player2_id && (
                      <span className={`inline-flex items-center gap-1 text-xs font-bold mt-1 ${isLive || isOnDeck ? 'text-white' : 'text-green-600 dark:text-green-400'}`}>
                        <Trophy className="w-3 h-3" /> Winner
                      </span>
                    )}
                  </div>
                </div>

                {/* Score */}
                {match.scores && match.scores.length > 0 && (
                  <div className={`text-center text-2xl font-mono font-bold mb-3 tracking-wider ${isLive || isOnDeck ? 'text-white' : 'text-[var(--text-primary)]'}`}>
                    {formatScore(match.scores)}
                  </div>
                )}

                {/* Meta: court + time */}
                <div className={`flex items-center justify-center gap-4 text-xs ${isLive || isOnDeck ? 'text-white/70' : 'text-[var(--text-secondary)]'}`}>
                  {match.court && (
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" strokeWidth={1.5} />
                      {match.court.name}
                    </span>
                  )}
                  {match.scheduled_time && (
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" strokeWidth={1.5} />
                      {new Date(match.scheduled_time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                    </span>
                  )}
                </div>
              </div>

              {/* Score / Start CTA */}
              {!isCompleted && match.status !== 'cancelled' && (
                <div className="mb-4">
                  {currentUserId ? (
                    <Link
                      href={`/t/${slug}/match/${matchId}/score`}
                      className={`flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl font-semibold text-sm transition-opacity hover:opacity-90 ${
                        isLive
                          ? 'bg-green-600 text-white'
                          : isOnDeck
                          ? 'bg-amber-500 text-white'
                          : 'bg-foreground text-card'
                      }`}
                    >
                      {isLive ? (
                        <>
                          <svg viewBox="0 0 20 20" className="w-4 h-4 inline-block mr-1.5 shrink-0" aria-hidden>
                            <circle cx="10" cy="10" r="9" fill="#111"/>
                            <circle cx="7.5" cy="8.5" r="2" fill="#EAB308"/>
                            <circle cx="12.5" cy="12" r="2" fill="#EAB308"/>
                          </svg>
                          Score this Match
                        </>
                      ) : isOnDeck ? '⏳ Prepare to Score' : 'Open Scoring App'}
                    </Link>
                  ) : (
                    <Link
                      href={`/login?redirect=/t/${slug}/match/${matchId}/score`}
                      className="flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl font-semibold text-sm bg-foreground text-card hover:opacity-90 transition-opacity"
                    >
                      Sign in to Score
                    </Link>
                  )}
                </div>
              )}

              {/* Media */}
              <MatchMediaSection
                tournamentId={tournament.id}
                matchId={matchId}
                currentUserId={currentUserId}
                canDeleteAll={canDeleteAllMedia}
              />

              {/* Player links */}
              {(match.player1_id || match.player2_id) && (
                <div className="bg-[var(--surface-card)] border border-[var(--border)] rounded-2xl overflow-hidden mb-4">
                  <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider px-4 pt-4 pb-2">Players</p>
                  {[
                    { player: match.player1, id: match.player1_id },
                    { player: match.player2, id: match.player2_id },
                  ].filter(({ id }) => id).map(({ player, id }, i) => (
                    <Link
                      key={id}
                      href={`/t/${slug}/player/${id}`}
                      className={`flex items-center justify-between px-4 py-3 hover:bg-surface transition-colors ${i > 0 ? 'border-t border-[var(--border)]' : ''}`}
                    >
                      <div>
                        <p className="font-semibold text-sm text-[var(--text-primary)]">{player?.name || 'TBD'}</p>
                        {player?.club && <p className="text-xs text-[var(--text-secondary)]">{player.club}</p>}
                      </div>
                      <span className="text-xs text-[var(--text-muted)]">View matches →</span>
                    </Link>
                  ))}
                </div>
              )}

              {/* Live indicator */}
              {(isLive || isOnDeck) && (
                <div className="flex items-center gap-1.5 justify-center mt-6">
                  <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-xs text-[var(--text-secondary)]">Score updates automatically</span>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </PullToRefresh>
  );
}
