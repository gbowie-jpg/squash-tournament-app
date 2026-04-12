'use client';

import { use } from 'react';
import Link from 'next/link';
import { useTournament } from '@/lib/useTournament';
import { useRealtimeMatches } from '@/lib/realtime/hooks';
import { formatScore } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import { useState, useEffect, useRef, useCallback } from 'react';
import type { Player, MatchWithDetails, Profile, PlayerVideo } from '@/lib/supabase/types';
import { ChevronLeft, Upload, Play, Clock, CheckCircle, XCircle, Film } from 'lucide-react';
import PullToRefresh from '@/components/PullToRefresh';
import RefreshButton from '@/components/RefreshButton';
import ThemeToggle from '@/components/ThemeToggle';

const STATUS_LABELS: Record<string, { text: string; color: string }> = {
  in_progress: { text: 'Playing NOW', color: 'bg-green-600 text-white' },
  on_deck: { text: 'ON DECK', color: 'bg-amber-500 text-white' },
  scheduled: { text: 'Upcoming', color: 'bg-blue-100 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300' },
  completed: { text: 'Completed', color: 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400' },
  walkover: { text: 'Walkover', color: 'bg-purple-100 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400' },
  cancelled: { text: 'Cancelled', color: 'bg-red-100 dark:bg-red-950/50 text-red-500 dark:text-red-400' },
};

const VIDEO_STATUS_CONFIG: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
  pending: {
    icon: <Clock className="w-3.5 h-3.5" />,
    label: 'Pending Review',
    color: 'bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400',
  },
  approved: {
    icon: <CheckCircle className="w-3.5 h-3.5" />,
    label: 'Approved',
    color: 'bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-400',
  },
  rejected: {
    icon: <XCircle className="w-3.5 h-3.5" />,
    label: 'Not Approved',
    color: 'bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400',
  },
};

export default function PlayerProfile({
  params,
}: {
  params: Promise<{ slug: string; playerId: string }>;
}) {
  const { slug, playerId } = use(params);
  const { tournament, loading: tLoading } = useTournament(slug);
  const { matches, loading: mLoading } = useRealtimeMatches(tournament?.id ?? '');
  const [player, setPlayer] = useState<Player | null>(null);
  const [playerProfile, setPlayerProfile] = useState<Profile | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);

  // Videos
  const [videos, setVideos] = useState<PlayerVideo[]>([]);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [videoTitle, setVideoTitle] = useState('');
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadVideos = useCallback(async (tournamentId: string, showAll: boolean) => {
    const params = new URLSearchParams({ status: showAll ? 'all' : 'approved' });
    const res = await fetch(`/api/tournaments/${tournamentId}/videos?${params}&player_id=${playerId}`);
    if (res.ok) setVideos(await res.json());
  }, [playerId]);

  useEffect(() => {
    if (!tournament) return;
    const supabase = createClient();

    supabase
      .from('players')
      .select('*')
      .eq('id', playerId)
      .single()
      .then(({ data }) => {
        const playerData = data as Player | null;
        setPlayer(playerData);
        if (playerData?.email) {
          supabase
            .from('profiles')
            .select('*')
            .eq('email', playerData.email)
            .maybeSingle()
            .then(({ data: profile }) => setPlayerProfile(profile as Profile | null));
        }
      });

    supabase.auth.getUser().then(({ data: { user } }) => {
      setCurrentUserId(user?.id ?? null);
      setCurrentUserEmail(user?.email ?? null);
    });
  }, [tournament, playerId]);

  useEffect(() => {
    if (!tournament) return;
    // Show own pending/rejected videos too
    const isOwn = !!currentUserEmail && !!player?.email && player.email === currentUserEmail;
    loadVideos(tournament.id, isOwn);
  }, [tournament, player, currentUserEmail, loadVideos]);

  const handleVideoUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tournament || !fileInputRef.current?.files?.[0]) return;

    const file = fileInputRef.current.files[0];
    const maxSize = 500 * 1024 * 1024; // 500 MB

    if (file.size > maxSize) {
      setUploadError('File too large. Maximum 500 MB.');
      return;
    }

    setUploadingVideo(true);
    setUploadError(null);
    setUploadProgress(0);

    try {
      const supabase = createClient();
      const ext = file.name.split('.').pop() || 'mp4';
      const path = `${playerId}/${Date.now()}.${ext}`;

      // Upload to Supabase Storage
      const { error: storageError } = await supabase.storage
        .from('player-videos')
        .upload(path, file, {
          contentType: file.type,
          upsert: false,
        });

      if (storageError) {
        setUploadError(storageError.message);
        return;
      }

      setUploadProgress(80);

      // Get public URL
      const { data: urlData } = supabase.storage.from('player-videos').getPublicUrl(path);

      // Record in DB
      const res = await fetch(`/api/tournaments/${tournament.id}/videos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          player_id: playerId,
          title: videoTitle || file.name.replace(/\.[^.]+$/, ''),
          storage_path: path,
          public_url: urlData.publicUrl,
          file_size_bytes: file.size,
          mime_type: file.type,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        setUploadError(err.error || 'Failed to save video record');
        return;
      }

      const newVideo = await res.json();
      setVideos((prev) => [newVideo, ...prev]);
      setUploadProgress(100);
      setUploadSuccess(true);
      setVideoTitle('');
      setShowUploadForm(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setTimeout(() => setUploadSuccess(false), 4000);
    } finally {
      setUploadingVideo(false);
    }
  };

  if (tLoading || !tournament) {
    return <div className="flex items-center justify-center min-h-screen text-zinc-600">Loading…</div>;
  }

  const playerMatches = matches
    .filter((m) => m.player1_id === playerId || m.player2_id === playerId)
    .sort((a, b) => {
      const order = ['in_progress', 'on_deck', 'scheduled', 'completed', 'walkover', 'cancelled'];
      return order.indexOf(a.status) - order.indexOf(b.status);
    });

  const activeMatch = playerMatches.find((m) => m.status === 'in_progress' || m.status === 'on_deck');
  const displayName = playerProfile?.full_name || player?.name || 'Loading…';
  const displayClub = playerProfile?.club || player?.club;
  const photo = playerProfile?.photo_url;
  const isOwnProfile = !!currentUserEmail && !!player?.email && player.email === currentUserEmail;

  const approvedVideos = videos.filter((v) => v.status === 'approved');
  const ownPendingVideos = isOwnProfile ? videos.filter((v) => v.status !== 'approved') : [];

  return (
    <PullToRefresh>
    <div className="min-h-screen bg-[var(--surface)]">
      {/* Header */}
      <header className="bg-[var(--surface-card)] border-b border-[var(--border)]">
        <div className="max-w-2xl mx-auto px-4 pt-4 pb-5">
          <div className="flex items-center justify-between mb-3">
            <Link href={`/t/${slug}/players`} className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center gap-1">
              <ChevronLeft className="w-4 h-4" />
              All Players
            </Link>
            <ThemeToggle />
            <RefreshButton />
          </div>

          <div className="flex items-center gap-4">
            {photo ? (
              <img
                src={photo}
                alt={displayName}
                className="w-14 h-14 rounded-full object-cover border-2 border-[var(--border)] flex-shrink-0"
              />
            ) : (
              <div className="w-14 h-14 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center text-xl font-bold text-zinc-500 dark:text-zinc-300 flex-shrink-0 select-none">
                {displayName[0]?.toUpperCase() ?? '?'}
              </div>
            )}

            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold tracking-tight truncate">{displayName}</h1>
              <div className="flex flex-wrap items-center gap-2 mt-0.5">
                {displayClub && <span className="text-sm text-zinc-500">{displayClub}</span>}
                {playerProfile?.squash_ranking && (
                  <span className="text-xs font-medium bg-blue-100 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full">
                    Rating: {playerProfile.squash_ranking}
                  </span>
                )}
              </div>
              {playerProfile?.bio && (
                <p className="text-xs text-zinc-500 mt-1 line-clamp-2">{playerProfile.bio}</p>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-5 pb-24">
        {/* Active status banner */}
        {activeMatch && (
          <div className={`rounded-2xl p-4 mb-5 ${activeMatch.status === 'in_progress' ? 'bg-green-600' : 'bg-amber-500'}`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-white font-bold text-base">
                  {activeMatch.status === 'in_progress' ? '🎾 Playing NOW' : '⏳ ON DECK'}
                </p>
                {activeMatch.court && (
                  <p className="text-white/90 text-sm mt-0.5">📍 {activeMatch.court.name}</p>
                )}
                <p className="text-white/80 text-sm mt-0.5">
                  vs {activeMatch.player1_id === playerId ? activeMatch.player2?.name : activeMatch.player1?.name}
                </p>
                {activeMatch.scores && activeMatch.scores.length > 0 && (
                  <p className="text-white font-mono font-bold mt-1">{formatScore(activeMatch.scores)}</p>
                )}
              </div>
              {currentUserId && (
                <Link
                  href={`/t/${slug}/match/${activeMatch.id}/score`}
                  className="flex-shrink-0 bg-white/20 hover:bg-white/30 text-white font-semibold text-sm px-3 py-2 rounded-xl transition-colors"
                >
                  Score ›
                </Link>
              )}
            </div>
          </div>
        )}

        {/* Match list */}
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3">Matches</h2>
          {mLoading ? (
            <p className="text-[var(--text-secondary)] text-center py-8">Loading matches…</p>
          ) : playerMatches.length === 0 ? (
            <p className="text-[var(--text-secondary)] text-center py-8">No matches scheduled yet.</p>
          ) : (
            <div className="space-y-2.5">
              {playerMatches.map((m: MatchWithDetails) => {
                const opponent = m.player1_id === playerId ? m.player2 : m.player1;
                const statusInfo = STATUS_LABELS[m.status];
                const didWin = m.winner_id === playerId;
                const didLose = m.winner_id && m.winner_id !== playerId;
                const canScore = currentUserId && (m.status === 'in_progress' || m.status === 'on_deck');

                return (
                  <div key={m.id} className="bg-[var(--surface-card)] border border-[var(--border)] rounded-2xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${statusInfo.color}`}>
                        {statusInfo.text}
                      </span>
                      <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                        {m.draw && <span>{m.draw}</span>}
                        {m.round && <span>· {m.round}</span>}
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold truncate text-[var(--text-primary)]">
                          vs {opponent?.name || 'TBD'}
                          {didWin && <span className="text-green-600 ml-2 text-sm font-bold">W</span>}
                          {didLose && <span className="text-red-500 ml-2 text-sm font-bold">L</span>}
                        </p>
                        <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-[var(--text-secondary)]">
                          {m.court && <span>{m.court.name}</span>}
                          {m.scheduled_time && (
                            <span>
                              {new Date(m.scheduled_time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                            </span>
                          )}
                        </div>
                        {m.scores && m.scores.length > 0 && (
                          <p className="text-sm font-mono text-[var(--text-secondary)] mt-1">{formatScore(m.scores)}</p>
                        )}
                      </div>

                      {canScore && (
                        <Link
                          href={`/t/${slug}/match/${m.id}/score`}
                          className="flex-shrink-0 bg-zinc-900 text-white text-xs font-semibold px-3 py-2 rounded-xl hover:bg-zinc-700 transition-colors"
                        >
                          Score
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Videos section */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wider flex items-center gap-1.5">
              <Film className="w-4 h-4" />
              Highlights
            </h2>
            {isOwnProfile && (
              <button
                onClick={() => setShowUploadForm(!showUploadForm)}
                className="flex items-center gap-1.5 text-xs font-medium bg-[var(--surface-card)] border border-[var(--border)] px-3 py-1.5 rounded-lg hover:opacity-80 transition-opacity text-[var(--text-primary)]"
              >
                <Upload className="w-3.5 h-3.5" />
                Upload Video
              </button>
            )}
          </div>

          {/* Upload success message */}
          {uploadSuccess && (
            <div className="mb-4 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 rounded-xl px-4 py-3 text-sm flex items-center gap-2">
              <CheckCircle className="w-4 h-4 flex-shrink-0" />
              Video uploaded! It will appear here once reviewed by the organizer.
            </div>
          )}

          {/* Upload form */}
          {showUploadForm && isOwnProfile && (
            <form
              onSubmit={handleVideoUpload}
              className="mb-5 bg-[var(--surface-card)] border border-[var(--border)] rounded-2xl p-5 space-y-4"
            >
              <h3 className="font-semibold text-[var(--text-primary)]">Upload a Highlight</h3>
              <p className="text-xs text-[var(--text-secondary)]">
                Videos are reviewed by the organizer before being published on your profile. Max 500 MB.
              </p>

              {uploadError && (
                <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-xl px-3 py-2 text-sm">
                  {uploadError}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">
                  Title <span className="text-[var(--text-muted)] font-normal">(optional)</span>
                </label>
                <input
                  value={videoTitle}
                  onChange={(e) => setVideoTitle(e.target.value)}
                  placeholder="e.g. QF vs Smith — great rally at 9-9"
                  className="w-full border border-[var(--border)] rounded-xl px-3 py-2.5 text-sm bg-[var(--surface)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-[var(--text-muted)]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">
                  Video file <span className="text-red-500">*</span>
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/mp4,video/quicktime,video/webm,video/avi,video/mov"
                  required
                  className="w-full text-sm text-[var(--text-secondary)] file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-zinc-900 file:text-white dark:file:bg-zinc-100 dark:file:text-zinc-900 hover:file:opacity-90"
                />
                <p className="text-xs text-[var(--text-muted)] mt-1">MP4, MOV, WebM · Max 500 MB</p>
              </div>

              {uploadingVideo && uploadProgress > 0 && (
                <div className="w-full bg-zinc-200 dark:bg-zinc-700 rounded-full h-1.5">
                  <div
                    className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              )}

              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  disabled={uploadingVideo}
                  className="bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-5 py-2 rounded-xl text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                  {uploadingVideo ? 'Uploading…' : 'Submit for Review'}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowUploadForm(false); setUploadError(null); }}
                  className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {/* Own pending/rejected videos */}
          {ownPendingVideos.length > 0 && (
            <div className="mb-4 space-y-2">
              {ownPendingVideos.map((v) => {
                const cfg = VIDEO_STATUS_CONFIG[v.status];
                return (
                  <div key={v.id} className="bg-[var(--surface-card)] border border-[var(--border)] rounded-xl p-3 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center flex-shrink-0">
                      <Film className="w-5 h-5 text-zinc-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[var(--text-primary)] truncate">{v.title || 'Untitled'}</p>
                      <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full mt-0.5 ${cfg.color}`}>
                        {cfg.icon} {cfg.label}
                      </span>
                      {v.status === 'rejected' && v.rejection_reason && (
                        <p className="text-xs text-red-500 mt-0.5">{v.rejection_reason}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Approved videos */}
          {approvedVideos.length === 0 && !isOwnProfile ? (
            <p className="text-[var(--text-secondary)] text-sm text-center py-6">No highlights yet.</p>
          ) : approvedVideos.length === 0 && isOwnProfile && ownPendingVideos.length === 0 ? (
            <p className="text-[var(--text-secondary)] text-sm text-center py-4">
              No highlights yet — upload a video to share your best moments.
            </p>
          ) : (
            <div className="space-y-3">
              {approvedVideos.map((v) => (
                <div key={v.id} className="bg-[var(--surface-card)] border border-[var(--border)] rounded-2xl overflow-hidden">
                  {v.public_url && (
                    <video
                      src={v.public_url}
                      controls
                      playsInline
                      preload="metadata"
                      className="w-full max-h-64 bg-black"
                    />
                  )}
                  {v.title && (
                    <div className="px-4 py-3 flex items-center gap-2">
                      <Play className="w-4 h-4 text-[var(--text-muted)]" strokeWidth={1.5} />
                      <p className="text-sm font-medium text-[var(--text-primary)]">{v.title}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        <div className="flex items-center gap-1.5 justify-center mt-8 pb-6">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-xs text-zinc-500">Updates automatically</span>
        </div>
      </main>
    </div>
    </PullToRefresh>
  );
}
