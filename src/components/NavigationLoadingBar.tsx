'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

/**
 * Thin progress bar at the top of the page that animates during
 * client-side navigation. Detects route changes via usePathname.
 */
export default function NavigationLoadingBar() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const [width, setWidth] = useState(0);
  const prev = useRef(pathname);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Kick off animation whenever pathname changes
  useEffect(() => {
    if (prev.current === pathname) return;
    prev.current = pathname;
    // Navigation completed — shoot to 100 then fade
    setWidth(100);
    timerRef.current = setTimeout(() => {
      setVisible(false);
      setWidth(0);
    }, 350);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [pathname]);

  // Attach click handlers to all links to start the bar
  useEffect(() => {
    function onLinkClick(e: MouseEvent) {
      const target = (e.target as HTMLElement).closest('a');
      if (!target || !target.href) return;
      const url = new URL(target.href, window.location.href);
      // Only internal same-origin navigations
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname) return;
      // Start the loading bar
      if (timerRef.current) clearTimeout(timerRef.current);
      setVisible(true);
      setWidth(15);
      // Slowly creep to 85% while waiting
      timerRef.current = setTimeout(() => setWidth(85), 100);
    }
    document.addEventListener('click', onLinkClick);
    return () => document.removeEventListener('click', onLinkClick);
  }, []);

  if (!visible && width === 0) return null;

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[9999] h-0.5 pointer-events-none"
      style={{ opacity: visible ? 1 : 0, transition: 'opacity 0.3s ease' }}
    >
      <div
        className="h-full bg-blue-500"
        style={{
          width: `${width}%`,
          transition: width === 100 ? 'width 0.25s ease-out' : 'width 1.5s ease-out',
        }}
      />
    </div>
  );
}
