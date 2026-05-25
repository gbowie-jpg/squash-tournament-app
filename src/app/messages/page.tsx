'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import SiteNav from '@/components/layout/SiteNav';
import SiteFooter from '@/components/layout/SiteFooter';
import { createClient } from '@/lib/supabase/client';
import { Bell, BellOff } from 'lucide-react';

type Message = {
  id: string;
  title: string;
  body: string;
  tournament_id: string | null;
  created_at: string;
  read: boolean;
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

export default function MessagesPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.push('/login?redirect=/messages');
        return;
      }
      fetch('/api/messages')
        .then((r) => r.json())
        .then((data: Message[]) => {
          setMessages(data);
          setLoading(false);
          // Mark all as read in the background
          if (data.some((m) => !m.read)) {
            fetch('/api/messages/read-all', { method: 'POST' }).catch(() => {});
          }
        })
        .catch(() => setLoading(false));
    });
  }, [router]);

  const unreadCount = messages.filter((m) => !m.read).length;

  return (
    <div className="min-h-screen flex flex-col bg-[var(--surface)]">
      <SiteNav />

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-[var(--text-primary)] flex items-center gap-2.5">
            <Bell className="w-6 h-6" />
            Inbox
          </h1>
          {unreadCount > 0 && !loading && (
            <span className="text-sm text-blue-600 dark:text-blue-400 font-medium">
              {unreadCount} unread
            </span>
          )}
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-[var(--surface-card)] border border-[var(--border)] rounded-xl p-4 animate-pulse">
                <div className="h-4 bg-[var(--border)] rounded w-3/4 mb-2" />
                <div className="h-3 bg-[var(--border)] rounded w-full mb-1" />
                <div className="h-3 bg-[var(--border)] rounded w-24 mt-2" />
              </div>
            ))}
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-20 text-[var(--text-secondary)]">
            <BellOff className="w-12 h-12 mx-auto mb-4 opacity-25" />
            <p className="font-medium text-[var(--text-primary)]">All caught up</p>
            <p className="text-sm mt-1">Match alerts and announcements will appear here.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`bg-[var(--surface-card)] border rounded-xl p-4 transition-colors ${
                  !m.read
                    ? 'border-blue-400/50 dark:border-blue-500/30'
                    : 'border-[var(--border)]'
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Unread dot */}
                  <div className="mt-1.5 shrink-0 w-2">
                    {!m.read && <span className="block w-2 h-2 rounded-full bg-blue-500" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm leading-snug ${!m.read ? 'font-semibold text-[var(--text-primary)]' : 'text-[var(--text-primary)]'}`}>
                      {m.title}
                    </p>
                    {m.body && m.body !== m.title && (
                      <p className="text-sm text-[var(--text-secondary)] mt-0.5 leading-snug">
                        {m.body}
                      </p>
                    )}
                    <p className="text-xs text-[var(--text-muted)] mt-1.5">
                      {timeAgo(m.created_at)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}
