// Service Worker for VISION AVAX FOREX — v3
// Handles background push notifications, caching, click routing, and AppMint/AppMySite compatibility

const CACHE_NAME = 'vaf-sw-v3';
const ICON_URL = '/og-image.jpg';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
  // Clean up old caches
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
});

// ── Message from page → show notification ──
self.addEventListener('message', (event) => {
  if (!event.data) return;

  if (event.data.type === 'SHOW_NOTIFICATION') {
    const { title, options = {} } = event.data;
    event.waitUntil(
      self.registration.showNotification(title, {
        body: options.body || '',
        icon: options.icon || ICON_URL,
        badge: options.badge || ICON_URL,
        tag: options.tag || `vaf_${Date.now()}`,
        data: options.data || { url: '/' },
        vibrate: options.vibrate || [200, 100, 200],
        requireInteraction: false,
        silent: false,
        actions: options.actions || [],
      })
    );
  }

  // Ping/pong to check if SW is active
  if (event.data.type === 'PING') {
    event.source && event.source.postMessage({ type: 'PONG' });
  }
});

// ── Notification click → navigate to URL ──
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const url = event.notification.data && event.notification.data.url
    ? event.notification.data.url
    : (typeof event.notification.data === 'string' ? event.notification.data : '/');
  const action = event.action;

  // Handle action buttons
  if (action === 'dismiss') return;

  // Default click → open url
  event.waitUntil(openOrFocusWindow(url));
});

// ── Notification close ──
self.addEventListener('notificationclose', () => {
  // Could track dismissals here
});

// ── Background push (AppMint/AppMySite/FCM push support) ──
self.addEventListener('push', (event) => {
  let data = {};
  try {
    if (event.data) {
      try {
        data = event.data.json();
      } catch {
        data = { body: event.data.text() };
      }
    }
  } catch {}

  // Support both flat and nested notification structures
  const title = data.title || (data.notification && data.notification.title) || 'VISION AVAX FOREX';
  const body = data.body || (data.notification && data.notification.body) || '';
  const icon = data.icon || (data.notification && data.notification.icon) || ICON_URL;
  const clickUrl = data.url || (data.data && data.data.url) || '/';
  const tag = data.tag || `push_${Date.now()}`;

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon,
      badge: ICON_URL,
      tag,
      data: { url: clickUrl },
      vibrate: [200, 100, 200],
      requireInteraction: false,
    })
  );
});

// ── Helper: focus existing tab or open new window ──
async function openOrFocusWindow(url) {
  try {
    const allClients = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    // Try to focus an existing tab at our origin
    for (const client of allClients) {
      if (client.url.startsWith(self.location.origin)) {
        await client.focus();
        // Navigate to the target URL
        if (url && url !== '/' && 'navigate' in client) {
          await client.navigate(self.location.origin + url).catch(() => {});
        }
        return;
      }
    }
    // No existing tab — open a new one
    if (clients.openWindow) {
      const fullUrl = url.startsWith('http') ? url : self.location.origin + url;
      await clients.openWindow(fullUrl);
    }
  } catch (e) {
    // Fail silently
  }
}

const CACHE_NAME = 'vaf-sw-v2';
const ICON_URL = '/favicon.ico';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
  // Clean up old caches
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
});

// ── Message from page → show notification ──
self.addEventListener('message', (event) => {
  if (!event.data) return;

  if (event.data.type === 'SHOW_NOTIFICATION') {
    const { title, options = {} } = event.data;
    event.waitUntil(
      self.registration.showNotification(title, {
        body: options.body || '',
        icon: options.icon || ICON_URL,
        badge: options.badge || ICON_URL,
        tag: options.tag || `vaf_${Date.now()}`,
        data: options.data || { url: '/' },
        vibrate: options.vibrate || [200, 100, 200],
        requireInteraction: false,
        silent: false,
        actions: options.actions || [],
      })
    );
  }

  // Ping/pong to check if SW is active
  if (event.data.type === 'PING') {
    event.source?.postMessage({ type: 'PONG' });
  }
});

// ── Notification click → navigate to URL ──
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const url = event.notification.data?.url || '/';
  const action = event.action;

  // Handle action buttons
  if (action === 'open') {
    event.waitUntil(openOrFocusWindow(url));
    return;
  }
  if (action === 'dismiss') return;

  // Default click → open url
  event.waitUntil(openOrFocusWindow(url));
});

// ── Notification close ──
self.addEventListener('notificationclose', () => {
  // Could track dismissals here
});

// ── Background push (for future server-push support) ──
self.addEventListener('push', (event) => {
  if (!event.data) return;
  try {
    const data = event.data.json();
    const title = data.title || 'VISION AVAX FOREX';
    event.waitUntil(
      self.registration.showNotification(title, {
        body: data.body || '',
        icon: data.icon || ICON_URL,
        badge: ICON_URL,
        tag: data.tag || `push_${Date.now()}`,
        data: { url: data.url || '/' },
        vibrate: [200, 100, 200],
      })
    );
  } catch (e) {
    // Fallback plain text
    event.waitUntil(
      self.registration.showNotification('VISION AVAX FOREX', {
        body: event.data.text() || 'You have a new notification',
        icon: ICON_URL,
        badge: ICON_URL,
        tag: `push_text_${Date.now()}`,
        data: { url: '/' },
      })
    );
  }
});

// ── Helper: focus existing tab or open new window ──
async function openOrFocusWindow(url) {
  const allClients = await clients.matchAll({ type: 'window', includeUncontrolled: true });
  // Try to focus an existing tab at our origin
  for (const client of allClients) {
    if (client.url.startsWith(self.location.origin)) {
      await client.focus();
      // Navigate to the target URL
      if ('navigate' in client) {
        await client.navigate(self.location.origin + url);
      }
      return;
    }
  }
  // No existing tab — open a new one
  if (clients.openWindow) {
    await clients.openWindow(self.location.origin + url);
  }
}
