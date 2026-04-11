'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';

const THRESHOLD = 72; // px to pull before triggering

export default function PullToRefresh({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [pullY, setPullY] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(0);
  const pulling = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const doRefresh = useCallback(async () => {
    setRefreshing(true);
    router.refresh();
    // Give the router a moment, then reset
    await new Promise((r) => setTimeout(r, 900));
    setRefreshing(false);
    setPullY(0);
  }, [router]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    function onTouchStart(e: TouchEvent) {
      // Only trigger when scrolled to very top
      if (window.scrollY > 4) return;
      startY.current = e.touches[0].clientY;
      pulling.current = true;
    }

    function onTouchMove(e: TouchEvent) {
      if (!pulling.current) return;
      const delta = e.touches[0].clientY - startY.current;
      if (delta > 0 && window.scrollY <= 0) {
        e.preventDefault();
        // Rubber-band dampening
        setPullY(Math.min(THRESHOLD * 1.4, delta * 0.45));
      } else {
        pulling.current = false;
        setPullY(0);
      }
    }

    function onTouchEnd() {
      if (!pulling.current) return;
      pulling.current = false;
      if (pullY >= THRESHOLD * 0.45 && !refreshing) {
        doRefresh();
      } else {
        setPullY(0);
      }
    }

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd);
    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
    };
  }, [pullY, refreshing, doRefresh]);

  const progress = Math.min(1, pullY / (THRESHOLD * 0.45));
  const ready = progress >= 1;

  return (
    <div ref={containerRef} className="relative">
      {/* Pull indicator */}
      <div
        className="pointer-events-none absolute left-0 right-0 flex justify-center z-50 transition-all duration-150"
        style={{ top: pullY > 0 || refreshing ? Math.max(-8, pullY - 32) : -40, opacity: pullY > 4 || refreshing ? 1 : 0 }}
      >
        <div className={`w-9 h-9 rounded-full bg-[var(--surface-card)] border border-[var(--border)] shadow-md flex items-center justify-center transition-transform`}>
          <RefreshCw
            className={`w-4 h-4 text-blue-500 transition-all duration-150 ${refreshing ? 'animate-spin' : ''}`}
            style={{ transform: refreshing ? undefined : `rotate(${progress * 180}deg)`, opacity: ready ? 1 : 0.6 }}
            strokeWidth={2}
          />
        </div>
      </div>

      {/* Content shifts down slightly while pulling */}
      <div style={{ transform: pullY > 0 ? `translateY(${pullY * 0.4}px)` : undefined, transition: pullY === 0 ? 'transform 0.2s' : undefined }}>
        {children}
      </div>
    </div>
  );
}
