// Firebase Cloud Messaging Service Worker
// This file MUST be at /firebase-messaging-sw.js (root of the domain)
// It handles background push notifications when the app is not open.

importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

// Force immediate activation
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

// Read config from URL parameters
const params = new URL(location).searchParams;
const firebaseConfig = {
  apiKey: params.get('apiKey'),
  projectId: params.get('projectId'),
  messagingSenderId: params.get('messagingSenderId'),
  appId: params.get('appId'),
};

if (firebaseConfig.apiKey) {
  try {
    const app = firebase.initializeApp(firebaseConfig);
    const messaging = firebase.messaging(app);

    // Handle background messages synchronously
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
    // Already initialised or missing config
  }
}

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
