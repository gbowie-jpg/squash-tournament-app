'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

type MasqueradeInfo = { name: string; email: string };

const STORAGE_KEY = 'masquerade';

export default function MasqueradeBanner() {
  const [info, setInfo] = useState<MasqueradeInfo | null>(null);
  const router = useRouter();

  useEffect(() => {
    // Read on mount
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setInfo(JSON.parse(raw));
    } catch {
      // ignore
    }

    // Listen for changes in other tabs
    const handler = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        try {
          setInfo(e.newValue ? JSON.parse(e.newValue) : null);
        } catch {
          setInfo(null);
        }
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  if (!info) return null;

  const handleStop = async () => {
    localStorage.removeItem(STORAGE_KEY);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
  };

  return (
    <div className="bg-amber-400 text-amber-950 px-4 py-2 flex items-center justify-center gap-3 text-sm font-medium z-50 sticky top-0">
      <span>🎭 Masquerading as <strong>{info.name}</strong></span>
      <span className="opacity-60 text-xs">({info.email})</span>
      <button
        onClick={handleStop}
        className="bg-amber-900 text-amber-100 px-3 py-0.5 rounded-lg text-xs font-semibold hover:bg-amber-800 transition-colors"
      >
        Stop &amp; Sign Out
      </button>
    </div>
  );
}

/** Call this before navigating to a masquerade magic link. */
export function startMasquerade(name: string, email: string) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ name, email }));
    // Dispatch a storage event so the banner in the same tab can react
    window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY, newValue: JSON.stringify({ name, email }) }));
  } catch {
    // ignore
  }
}
