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

// Notification click: open URL, focus if already open, clear badge if none left
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';

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

// Message from app: clear badge when user opens the app
self.addEventListener('message', (event) => {
  if (event.data === 'CLEAR_BADGE') {
    if ('clearAppBadge' in self.registration) self.registration.clearAppBadge();
    if ('clearAppBadge' in self.navigator) self.navigator.clearAppBadge();
  }
});
