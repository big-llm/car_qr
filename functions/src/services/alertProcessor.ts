import { db } from "../config/firebase";
import { NotificationChannel, sendNotification } from "../services/notificationService";

const RETRY_DELAY_MS = 2 * 60 * 1000;
const MAX_RETRY_ATTEMPTS = 3;

const buildNotificationTargets = (userData: any) => {
  const targets: Array<{ channel: NotificationChannel; phoneNumber: string }> = [];
  const preferences = userData.notificationPreferences || {};

  if (preferences.whatsapp !== false && userData.whatsappNumber) {
    targets.push({ channel: "whatsapp", phoneNumber: userData.whatsappNumber });
  }

  if (preferences.sms !== false && userData.phoneNumber) {
    targets.push({ channel: "sms", phoneNumber: userData.phoneNumber });
  }

  if (!targets.length && userData.phoneNumber) {
    targets.push({ channel: "sms", phoneNumber: userData.phoneNumber });
  }

  return targets;
};

const scheduleNotificationRetry = async (
  alertId: string,
  message: string,
  targets: Array<{ channel: NotificationChannel; phoneNumber: string }>,
  deliveryLog: any[]
) => {
  await db.collection("notification_jobs").add({
    alertId,
    message,
    targets,
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
  targets: Array<{ channel: NotificationChannel; phoneNumber: string }>,
  message: string,
  baseLog: any[] = []
) => {
  const deliveryLog = [...baseLog];

  for (const target of targets) {
    const result = await sendNotification(target.phoneNumber, message, target.channel);
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

    // 2. Fetch User to get phone number
    const userDoc = await db.collection("users").doc(vehicleData.userId).get();
    if (!userDoc.exists) {
      console.error(`User ${vehicleData.userId} not found for alert ${alertId}`);
      await alertRef.update({ status: "failed", deliveryLog: ["User not found"] });
      return;
    }
    const userData = userDoc.data()!;
    
    if (userData.status === "blocked" || userData.status === "deactivated") {
        console.warn(`User ${vehicleData.userId} is inactive. Not sending alert.`);
        await alertRef.update({ status: "failed", deliveryLog: ["User account inactive"] });
        return;
    }

    const ownerPhone = userData.phoneNumber;
    
    // 3. Compose Message
    const message = `Smart Vehicle Contact: You have a new alert (${alertData.type}) regarding your vehicle ${vehicleData.licensePlate}. Sender details are masked for privacy. Please check your app or vehicle.`;

    // 4. Send Notification with channel fallback
    const targets = buildNotificationTargets({ ...userData, phoneNumber: ownerPhone });
    const delivery = await attemptTargets(targets, message, alertData.deliveryLog || []);

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
      await scheduleNotificationRetry(alertId, message, targets, delivery.deliveryLog);
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
    const delivery = await attemptTargets(job.targets || [], job.message, job.deliveryLog || []);
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
