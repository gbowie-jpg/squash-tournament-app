'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { useTournament } from '@/lib/useTournament';
import type { Announcement } from '@/lib/supabase/types';

export default function AnnouncementComposer({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const { tournament } = useTournament(slug);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [priority, setPriority] = useState<'normal' | 'urgent'>('normal');
  const [sendPush, setSendPush] = useState(false);
  const [pushStatus, setPushStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!tournament) return;
    fetch(`/api/tournaments/${tournament.id}/announcements`)
      .then((r) => r.json())
      .then((data) => { setAnnouncements(data); setLoading(false); });
  }, [tournament]);

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tournament || !message.trim()) return;
    const res = await fetch(`/api/tournaments/${tournament.id}/announcements`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: message.trim(), priority }),
    });
    if (res.ok) {
      const announcement = await res.json();
      setAnnouncements((prev) => [announcement, ...prev]);

      if (sendPush) {
        setPushStatus('Sending push...');
        const pushRes = await fetch('/api/push/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: tournament.name,
            body: message.trim(),
            url: `/t/${slug}`,
            urgent: priority === 'urgent',
          }),
        });
        if (pushRes.ok) {
          const { sent } = await pushRes.json();
          setPushStatus(`Push sent to ${sent} subscriber${sent !== 1 ? 's' : ''}`);
        } else {
          setPushStatus('Push failed — check auth');
        }
        setTimeout(() => setPushStatus(null), 4000);
      }

      setMessage('');
      setPriority('normal');
    }
  };

  const handleDelete = async (announcementId: string) => {
    if (!tournament) return;
    await fetch(`/api/tournaments/${tournament.id}/announcements`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ announcementId }),
    });
    setAnnouncements((prev) => prev.filter((a) => a.id !== announcementId));
  };

  if (!tournament) return <div className="flex items-center justify-center min-h-screen text-[var(--text-secondary)]">Loading...</div>;

  return (
    <div className="min-h-screen bg-[var(--surface)]">
      <header className="bg-[var(--surface-card)] border-b border-[var(--border)] sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <div className="flex items-center gap-1.5 text-sm text-[var(--text-secondary)]">
            <Link href="/admin" className="hover:text-[var(--text-primary)]">Admin Dashboard</Link>
            <span>›</span>
            <Link href={`/t/${slug}/admin`} className="hover:text-[var(--text-primary)]">{tournament?.name ?? slug}</Link>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <Link href={`/t/${slug}/admin`} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] p-1 -ml-1">
              <ChevronLeft className="w-5 h-5" />
            </Link>
            <h1 className="text-xl font-bold text-[var(--text-primary)]">Announcements</h1>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        <form onSubmit={handlePublish} className="bg-[var(--surface-card)] border border-[var(--border)] rounded-xl p-6 mb-8 space-y-4">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type your announcement..."
            rows={3}
            className="w-full border border-[var(--border)] rounded-lg px-3 py-2 text-sm bg-[var(--surface)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-400"
          />
          <div className="flex items-center gap-4 flex-wrap">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="priority"
                checked={priority === 'normal'}
                onChange={() => setPriority('normal')}
                className="accent-zinc-900"
              />
              <span className="text-sm text-[var(--text-primary)]">Normal</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="priority"
                checked={priority === 'urgent'}
                onChange={() => setPriority('urgent')}
                className="accent-red-600"
              />
              <span className="text-sm text-red-600 font-medium">Urgent</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer ml-auto">
              <input
                type="checkbox"
                checked={sendPush}
                onChange={(e) => setSendPush(e.target.checked)}
                className="accent-blue-600 w-4 h-4"
              />
              <span className="text-sm text-blue-600 dark:text-blue-400 font-medium">Send push notification</span>
            </label>
            <button
              type="submit"
              className="bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-6 py-2 rounded-lg text-sm font-medium hover:opacity-90"
            >
              Publish
            </button>
          </div>
          {pushStatus && (
            <p className="text-sm text-blue-600 dark:text-blue-400 font-medium">{pushStatus}</p>
          )}
        </form>

        {loading ? (
          <p className="text-[var(--text-secondary)] text-center py-12">Loading...</p>
        ) : announcements.length === 0 ? (
          <p className="text-[var(--text-secondary)] text-center py-12">No announcements yet.</p>
        ) : (
          <div className="space-y-3">
            {announcements.map((a) => (
              <div
                key={a.id}
                className={`border rounded-xl p-4 ${
                  a.priority === 'urgent'
                    ? 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20'
                    : 'bg-[var(--surface-card)] border-[var(--border)]'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    {a.priority === 'urgent' && (
                      <span className="text-xs font-medium text-red-600 uppercase">⚠ Urgent</span>
                    )}
                    <p className="text-sm text-[var(--text-primary)] mt-1">{a.message}</p>
                    <p className="text-xs text-[var(--text-secondary)] mt-2">
                      {new Date(a.created_at).toLocaleString()}
                    </p>
                  </div>
                  <button onClick={() => handleDelete(a.id)} className="text-xs text-red-400 hover:text-red-500 shrink-0">
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
