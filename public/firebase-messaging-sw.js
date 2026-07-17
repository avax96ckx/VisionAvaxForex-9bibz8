// Firebase Messaging Service Worker
// This service worker enables push notifications when the app is used via AppMint/AppMySite

// Import Firebase scripts
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

// Firebase config — replace with your actual Firebase project config if using FCM
// For AppMint notifications to work, you need a Firebase project
const firebaseConfig = {
  apiKey: "AIzaSyPlaceholder",
  authDomain: "vision-avax-forex.firebaseapp.com",
  projectId: "vision-avax-forex",
  storageBucket: "vision-avax-forex.appspot.com",
  messagingSenderId: "103953800507",
  appId: "1:103953800507:web:placeholder"
};

// Initialize Firebase
try {
  firebase.initializeApp(firebaseConfig);
  const messaging = firebase.messaging();

  // Handle background messages (when app is minimized/closed)
  messaging.onBackgroundMessage(function(payload) {
    console.log('[firebase-messaging-sw.js] Received background message ', payload);
    const notificationTitle = payload.notification?.title || 'VISION AVAX FOREX';
    const notificationOptions = {
      body: payload.notification?.body || 'New update',
      icon: '/og-image.jpg',
      badge: '/og-image.jpg',
      data: payload.data || {},
      requireInteraction: false,
      vibrate: [200, 100, 200],
    };
    self.registration.showNotification(notificationTitle, notificationOptions);
  });
} catch (e) {
  console.log('[firebase-messaging-sw.js] Firebase init skipped:', e.message);
}

// Handle notification click — open app URL
self.addEventListener('notificationclick', function(event) {
  console.log('[firebase-messaging-sw.js] Notification click received.');
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      // If app is already open, focus it
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if ('focus' in client) {
          client.focus();
          if (url && url !== '/') client.navigate(url).catch(() => {});
          return;
        }
      }
      // Otherwise open new window
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});

// Handle push events directly (for non-Firebase push services like AppMint)
self.addEventListener('push', function(event) {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: 'VISION AVAX FOREX', body: event.data ? event.data.text() : 'New notification' };
  }

  const title = data.title || data.notification?.title || 'VISION AVAX FOREX';
  const options = {
    body: data.body || data.notification?.body || 'You have a new notification',
    icon: data.icon || '/og-image.jpg',
    badge: '/og-image.jpg',
    data: data.data || data.url || { url: '/' },
    requireInteraction: false,
    vibrate: [200, 100, 200],
    tag: data.tag || 'vaf-notification',
  };

  event.waitUntil(self.registration.showNotification(title, options));
});
