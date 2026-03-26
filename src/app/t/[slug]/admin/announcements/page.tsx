'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
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

  if (!tournament) return <div className="flex items-center justify-center min-h-screen text-zinc-600">Loading...</div>;

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="bg-white border-b border-zinc-200">
        <div className="max-w-3xl mx-auto px-4 py-6">
          <Link href={`/t/${slug}/admin`} className="text-sm text-zinc-600 hover:text-zinc-800">&larr; Admin</Link>
          <h1 className="text-2xl font-bold tracking-tight mt-1">Announcements</h1>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        <form onSubmit={handlePublish} className="bg-white border border-zinc-200 rounded-xl p-6 mb-8 space-y-4">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type your announcement..."
            rows={3}
            className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
          />
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="priority"
                checked={priority === 'normal'}
                onChange={() => setPriority('normal')}
                className="accent-zinc-900"
              />
              <span className="text-sm">Normal</span>
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
            <button type="submit" className="bg-zinc-900 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-zinc-800 ml-auto">
              Publish
            </button>
          </div>
        </form>

        {loading ? (
          <p className="text-zinc-600 text-center py-12">Loading...</p>
        ) : announcements.length === 0 ? (
          <p className="text-zinc-600 text-center py-12">No announcements yet.</p>
        ) : (
          <div className="space-y-3">
            {announcements.map((a) => (
              <div
                key={a.id}
                className={`bg-white border rounded-xl p-4 ${
                  a.priority === 'urgent' ? 'border-red-200 bg-red-50' : 'border-zinc-200'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    {a.priority === 'urgent' && (
                      <span className="text-xs font-medium text-red-600 uppercase">⚠ Urgent</span>
                    )}
                    <p className="text-sm mt-1">{a.message}</p>
                    <p className="text-xs text-zinc-600 mt-2">
                      {new Date(a.created_at).toLocaleString()}
                    </p>
                  </div>
                  <button onClick={() => handleDelete(a.id)} className="text-xs text-red-400 hover:text-red-600 shrink-0">
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
