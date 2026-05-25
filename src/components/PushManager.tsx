'use client';

import { useEffect, useState } from 'react';
import { BellRing, BellOff } from 'lucide-react';

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!;

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

export default function PushManager() {
  const [status, setStatus] = useState<'idle' | 'subscribed' | 'denied' | 'unsupported'>('idle');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setStatus('unsupported');
      return;
    }
    // Register service worker
    navigator.serviceWorker.register('/sw.js').catch(console.error);

    // Check current permission
    if (Notification.permission === 'denied') setStatus('denied');
    else if (Notification.permission === 'granted') {
      // Check if already subscribed
      navigator.serviceWorker.ready.then((reg) =>
        reg.pushManager.getSubscription().then((sub) => {
          if (sub) setStatus('subscribed');
        })
      );
    }
  }, []);

  const subscribe = async () => {
    setLoading(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') { setStatus('denied'); return; }

      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: sub.endpoint,
          p256dh: btoa(String.fromCharCode(...new Uint8Array(sub.getKey('p256dh')!))),
          auth: btoa(String.fromCharCode(...new Uint8Array(sub.getKey('auth')!))),
          userAgent: navigator.userAgent,
        }),
      });

      setStatus('subscribed');
    } catch (err) {
      console.error('Push subscribe error:', err);
    } finally {
      setLoading(false);
    }
  };

  const unsubscribe = async () => {
    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch('/api/push/subscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setStatus('idle');
    } finally {
      setLoading(false);
    }
  };

  if (status === 'unsupported' || status === 'denied') return null;

  return (
    <div className="relative">
      {status === 'subscribed' ? (
        <button
          onClick={unsubscribe}
          disabled={loading}
          aria-label="Alerts on — tap to turn off"
          title="Alerts on — tap to turn off"
          className="flex items-center justify-center w-8 h-8 text-white/70 hover:text-white transition-colors"
        >
          <BellRing className="w-5 h-5" />
        </button>
      ) : (
        <button
          onClick={subscribe}
          disabled={loading}
          aria-label="Enable alerts"
          title="Enable alerts"
          className="flex items-center justify-center w-8 h-8 text-white/40 hover:text-white transition-colors"
        >
          <BellOff className="w-5 h-5" />
          {/* Yellow dot urging user to enable */}
          <span className="absolute top-0.5 right-0.5 w-2 h-2 bg-yellow-400 rounded-full" />
        </button>
      )}
    </div>
  );
}
