import * as functions from "firebase-functions";
import { adminApp } from "./controllers/admin/adminApp";
import { publicApp } from "./controllers/public/publicApp";
import { userApp } from "./controllers/user/userApp";
import { db } from "./config/firebase";
import { expireOldAlerts, retryPendingNotificationJobs } from "./services/alertProcessor";

export const admin = functions.https.onRequest(adminApp);
export const scanner = functions.https.onRequest(publicApp);
export const api = functions.https.onRequest(userApp);

export const retryNotifications = functions.pubsub.schedule("every 2 minutes").onRun(async () => {
  const processed = await retryPendingNotificationJobs();
  console.log(`Processed ${processed} notification retry jobs`);
});

export const expireAlerts = functions.pubsub.schedule("every 5 minutes").onRun(async () => {
  const expired = await expireOldAlerts();
  console.log(`Expired ${expired} old alerts`);
});

export const onUserSignup = functions.auth.user().onCreate(async (user) => {
  if (!user.email) return;

  const now = new Date().toISOString();
  const userData: Record<string, unknown> = {
    email: user.email,
    name: user.displayName || "",
    address: "",
    whatsappNumber: "",
    alternativeNumber: "",
    notificationPreferences: {
      sms: true,
      whatsapp: false,
      push: false
    },
    role: "owner",
    status: "active",
    createdAt: now,
    updatedAt: now
  };

  if (user.phoneNumber) {
    userData.phoneNumber = user.phoneNumber;
  }

  await db.collection("users").doc(user.uid).set(userData, { merge: true });
});

export const onUserDelete = functions.auth.user().onDelete(async (user) => {
  await db.collection("users").doc(user.uid).set({
    status: "deactivated",
    updatedAt: new Date().toISOString()
  }, { merge: true });
});
