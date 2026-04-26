import { db } from "../config/firebase";
import { NotificationChannel, sendNotification } from "../services/notificationService";

const RETRY_DELAY_MS = 2 * 60 * 1000;
const MAX_RETRY_ATTEMPTS = 3;

const buildNotificationTargets = (userData: any) => {
  const targets: Array<{ channel: NotificationChannel; token: string }> = [];

  // Primary: FCM push to device (if the owner has registered a push token)
  if (userData.fcmToken) {
    targets.push({ channel: "fcm_push", token: userData.fcmToken });
  }

  // Fallback: in-app Firestore notification (always available)
  if (!targets.length) {
    targets.push({ channel: "in_app", token: userData.userId || "" });
  }

  return targets;
};

const scheduleNotificationRetry = async (
  alertId: string,
  message: string,
  targets: Array<{ channel: NotificationChannel; token: string }>,
  deliveryLog: any[],
  meta: { userId: string; alertType: string; licensePlate: string; alertId: string }
) => {
  await db.collection("notification_jobs").add({
    alertId,
    message,
    targets,
    meta,
    attempts: 0,
    maxAttempts: MAX_RETRY_ATTEMPTS,
    status: "pending",
    nextAttemptAt: new Date(Date.now() + RETRY_DELAY_MS).toISOString(),
    deliveryLog,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
};

const attemptTargets = async (
  targets: Array<{ channel: NotificationChannel; token: string }>,
  message: string,
  meta: { userId: string; alertType: string; licensePlate: string; alertId: string },
  baseLog: any[] = []
) => {
  const deliveryLog = [...baseLog];

  for (const target of targets) {
    const result = await sendNotification(target.token, message, target.channel, meta);
    deliveryLog.push({
      timestamp: new Date().toISOString(),
      channel: result.channel,
      status: result.success ? "sent" : "failed",
      providerMessage: result.providerMessage
    });

    if (result.success) {
      return { success: true, channel: target.channel, deliveryLog };
    }
  }

  return { success: false, channel: null, deliveryLog };
};

export const processNewAlert = async (alertId: string, alertData: any) => {
  const alertRef = db.collection("alerts").doc(alertId);
  
  try {
    // 1. Fetch Vehicle to find the Owner
    const vehicleDoc = await db.collection("vehicles").doc(alertData.vehicleId).get();
    if (!vehicleDoc.exists) {
      console.error(`Vehicle ${alertData.vehicleId} not found for alert ${alertId}`);
      await alertRef.update({ status: "failed", deliveryLog: ["Vehicle not found"] });
      return;
    }
    const vehicleData = vehicleDoc.data()!;
    const ownerId = vehicleData.userId;

    // 2. Fetch User to get FCM token and profile
    const userDoc = await db.collection("users").doc(ownerId).get();
    if (!userDoc.exists) {
      console.error(`User ${ownerId} not found for alert ${alertId}`);
      await alertRef.update({ status: "failed", deliveryLog: ["User not found"] });
      return;
    }
    const userData = userDoc.data()!;
    
    if (userData.status === "blocked" || userData.status === "deactivated") {
        console.warn(`User ${ownerId} is inactive. Not sending alert.`);
        await alertRef.update({ status: "failed", deliveryLog: ["User account inactive"] });
        return;
    }

    // 3. Compose Message (used in logs only; FCM builds its own rich payload)
    const message = `SmartVehicle: New alert (${alertData.type}) for vehicle ${vehicleData.licensePlate}. Open the app to respond.`;

    // 4. Build targets and dispatch
    const targets = buildNotificationTargets({ ...userData, userId: ownerId });
    const meta = {
      userId: ownerId,
      alertType: alertData.type,
      licensePlate: vehicleData.licensePlate,
      alertId
    };
    const delivery = await attemptTargets(targets, message, meta, alertData.deliveryLog || []);

    // 5. Update Alert Status
    const updateData = {
      status: delivery.success ? "delivered" : "pending_retry",
      notificationStatus: delivery.success ? "sent" : "pending",
      notificationChannel: delivery.channel,
      deliveryLog: delivery.deliveryLog,
      updatedAt: new Date().toISOString()
    };

    await alertRef.update(updateData);

    if (!delivery.success) {
      await scheduleNotificationRetry(alertId, message, targets, delivery.deliveryLog, meta);
    }

  } catch (error: any) {
    console.error(`Error processing alert ${alertId}:`, error);
    await alertRef.update({ 
        status: "pending_retry",
        notificationStatus: "pending",
        deliveryLog: [
          ...(alertData.deliveryLog || []),
          { timestamp: new Date().toISOString(), status: "error", providerMessage: error.message }
        ],
        updatedAt: new Date().toISOString()
    });
  }
};

export const retryPendingNotificationJobs = async () => {
  const now = new Date().toISOString();
  const jobsSnap = await db.collection("notification_jobs")
    .where("status", "==", "pending")
    .where("nextAttemptAt", "<=", now)
    .limit(25)
    .get();

  for (const jobDoc of jobsSnap.docs) {
    const job = jobDoc.data();
    const attempts = (job.attempts || 0) + 1;
    const meta = job.meta || { userId: "", alertType: "emergency", licensePlate: "Unknown", alertId: job.alertId || "" };
    const delivery = await attemptTargets(job.targets || [], job.message, meta, job.deliveryLog || []);
    const exhausted = attempts >= (job.maxAttempts || MAX_RETRY_ATTEMPTS);

    await jobDoc.ref.update({
      attempts,
      status: delivery.success ? "sent" : exhausted ? "failed" : "pending",
      nextAttemptAt: delivery.success || exhausted ? null : new Date(Date.now() + RETRY_DELAY_MS * attempts).toISOString(),
      deliveryLog: delivery.deliveryLog,
      updatedAt: new Date().toISOString()
    });

    await db.collection("alerts").doc(job.alertId).update({
      status: delivery.success ? "delivered" : exhausted ? "failed" : "pending_retry",
      notificationStatus: delivery.success ? "sent" : exhausted ? "failed" : "pending",
      notificationChannel: delivery.channel || null,
      deliveryLog: delivery.deliveryLog,
      updatedAt: new Date().toISOString()
    });
  }

  return jobsSnap.size;
};

export const expireOldAlerts = async () => {
  const now = new Date().toISOString();
  const alertsSnap = await db.collection("alerts")
    .where("status", "in", ["pending", "delivered", "pending_retry"])
    .where("expiresAt", "<=", now)
    .limit(50)
    .get();

  const batch = db.batch();
  alertsSnap.docs.forEach((doc) => {
    batch.update(doc.ref, {
      status: "expired",
      expiredAt: now,
      updatedAt: now
    });
  });
  await batch.commit();
  return alertsSnap.size;
};
