'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { UserCircle } from 'lucide-react';

export default function AuthButton() {
  const [email, setEmail] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    supabase.auth.getUser().then(({ data: { user } }) => {
      setEmail(user?.email ?? null);
      if (user) {
        fetch('/api/account/profile')
          .then((r) => r.ok ? r.json() : null)
          .then((p) => {
            if (p?.role === 'admin' || p?.role === 'superadmin') setIsAdmin(true);
          })
          .catch(() => {})
          .finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_e, session) => {
      setEmail(session?.user?.email ?? null);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  if (loading) return <div className="w-20 h-8 rounded-lg bg-white/10 animate-pulse" />;

  if (email) {
    return (
      <Link
        href={isAdmin ? '/admin' : '/account'}
        className="flex items-center gap-2 bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
        title={email}
      >
        <span className="w-6 h-6 rounded-full bg-blue-500 text-white text-xs font-bold flex items-center justify-center">
          {email[0].toUpperCase()}
        </span>
        <span className="hidden sm:inline text-white/90">{isAdmin ? 'Dashboard' : 'My Account'}</span>
      </Link>
    );
  }

  return (
    <Link
      href="/login"
      className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors text-white/90"
    >
      <UserCircle className="w-4 h-4" />
      <span>Sign In</span>
    </Link>
  );
}
