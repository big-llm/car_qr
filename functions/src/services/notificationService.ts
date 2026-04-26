import { db } from "../config/firebase";
import * as admin from "firebase-admin";

export type NotificationChannel = "fcm_push" | "in_app" | "push";

export interface NotificationAttemptResult {
  channel: NotificationChannel;
  success: boolean;
  providerMessage: string;
}

// ── Alert type → human-readable labels ───────────────────────────────────────
const ALERT_LABELS: Record<string, { title: string; body: string; emoji: string }> = {
  blocking_vehicle: {
    emoji: "🚗",
    title: "Your car is blocking someone",
    body: "Someone needs you to move your vehicle immediately."
  },
  blocking_road: {
    emoji: "🚧",
    title: "Your car is blocking the road",
    body: "Your vehicle is obstructing traffic. Please move it."
  },
  lights_on: {
    emoji: "💡",
    title: "Lights left on",
    body: "Your car's headlights or interior lights are still on."
  },
  emergency: {
    emoji: "🚨",
    title: "Emergency alert for your vehicle",
    body: "An urgent situation has been reported regarding your car."
  }
};

// ── Send FCM push notification to a specific device token ────────────────────
const sendFcmPush = async (
  fcmToken: string,
  alertType: string,
  licensePlate: string,
  alertId: string
): Promise<{ success: boolean; providerMessage: string }> => {
  const label = ALERT_LABELS[alertType] || {
    emoji: "📣",
    title: "Vehicle Alert",
    body: "You have a new alert for your vehicle."
  };

  const message: admin.messaging.Message = {
    token: fcmToken,
    notification: {
      title: `${label.emoji} ${label.title}`,
      body: `${label.body} Vehicle: ${licensePlate}`
    },
    data: {
      alertId,
      alertType,
      licensePlate,
      url: "/owner"
    },
    webpush: {
      notification: {
        title: `${label.emoji} ${label.title}`,
        body: `${label.body} Vehicle: ${licensePlate}`,
        icon: "/favicon.png",
        badge: "/favicon.png",
        requireInteraction: true,
        tag: `vehicle-alert-${alertId}`
      },
      fcmOptions: {
        link: "/owner"
      }
    },
    android: {
      notification: {
        title: `${label.emoji} ${label.title}`,
        body: `${label.body} Vehicle: ${licensePlate}`,
        sound: "default"
      },
      priority: "high"
    },
    apns: {
      payload: {
        aps: {
          alert: {
            title: `${label.emoji} ${label.title}`,
            body: `${label.body} Vehicle: ${licensePlate}`
          },
          sound: "default",
          badge: 1
        }
      }
    }
  };

  const response = await admin.messaging().send(message);
  return { success: true, providerMessage: `FCM message ID: ${response}` };
};

// ── Write an in-app notification to Firestore (always done, reliable fallback) ─
const writeInAppNotification = async (
  userId: string,
  alertType: string,
  licensePlate: string,
  alertId: string
): Promise<void> => {
  const label = ALERT_LABELS[alertType] || { emoji: "📣", title: "Vehicle Alert", body: "New alert." };

  await db.collection("notifications").add({
    userId,
    alertId,
    title: `${label.emoji} ${label.title}`,
    body: `${label.body} Vehicle: ${licensePlate}`,
    read: false,
    createdAt: new Date().toISOString()
  });
};

// ── Public dispatcher — used by alertProcessor ─────────────────────────────
export const sendNotification = async (
  fcmTokenOrLegacy: string,           // FCM token when channel=fcm_push, otherwise ignored
  message: string,
  channel: NotificationChannel = "fcm_push",
  meta?: {
    userId?: string;
    alertType?: string;
    licensePlate?: string;
    alertId?: string;
  }
): Promise<NotificationAttemptResult> => {
  const { userId, alertType = "emergency", licensePlate = "Unknown", alertId = "" } = meta || {};

  console.log(`[Notification] Dispatching ${channel.toUpperCase()} → userId:${userId || "?"}`);

  // Always write in-app notification to Firestore if we have a userId
  // The owner portal picks this up via onSnapshot — zero cost, instant delivery
  if (userId) {
    await writeInAppNotification(userId, alertType, licensePlate, alertId).catch((e) =>
      console.warn("[Notification] In-app write failed:", e?.message)
    );
  }

  // FCM push to device (free via Firebase Admin SDK)
  if (channel === "fcm_push" && fcmTokenOrLegacy && fcmTokenOrLegacy.length > 20) {
    try {
      const result = await sendFcmPush(fcmTokenOrLegacy, alertType, licensePlate, alertId);
      return { channel: "fcm_push", ...result };
    } catch (err: any) {
      // Stale / unregistered token — remove it from user profile silently
      const isStale =
        err?.errorInfo?.code === "messaging/registration-token-not-registered" ||
        err?.errorInfo?.code === "messaging/invalid-registration-token";

      if (isStale && userId) {
        console.warn("[FCM] Stale token detected for user:", userId, "— removing.");
        await db.collection("users").doc(userId).update({ fcmToken: null }).catch(() => {});
      }

      console.error("[FCM] Push failed:", err?.errorInfo?.code || err?.message);
      return { channel: "fcm_push", success: false, providerMessage: err?.message || "FCM push failed" };
    }
  }

  // Fallback: in-app only via Firestore onSnapshot (always works, no token needed)
  return {
    channel: "in_app",
    success: true,
    providerMessage: "Delivered via in-app Firestore notification."
  };
};
