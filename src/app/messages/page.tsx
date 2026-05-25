'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import SiteNav from '@/components/layout/SiteNav';
import SiteFooter from '@/components/layout/SiteFooter';
import { createClient } from '@/lib/supabase/client';
import { Mail, MailOpen, BellOff } from 'lucide-react';

type Message = {
  id: string;
  title: string;
  body: string;
  url: string | null;
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
  const [markingAll, setMarkingAll] = useState(false);

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
        })
        .catch(() => setLoading(false));
    });
  }, [router]);

  const unreadCount = messages.filter((m) => !m.read).length;

  const toggleRead = async (msg: Message) => {
    const nowRead = !msg.read;
    // Optimistic update
    setMessages((prev) =>
      prev.map((m) => (m.id === msg.id ? { ...m, read: nowRead } : m)),
    );
    const method = nowRead ? 'POST' : 'DELETE';
    const res = await fetch(`/api/messages/${msg.id}/read`, { method });
    if (!res.ok) {
      // Revert on failure
      setMessages((prev) =>
        prev.map((m) => (m.id === msg.id ? { ...m, read: !nowRead } : m)),
      );
    }
  };

  const markAllRead = async () => {
    if (unreadCount === 0) return;
    setMarkingAll(true);
    await fetch('/api/messages/read-all', { method: 'POST' }).catch(() => {});
    setMessages((prev) => prev.map((m) => ({ ...m, read: true })));
    setMarkingAll(false);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[var(--surface)]">
      <SiteNav />

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-[var(--text-primary)] flex items-center gap-2.5">
            <Mail className="w-6 h-6" />
            Inbox
          </h1>
          {unreadCount > 0 && !loading && (
            <button
              onClick={markAllRead}
              disabled={markingAll}
              className="text-sm text-blue-600 dark:text-blue-400 font-medium hover:underline disabled:opacity-50"
            >
              Mark all read
            </button>
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
            {messages.map((m) => {
              const cardContent = (
                <div className="flex items-start gap-3">
                  {/* Read/unread toggle icon */}
                  <button
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleRead(m); }}
                    className="mt-0.5 shrink-0 text-[var(--text-muted)] hover:text-blue-500 transition-colors"
                    aria-label={m.read ? 'Mark unread' : 'Mark read'}
                    title={m.read ? 'Mark unread' : 'Mark read'}
                  >
                    {m.read
                      ? <MailOpen className="w-4 h-4" />
                      : <Mail className="w-4 h-4 text-blue-500" />
                    }
                  </button>
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
                  {m.url && (
                    <span className="shrink-0 text-xs text-blue-500 dark:text-blue-400 mt-0.5">
                      View →
                    </span>
                  )}
                </div>
              );

              const cardClass = `bg-[var(--surface-card)] border rounded-xl p-4 transition-colors ${
                !m.read
                  ? 'border-blue-400/50 dark:border-blue-500/30'
                  : 'border-[var(--border)]'
              }`;

              if (m.url) {
                return (
                  <Link
                    key={m.id}
                    href={m.url}
                    onClick={() => { if (!m.read) toggleRead(m); }}
                    className={`block ${cardClass} hover:border-blue-400/70`}
                  >
                    {cardContent}
                  </Link>
                );
              }

              return (
                <div key={m.id} className={cardClass}>
                  {cardContent}
                </div>
              );
            })}
          </div>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}
