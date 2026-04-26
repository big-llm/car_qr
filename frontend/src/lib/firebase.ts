import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getMessaging, getToken, isSupported } from "firebase/messaging";

// These should be set securely via environments,
// but since the UI is client-side, the config is public anyway.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// ── Firebase Cloud Messaging ──────────────────────────────────────────────────
// messaging is null on non-supporting browsers (e.g. Safari < 16, some mobile)
let _messaging: ReturnType<typeof getMessaging> | null = null;

export const getMessagingInstance = async () => {
  if (_messaging) return _messaging;
  const supported = await isSupported().catch(() => false);
  if (!supported) return null;
  _messaging = getMessaging(app);
  return _messaging;
};

/**
 * Registers the FCM service worker, sends it the Firebase config,
 * requests notification permission, and returns the FCM device token.
 * Returns null if notifications are blocked or unsupported.
 */
export const requestFcmToken = async (): Promise<string | null> => {
  try {
    const messaging = await getMessagingInstance();
    if (!messaging) return null;

    // Register service worker with config in URL params for synchronous initialization
    const queryParams = new URLSearchParams({
      apiKey: firebaseConfig.apiKey,
      projectId: firebaseConfig.projectId,
      messagingSenderId: firebaseConfig.messagingSenderId,
      appId: firebaseConfig.appId,
    }).toString();
    
    const swReg = await navigator.serviceWorker.register(`/firebase-messaging-sw.js?${queryParams}`);
    await navigator.serviceWorker.ready;

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return null;

    const token = await getToken(messaging, {
      vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
      serviceWorkerRegistration: swReg
    });

    return token || null;
  } catch (e) {
    console.warn('[FCM] Failed to get token:', e);
    return null;
  }
};
