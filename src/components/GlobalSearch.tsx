'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Search, X } from 'lucide-react';

type SearchResult = {
  type: 'player' | 'match' | 'court' | 'tournament';
  title: string;
  subtitle: string;
  href: string;
};

const TYPE_LABEL: Record<SearchResult['type'], string> = {
  player: 'Player',
  match: 'Match',
  court: 'Court',
  tournament: 'Tournament',
};

const TYPE_COLOR: Record<SearchResult['type'], string> = {
  player: 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400',
  match: 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400',
  court: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400',
  tournament: 'bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-400',
};

export default function GlobalSearch() {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Detect tournament scope from the URL (/t/[slug]/...)
  const scopeSlug = (() => {
    const m = pathname?.match(/^\/t\/([^/]+)/);
    return m ? m[1] : null;
  })();

  // Cmd/Ctrl+K to open
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
    else { setQuery(''); setResults([]); setActiveIdx(0); }
  }, [open]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  // Debounced search
  const doSearch = useCallback(async (q: string) => {
    if (q.trim().length < 2) { setResults([]); return; }
    setLoading(true);
    try {
      const params = new URLSearchParams({ q });
      if (scopeSlug) params.set('tournament', scopeSlug);
      const res = await fetch(`/api/search?${params}`);
      const data = await res.json();
      setResults(data.results || []);
      setActiveIdx(0);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [scopeSlug]);

  useEffect(() => {
    const t = setTimeout(() => doSearch(query), 200);
    return () => clearTimeout(t);
  }, [query, doSearch]);

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  const onInputKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx((i) => Math.min(i + 1, results.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx((i) => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter' && results[activeIdx]) { e.preventDefault(); go(results[activeIdx].href); }
  };

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(true)}
        aria-label="Search"
        className="text-white/70 hover:text-white hover:bg-white/10 p-2 rounded-lg transition-colors"
      >
        <Search className="w-4 h-4" />
      </button>

      {/* Overlay */}
      {open && (
        <div className="fixed inset-0 z-[9998] bg-black/40 flex items-start justify-center pt-[12vh] px-4">
          <div ref={containerRef} className="w-full max-w-lg bg-[var(--surface-card)] rounded-2xl shadow-2xl border border-[var(--border)] overflow-hidden">
            {/* Input */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--border)]">
              <Search className="w-4 h-4 text-[var(--text-muted)] shrink-0" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onInputKey}
                placeholder={scopeSlug ? 'Search players, matches, courts…' : 'Search players, courts, tournaments…'}
                className="flex-1 bg-transparent text-[var(--text-primary)] text-sm focus:outline-none placeholder:text-[var(--text-muted)]"
              />
              {query && (
                <button onClick={() => setQuery('')} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Results */}
            <div className="max-h-[55vh] overflow-y-auto">
              {loading && <p className="px-4 py-6 text-center text-sm text-[var(--text-muted)]">Searching…</p>}
              {!loading && query.length >= 2 && results.length === 0 && (
                <p className="px-4 py-6 text-center text-sm text-[var(--text-muted)]">No results for &ldquo;{query}&rdquo;</p>
              )}
              {!loading && query.length < 2 && (
                <p className="px-4 py-6 text-center text-xs text-[var(--text-muted)]">
                  Type at least 2 characters{scopeSlug ? '' : ' · searches everything'}
                </p>
              )}
              {results.map((r, i) => (
                <button
                  key={`${r.type}-${i}`}
                  onClick={() => go(r.href)}
                  onMouseEnter={() => setActiveIdx(i)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${i === activeIdx ? 'bg-[var(--surface)]' : ''}`}
                >
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded uppercase tracking-wide shrink-0 ${TYPE_COLOR[r.type]}`}>
                    {TYPE_LABEL[r.type]}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-medium text-[var(--text-primary)] truncate">{r.title}</span>
                    <span className="block text-xs text-[var(--text-muted)] truncate">{r.subtitle}</span>
                  </span>
                </button>
              ))}
            </div>

            {/* Footer hint */}
            <div className="px-4 py-2 border-t border-[var(--border)] flex items-center gap-3 text-[10px] text-[var(--text-muted)]">
              <span>↑↓ navigate</span>
              <span>↵ open</span>
              <span>esc close</span>
              {scopeSlug && <span className="ml-auto">Scoped to this tournament</span>}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
