'use client';

import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function RefreshButton({ className = '' }: { className?: string }) {
  const router = useRouter();
  const [spinning, setSpinning] = useState(false);

  function handleRefresh() {
    if (spinning) return;
    setSpinning(true);
    router.refresh();
    setTimeout(() => setSpinning(false), 800);
  }

  return (
    <button
      onClick={handleRefresh}
      aria-label="Refresh"
      className={`p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors ${className}`}
    >
      <RefreshCw className={`w-4 h-4 ${spinning ? 'animate-spin' : ''}`} strokeWidth={1.75} />
    </button>
  );
}
