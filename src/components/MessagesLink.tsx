'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Mail } from 'lucide-react';

/**
 * Envelope icon with a red dot when there are unread messages.
 * Only renders when the user is logged in.
 * Re-checks the count on every route change so it clears after visiting /messages.
 */
export default function MessagesLink() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [count, setCount] = useState(0);
  const pathname = usePathname();

  // Track auth state
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      setIsLoggedIn(!!user);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_e, session) => {
      setIsLoggedIn(!!session?.user);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  // Re-fetch unread count whenever auth state or route changes
  useEffect(() => {
    if (!isLoggedIn) { setCount(0); return; }
    fetch('/api/messages/unread')
      .then((r) => (r.ok ? r.json() : { count: 0 }))
      .then((d) => setCount(d.count ?? 0))
      .catch(() => {});
  }, [isLoggedIn, pathname]);

  if (!isLoggedIn) return null;

  return (
    <Link
      href="/messages"
      className="relative flex items-center justify-center w-8 h-8 text-white/70 hover:text-white transition-colors"
      title={count > 0 ? `${count} unread message${count !== 1 ? 's' : ''}` : 'Messages'}
    >
      <Mail className={`w-5 h-5 transition-colors ${count > 0 ? 'text-white' : ''}`} />
      {count > 0 && (
        <span className="absolute top-0.5 right-0.5 w-2 h-2 bg-red-500 rounded-full" />
      )}
    </Link>
  );
}
