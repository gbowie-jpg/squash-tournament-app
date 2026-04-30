'use client';

import { useRef, useState, useCallback } from 'react';

/**
 * ZoomableBracket — wraps the bracket canvas in a pinch-to-zoom container.
 *
 * Touch: two-finger pinch scales between 0.4× and 3×.
 * Buttons: optional ± controls rendered below (shown on non-touch screens).
 * The inner content is scrollable at any zoom level.
 */
export default function ZoomableBracket({ children }: { children: React.ReactNode }) {
  const [scale, setScale] = useState(1);
  const lastDist = useRef<number | null>(null);
  const outerRef = useRef<HTMLDivElement>(null);

  function getDistance(touches: React.TouchList): number {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length !== 2) { lastDist.current = null; return; }
    e.stopPropagation(); // don't interfere with pull-to-refresh
    const dist = getDistance(e.touches);
    if (lastDist.current !== null) {
      const ratio = dist / lastDist.current;
      setScale(s => Math.min(3, Math.max(0.4, s * ratio)));
    }
    lastDist.current = dist;
  }, []);

  const handleTouchEnd = useCallback(() => {
    lastDist.current = null;
  }, []);

  const zoom = (delta: number) => setScale(s => Math.min(3, Math.max(0.4, s + delta)));
  const reset = () => setScale(1);

  return (
    <div>
      {/* Zoom controls — visible on all devices, especially useful on desktop */}
      <div className="flex items-center gap-2 mb-3">
        <button
          onClick={() => zoom(-0.2)}
          className="w-8 h-8 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text-secondary)] font-bold text-lg flex items-center justify-center hover:text-[var(--text-primary)] transition-colors"
          aria-label="Zoom out"
        >−</button>
        <button
          onClick={reset}
          className="px-2 h-8 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          aria-label="Reset zoom"
        >{Math.round(scale * 100)}%</button>
        <button
          onClick={() => zoom(0.2)}
          className="w-8 h-8 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text-secondary)] font-bold text-lg flex items-center justify-center hover:text-[var(--text-primary)] transition-colors"
          aria-label="Zoom in"
        >+</button>
        <span className="text-xs text-[var(--text-secondary)] ml-1 hidden sm:inline">
          Pinch to zoom on mobile
        </span>
      </div>

      {/* Scrollable container — also receives pinch events */}
      <div
        ref={outerRef}
        className="overflow-auto"
        style={{ touchAction: 'pan-x pan-y' }}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div
          style={{
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
            // Expand the scroll area to match the scaled size
            width: `${100 / scale}%`,
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
