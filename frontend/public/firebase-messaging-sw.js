// Firebase Cloud Messaging Service Worker
// This file MUST be at /firebase-messaging-sw.js (root of the domain)
// It handles background push notifications when the app is not open.

importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

// These values will be injected at build time or via the env mechanism.
// For now they are read from the service worker's globalThis scope.
// The app sets them via a message event when it registers this SW.

let messaging = null;

// Listen for config message from the main app thread
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'FIREBASE_CONFIG') {
    try {
      const app = firebase.initializeApp(event.data.config);
      messaging = firebase.messaging(app);

      // Handle background messages
      messaging.onBackgroundMessage((payload) => {
        const { title, body, icon } = payload.notification || {};
        self.registration.showNotification(title || 'SmartVehicle Alert', {
          body: body || 'You have a new vehicle alert.',
          icon: icon || '/favicon.png',
          badge: '/favicon.png',
          tag: 'vehicle-alert',
          renotify: true,
          requireInteraction: true,
          data: payload.data || {},
          actions: [
            { action: 'open', title: '📱 Open App' },
            { action: 'dismiss', title: 'Dismiss' }
          ]
        });
      });
    } catch (e) {
      // Already initialised — safe to ignore
    }
  }
});

// Handle notification click — open the owner portal
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') return;

  const urlToOpen = self.location.origin + '/owner';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes('/owner') && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
