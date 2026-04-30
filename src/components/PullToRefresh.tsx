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
    await new Promise((r) => setTimeout(r, 900));
    setRefreshing(false);
    setPullY(0);
  }, [router]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    function onTouchStart(e: TouchEvent) {
      if (window.scrollY > 4) return;
      startY.current = e.touches[0].clientY;
      pulling.current = true;
    }

    function onTouchMove(e: TouchEvent) {
      if (!pulling.current) return;
      const delta = e.touches[0].clientY - startY.current;
      if (delta > 0 && window.scrollY <= 0) {
        e.preventDefault();
        setPullY(Math.min(THRESHOLD * 1.4, delta * 0.45));
      } else {
        pulling.current = false;
        setPullY(0);
      }
    }

    function onTouchEnd() {
      if (!pulling.current) return;
      pulling.current = false;
      // Read current pullY from ref to avoid stale closure
      setPullY((current) => {
        if (current >= THRESHOLD * 0.45 && !refreshing) {
          doRefresh();
        } else if (!refreshing) {
          return 0;
        }
        return current;
      });
    }

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd);
    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
    };
  }, [refreshing, doRefresh]);

  const progress = Math.min(1, pullY / (THRESHOLD * 0.45));
  const ready = progress >= 1;
  const visible = pullY > 4 || refreshing;

  // Indicator top: starts off-screen (-44px), slides in as user pulls
  const indicatorTop = refreshing ? 12 : Math.max(-44, pullY * 0.9 - 44);

  return (
    <div ref={containerRef}>
      {/* Pull indicator — fixed so it's never clipped by parent overflow */}
      <div
        className="pointer-events-none fixed left-0 right-0 flex justify-center z-[100] transition-all duration-150"
        style={{
          top: indicatorTop,
          opacity: visible ? 1 : 0,
        }}
      >
        <div className="w-9 h-9 rounded-full bg-[var(--surface-card)] border border-[var(--border)] shadow-lg flex items-center justify-center">
          <RefreshCw
            className={`w-4 h-4 text-blue-500 ${refreshing ? 'animate-spin' : 'transition-transform duration-150'}`}
            style={!refreshing ? { transform: `rotate(${progress * 200}deg)` } : undefined}
            strokeWidth={2}
          />
        </div>
      </div>

      {/* No transform here — CSS transforms create a new containing block which
          breaks position:fixed children (e.g. the bottom nav bar). The pull
          indicator above is sufficient visual feedback. */}
      {children}
    </div>
  );
}
