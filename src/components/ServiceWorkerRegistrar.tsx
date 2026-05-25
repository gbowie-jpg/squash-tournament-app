'use client';

import { useEffect } from 'react';

async function clearBadge() {
  try {
    // Tell the service worker to clear the badge
    const reg = await navigator.serviceWorker.ready;
    reg.active?.postMessage('CLEAR_BADGE');

    // Also clear directly from the page context as a fallback
    if ('clearAppBadge' in navigator) {
      await (navigator as Navigator & { clearAppBadge: () => Promise<void> }).clearAppBadge();
    }
  } catch {
    // Non-critical — badge clear failing is silent
  }
}

export default function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    // Register service worker
    navigator.serviceWorker.register('/sw.js').catch(console.error);

    // Clear badge whenever the app is opened or brought to foreground
    clearBadge();
    const handleFocus = () => clearBadge();
    const handleVisible = () => { if (document.visibilityState === 'visible') clearBadge(); };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisible);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisible);
    };
  }, []);

  return null;
}
