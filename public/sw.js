const CACHE_NAME = 'seattle-squash-v2';
const STATIC_ASSETS = ['/', '/manifest.json', '/logo.png'];

// Install: cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: network first, fall back to cache for navigation
self.addEventListener('fetch', (event) => {
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match('/'))
    );
  }
});

// Push: show notification + update home screen badge
self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {};
  const title = data.title || 'Seattle Squash';
  const options = {
    body: data.body || '',
    icon: '/logo.png',
    badge: '/logo.png',
    tag: data.tag || 'default',
    data: { url: data.url || '/' },
    requireInteraction: true,   // stay on screen until dismissed
    renotify: true,             // always vibrate/sound even if same tag
  };

  event.waitUntil(
    self.registration.showNotification(title, options).then(() => {
      // Count all visible notifications and set the app icon badge
      return self.registration.getNotifications().then((notifications) => {
        const count = notifications.length;
        if ('setAppBadge' in self.registration) {
          return self.registration.setAppBadge(count);
        }
        // Fallback: navigator.setAppBadge (some browsers)
        if ('setAppBadge' in self.navigator) {
          return self.navigator.setAppBadge(count);
        }
      });
    })
  );
});

// Only open pages on this site: relative paths or same-origin URLs, else '/'.
function sameOriginUrl(raw) {
  try {
    const target = new URL(raw || '/', self.location.origin);
    if (target.origin === self.location.origin) return target.href;
  } catch (e) { /* fall through */ }
  return self.location.origin + '/';
}

// Notification click: open URL, focus if already open, clear badge if none left
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = sameOriginUrl(event.notification.data?.url);

  event.waitUntil(
    Promise.all([
      // Navigate to the right page
      clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
        for (const client of windowClients) {
          if (client.url === url && 'focus' in client) return client.focus();
        }
        if (clients.openWindow) return clients.openWindow(url);
      }),
      // Update badge count after closing this notification
      self.registration.getNotifications().then((notifications) => {
        // getNotifications() doesn't include the just-closed one yet,
        // so remaining count is notifications.length (already decremented by close())
        const remaining = notifications.length;
        if (remaining === 0) {
          if ('clearAppBadge' in self.registration) return self.registration.clearAppBadge();
          if ('clearAppBadge' in self.navigator) return self.navigator.clearAppBadge();
        } else {
          if ('setAppBadge' in self.registration) return self.registration.setAppBadge(remaining);
          if ('setAppBadge' in self.navigator) return self.navigator.setAppBadge(remaining);
        }
      }),
    ])
  );
});

// Push service rotated/expired the subscription: re-subscribe with the same
// key and tell the server. The key sent is the one actually used, so if it is
// an old (rotated-out) key the server stores it tagged as such, the sender
// skips it, and the page migrates it to the current key on the next visit.
function toBase64Url(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil((async () => {
    const oldSub = event.oldSubscription;
    const oldKey = oldSub && oldSub.options ? oldSub.options.applicationServerKey : null;
    let sub = event.newSubscription;
    if (!sub) {
      if (!oldKey) return; // nothing to re-subscribe with; the page handles it on next visit
      sub = await self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: oldKey });
    }
    if (oldSub && oldSub.endpoint !== sub.endpoint) {
      await fetch('/api/push/subscribe', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: oldSub.endpoint }),
      }).catch(() => {});
    }
    const key = (sub.options && sub.options.applicationServerKey) || oldKey;
    await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint: sub.endpoint,
        p256dh: toBase64Url(sub.getKey('p256dh')),
        auth: toBase64Url(sub.getKey('auth')),
        userAgent: self.navigator.userAgent,
        applicationServerKey: key ? toBase64Url(key) : undefined,
      }),
    });
  })().catch(() => {}));
});

// Message from app: clear badge when user opens the app
self.addEventListener('message', (event) => {
  if (event.data === 'CLEAR_BADGE') {
    if ('clearAppBadge' in self.registration) self.registration.clearAppBadge();
    if ('clearAppBadge' in self.navigator) self.navigator.clearAppBadge();
  }
});
