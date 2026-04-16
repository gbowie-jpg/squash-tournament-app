'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useTournament } from '@/lib/useTournament';
import ThemeToggle from '@/components/ThemeToggle';
import RefreshButton from '@/components/RefreshButton';
import type { PlayerVideo } from '@/lib/supabase/types';
import { ChevronLeft, CheckCircle, XCircle, Clock, Film, Trash2, Play } from 'lucide-react';

const TABS = ['pending', 'approved', 'rejected', 'all'] as const;
type Tab = typeof TABS[number];

const TAB_LABELS: Record<Tab, string> = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
  all: 'All',
};

export default function AdminVideos({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const { tournament, loading: tLoading } = useTournament(slug);
  const [videos, setVideos] = useState<PlayerVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('pending');
  const [rejectionInput, setRejectionInput] = useState<Record<string, string>>({});
  const [showRejectionForm, setShowRejectionForm] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [playingVideo, setPlayingVideo] = useState<string | null>(null);

  const loadVideos = async (tournamentId: string) => {
    setLoading(true);
    const res = await fetch(`/api/tournaments/${tournamentId}/videos?status=all`);
    if (res.ok) setVideos(await res.json());
    setLoading(false);
  };

  useEffect(() => {
    if (!tournament) return;
    loadVideos(tournament.id);
  }, [tournament]);

  const handleApprove = async (videoId: string) => {
    if (!tournament) return;
    setActionLoading(videoId);
    try {
      const res = await fetch(`/api/tournaments/${tournament.id}/videos`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: videoId, status: 'approved' }),
      });
      if (res.ok) {
        setVideos((prev) =>
          prev.map((v) => (v.id === videoId ? { ...v, status: 'approved', rejection_reason: null } : v)),
        );
      }
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (videoId: string) => {
    if (!tournament) return;
    setActionLoading(videoId);
    try {
      const reason = rejectionInput[videoId] || '';
      const res = await fetch(`/api/tournaments/${tournament.id}/videos`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: videoId, status: 'rejected', rejection_reason: reason }),
      });
      if (res.ok) {
        setVideos((prev) =>
          prev.map((v) => (v.id === videoId ? { ...v, status: 'rejected', rejection_reason: reason } : v)),
        );
        setShowRejectionForm(null);
        setRejectionInput((prev) => { const n = { ...prev }; delete n[videoId]; return n; });
      }
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (videoId: string) => {
    if (!tournament || !confirm('Permanently delete this video?')) return;
    setActionLoading(videoId);
    try {
      await fetch(`/api/tournaments/${tournament.id}/videos`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId }),
      });
      setVideos((prev) => prev.filter((v) => v.id !== videoId));
    } finally {
      setActionLoading(null);
    }
  };

  if (tLoading || !tournament) {
    return (
      <div className="min-h-screen bg-background p-6 space-y-4 animate-pulse">
        <div className="h-14 bg-surface rounded-xl w-1/3" />
        <div className="h-10 bg-surface rounded-xl w-1/2" />
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-36 bg-surface rounded-2xl" />
        ))}
      </div>
    );
  }

  const counts: Record<Tab, number> = {
    pending: videos.filter((v) => v.status === 'pending').length,
    approved: videos.filter((v) => v.status === 'approved').length,
    rejected: videos.filter((v) => v.status === 'rejected').length,
    all: videos.length,
  };

  const filtered = activeTab === 'all' ? videos : videos.filter((v) => v.status === activeTab);

  return (
    <div className="min-h-screen bg-[var(--surface)]">
      <header className="bg-[var(--surface-card)] border-b border-[var(--border)] sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] mb-1">
              <Link href="/admin" className="hover:text-[var(--text-secondary)]">Admin</Link>
              <span>›</span>
              <Link href={`/t/${slug}/admin`} className="hover:text-[var(--text-secondary)]">{tournament.name}</Link>
            </div>
            <div className="flex items-center gap-1.5">
              <Link
                href={`/t/${slug}/admin`}
                className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                <ChevronLeft className="w-5 h-5" />
              </Link>
              <h1 className="text-xl font-bold tracking-tight text-[var(--text-primary)]">Video Approvals</h1>
              {counts.pending > 0 && (
                <span className="bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full">
                  {counts.pending}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <RefreshButton />
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        {/* Tabs */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                activeTab === tab
                  ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900'
                  : 'bg-[var(--surface-card)] border border-[var(--border)] text-[var(--text-secondary)] hover:opacity-80'
              }`}
            >
              {TAB_LABELS[tab]} ({counts[tab]})
            </button>
          ))}
        </div>

        {loading ? (
          <div className="space-y-3 animate-pulse">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-[var(--surface-card)] border border-[var(--border)] rounded-2xl h-36" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <Film className="w-10 h-10 text-[var(--text-muted)] mx-auto mb-3" strokeWidth={1.5} />
            <p className="text-[var(--text-secondary)]">
              {activeTab === 'pending' ? 'No videos awaiting review.' : 'No videos found.'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map((v) => (
              <div key={v.id} className="bg-[var(--surface-card)] border border-[var(--border)] rounded-2xl overflow-hidden">
                {/* Video preview (collapsible) */}
                {v.public_url && (
                  <div className={playingVideo === v.id ? 'block' : 'hidden'}>
                    <video
                      src={v.public_url}
                      controls
                      autoPlay
                      playsInline
                      className="w-full max-h-72 bg-black"
                    />
                  </div>
                )}

                <div className="p-4">
                  <div className="flex items-start gap-4">
                    {/* Thumbnail / Play button */}
                    <button
                      onClick={() => setPlayingVideo(playingVideo === v.id ? null : v.id)}
                      className="flex-shrink-0 w-16 h-14 rounded-xl bg-card flex items-center justify-center hover:opacity-80 transition-opacity"
                      aria-label={playingVideo === v.id ? 'Hide video' : 'Preview video'}
                    >
                      <Play
                        className={`w-6 h-6 ${playingVideo === v.id ? 'text-blue-400' : 'text-white'}`}
                        strokeWidth={1.5}
                      />
                    </button>

                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-[var(--text-primary)] truncate">{v.title || 'Untitled'}</p>
                      {v.player && (
                        <p className="text-sm text-[var(--text-secondary)] mt-0.5">{v.player.name}</p>
                      )}
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {/* Status badge */}
                        {v.status === 'pending' && (
                          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400">
                            <Clock className="w-3 h-3" /> Pending
                          </span>
                        )}
                        {v.status === 'approved' && (
                          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-400">
                            <CheckCircle className="w-3 h-3" /> Approved
                          </span>
                        )}
                        {v.status === 'rejected' && (
                          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400">
                            <XCircle className="w-3 h-3" /> Rejected
                          </span>
                        )}
                        {v.file_size_bytes && (
                          <span className="text-xs text-[var(--text-muted)]">
                            {(v.file_size_bytes / (1024 * 1024)).toFixed(1)} MB
                          </span>
                        )}
                        <span className="text-xs text-[var(--text-muted)]">
                          {new Date(v.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      {v.status === 'rejected' && v.rejection_reason && (
                        <p className="text-xs text-red-500 mt-1">Reason: {v.rejection_reason}</p>
                      )}
                    </div>

                    {/* Delete button */}
                    <button
                      onClick={() => handleDelete(v.id)}
                      disabled={actionLoading === v.id}
                      className="flex-shrink-0 p-2 text-[var(--text-muted)] hover:text-red-500 transition-colors disabled:opacity-50"
                      aria-label="Delete video"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Rejection reason input */}
                  {showRejectionForm === v.id && (
                    <div className="mt-3 pt-3 border-t border-[var(--border)] flex gap-2">
                      <input
                        value={rejectionInput[v.id] || ''}
                        onChange={(e) => setRejectionInput({ ...rejectionInput, [v.id]: e.target.value })}
                        placeholder="Reason for rejection (optional)"
                        className="flex-1 border border-[var(--border)] rounded-lg px-3 py-1.5 text-sm bg-[var(--surface)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-red-500"
                      />
                      <button
                        onClick={() => handleReject(v.id)}
                        disabled={actionLoading === v.id}
                        className="bg-red-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50"
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => setShowRejectionForm(null)}
                        className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] px-2"
                      >
                        Cancel
                      </button>
                    </div>
                  )}

                  {/* Action buttons */}
                  {v.status !== 'approved' && v.status !== 'rejected' && (
                    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[var(--border)]">
                      <button
                        onClick={() => handleApprove(v.id)}
                        disabled={actionLoading === v.id}
                        className="flex items-center gap-1.5 bg-green-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                        Approve
                      </button>
                      <button
                        onClick={() => setShowRejectionForm(v.id)}
                        disabled={actionLoading === v.id}
                        className="flex items-center gap-1.5 bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 px-4 py-1.5 rounded-lg text-sm font-medium hover:opacity-80 disabled:opacity-50 transition-opacity"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        Reject
                      </button>
                    </div>
                  )}

                  {v.status === 'approved' && (
                    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[var(--border)]">
                      <button
                        onClick={() => {
                          setShowRejectionForm(v.id);
                        }}
                        disabled={actionLoading === v.id}
                        className="flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-red-500 transition-colors"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        Revoke approval
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
