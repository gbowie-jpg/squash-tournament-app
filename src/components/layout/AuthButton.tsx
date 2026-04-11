'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

export default function AuthButton() {
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      setEmail(user?.email ?? null);
      setLoading(false);
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
        href="/account"
        className="flex items-center gap-2 bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
        title={email}
      >
        <span className="w-6 h-6 rounded-full bg-blue-400 text-white text-xs font-bold flex items-center justify-center">
          {email[0].toUpperCase()}
        </span>
        <span className="hidden sm:inline">My Account</span>
      </Link>
    );
  }

  return (
    <Link href="/login" className="bg-blue-600 hover:bg-blue-700 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors">
      Sign In
    </Link>
  );
}
