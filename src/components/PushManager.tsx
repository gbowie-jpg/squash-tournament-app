'use client';

import { useEffect, useState } from 'react';
import { BellRing, BellOff } from 'lucide-react';

// Inlined at build time. After a VAPID rotation, browsers that subscribed
// under the old key are migrated on their next visit (see syncOnLoad).
const VAPID_PUBLIC_KEY = (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '').trim();

type Status = 'idle' | 'subscribed' | 'denied' | 'unsupported';

/** '1' once the user has opted in (explicit subscribe, or an existing subscription was found). */
const LS_OPT_IN = 'push:optedIn';
/** `${endpoint}|${key}` of the last subscription successfully POSTed to the server. */
const LS_SYNCED = 'push:synced';

function lsGet(key: string): string | null {
  try { return window.localStorage.getItem(key); } catch { return null; }
}
function lsSet(key: string, value: string): boolean {
  try { window.localStorage.setItem(key, value); return true; } catch { return false; }
}
function lsRemove(key: string) {
  try { window.localStorage.removeItem(key); } catch { /* ignore */ }
}
function lsAvailable(): boolean {
  try {
    window.localStorage.setItem('push:probe', '1');
    window.localStorage.removeItem('push:probe');
    return true;
  } catch {
    return false;
  }
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

function currentKeyBytes(): Uint8Array<ArrayBuffer> | null {
  if (!VAPID_PUBLIC_KEY) return null;
  try { return urlBase64ToUint8Array(VAPID_PUBLIC_KEY); } catch { return null; }
}

function isSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window &&
    currentKeyBytes() !== null
  );
}

function bytesEqual(a: Uint8Array, b: Uint8Array) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

const syncedMarker = (endpoint: string) => `${endpoint}|${VAPID_PUBLIC_KEY}`;

/**
 * Was this subscription created with a different key than the current one?
 * Prefers the browser's own record (options.applicationServerKey); falls back
 * to the localStorage marker; returns false if neither is available, so we
 * never loop re-subscribing on every visit.
 */
function isStale(sub: PushSubscription, cur: Uint8Array): boolean {
  const raw = sub.options?.applicationServerKey;
  if (raw) return !bytesEqual(new Uint8Array(raw), cur);
  if (!lsAvailable()) return false;
  return !(lsGet(LS_SYNCED) ?? '').endsWith('|' + VAPID_PUBLIC_KEY);
}

/** Endpoints already POSTed during this page load (used when localStorage is unavailable). */
const postedThisLoad = new Set<string>();

async function postSubscription(sub: PushSubscription): Promise<boolean> {
  try {
    const res = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint: sub.endpoint,
        p256dh: btoa(String.fromCharCode(...new Uint8Array(sub.getKey('p256dh')!))),
        auth: btoa(String.fromCharCode(...new Uint8Array(sub.getKey('auth')!))),
        userAgent: navigator.userAgent,
        applicationServerKey: VAPID_PUBLIC_KEY,
      }),
    });
    if (!res.ok) return false;
    postedThisLoad.add(sub.endpoint);
    lsSet(LS_SYNCED, syncedMarker(sub.endpoint));
    return true;
  } catch {
    return false;
  }
}

async function deleteOnServer(endpoint: string) {
  await fetch('/api/push/subscribe', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint }),
  }).catch(() => {});
}

/** Drop a subscription made with another key: server row first, then the browser's. */
async function discardStale(sub: PushSubscription) {
  await deleteOnServer(sub.endpoint);
  await sub.unsubscribe().catch(() => false);
  lsRemove(LS_SYNCED);
}

async function subscribeWithCurrentKey(reg: ServiceWorkerRegistration, cur: Uint8Array<ArrayBuffer>): Promise<PushSubscription> {
  return reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: cur,
  });
}

async function syncOnLoad(): Promise<Status> {
  if (!isSupported()) return 'unsupported';
  navigator.serviceWorker.register('/sw.js').catch(console.error);

  if (Notification.permission === 'denied') return 'denied';
  if (Notification.permission !== 'granted') return 'idle';

  const cur = currentKeyBytes()!;
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();

  if (sub) {
    // An existing subscription proves the user opted in; the flag also lets a
    // failed re-subscribe below retry on the next visit.
    lsSet(LS_OPT_IN, '1');
    if (!isStale(sub, cur)) {
      const synced = lsAvailable()
        ? lsGet(LS_SYNCED) === syncedMarker(sub.endpoint)
        : postedThisLoad.has(sub.endpoint);
      // Re-tags legacy (NULL-key) rows and restores rows deleted server-side.
      // If the POST fails, show the bell off so a tap re-POSTs this subscription.
      if (!synced && !(await postSubscription(sub))) return 'idle';
      return 'subscribed';
    }
    await discardStale(sub);
  } else if (lsGet(LS_OPT_IN) !== '1') {
    // Permission granted elsewhere, or the user turned alerts off: respect it.
    return 'idle';
  }

  try {
    const fresh = await subscribeWithCurrentKey(reg, cur);
    // If the POST fails, the browser subscription stays and the bell shows off.
    // A tap re-POSTs it (subscribe() reuses the non-stale subscription), or the
    // next visit does, because LS_OPT_IN stays '1' and LS_SYNCED wasn't updated.
    return (await postSubscription(fresh)) ? 'subscribed' : 'idle';
  } catch {
    // e.g. Safari requires a user gesture: the bell stays tappable.
    return 'idle';
  }
}

// Shared across every mounted PushManager (nav + tournament sidebar) and
// across client-side navigations, so the migration runs once per page load.
let loadSync: Promise<void> | null = null;
let sharedStatus: Status = 'idle';
const listeners = new Set<(s: Status) => void>();

function setSharedStatus(s: Status) {
  sharedStatus = s;
  listeners.forEach((fn) => fn(s));
}

function ensureLoadSync(): Promise<void> {
  if (!loadSync) {
    loadSync = syncOnLoad()
      .catch(() => 'idle' as Status)
      .then(setSharedStatus);
  }
  return loadSync;
}

export default function PushManager() {
  const [status, setStatus] = useState<Status>(sharedStatus);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    listeners.add(setStatus);
    setStatus(sharedStatus);
    ensureLoadSync();
    return () => { listeners.delete(setStatus); };
  }, []);

  const subscribe = async () => {
    setLoading(true);
    try {
      // Ask first: Safari only allows the prompt close to the tap.
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') { setSharedStatus('denied'); return; }
      await ensureLoadSync(); // don't race the on-load migration

      const cur = currentKeyBytes();
      if (!cur) { setSharedStatus('unsupported'); return; }

      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (sub && isStale(sub, cur)) {
        // Subscribing with a new key while an old-key subscription exists throws InvalidStateError.
        await discardStale(sub);
        sub = null;
      }
      if (!sub) sub = await subscribeWithCurrentKey(reg, cur);

      if (!(await postSubscription(sub))) { setSharedStatus('idle'); return; }
      lsSet(LS_OPT_IN, '1');
      setSharedStatus('subscribed');
    } catch (err) {
      console.error('Push subscribe error:', err);
    } finally {
      setLoading(false);
    }
  };

  const unsubscribe = async () => {
    setLoading(true);
    try {
      await ensureLoadSync();
      lsRemove(LS_OPT_IN);
      lsRemove(LS_SYNCED);
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await deleteOnServer(sub.endpoint);
        await sub.unsubscribe();
      }
      setSharedStatus('idle');
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
