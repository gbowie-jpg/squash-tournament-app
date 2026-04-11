'use client';

import Link from 'next/link';
import { Home, ChevronLeft } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[var(--surface)] flex flex-col items-center justify-center px-4 text-center">
      <p className="text-7xl font-black text-zinc-200 dark:text-zinc-800 mb-6 select-none">404</p>
      <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-2">Page not found</h1>
      <p className="text-[var(--text-secondary)] mb-8 max-w-xs">
        This page doesn&apos;t exist or may have been moved.
      </p>
      <div className="flex flex-col sm:flex-row gap-3">
        <Link
          href="/"
          className="inline-flex items-center gap-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-6 py-3 rounded-xl font-semibold text-sm hover:opacity-90 transition-opacity"
        >
          <Home className="w-4 h-4" strokeWidth={2} />
          Go Home
        </Link>
        <button
          onClick={() => history.back()}
          className="inline-flex items-center gap-2 bg-[var(--surface-card)] border border-[var(--border)] text-[var(--text-primary)] px-6 py-3 rounded-xl font-semibold text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Go Back
        </button>
      </div>
    </div>
  );
}
