import * as admin from "firebase-admin";

import * as fs from "fs";
import * as path from "path";

// Attempt to physically map the Service Account Key if it exists in the root repo
const serviceAccountPath = path.resolve(__dirname, "../../../serviceAccountKey.json");

// Attempt to read from Vercel Cloud Environment Variables first
if (admin.apps.length === 0) {
  try {
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      console.log("☁️ Vercel Cloud Environment Detected.");
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: process.env.VITE_FIREBASE_PROJECT_ID || serviceAccount.project_id
      });
    } else if (fs.existsSync(serviceAccountPath)) {
      console.log("🔒 Discovered Local physical Credentials.");
      const serviceAccount = require(serviceAccountPath);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: process.env.VITE_FIREBASE_PROJECT_ID || serviceAccount.project_id
      });
    } else {
      console.log("⚠️ Falling back to default credentials.");
      admin.initializeApp({
        projectId: process.env.VITE_FIREBASE_PROJECT_ID
      });
    }
  } catch (err) {
    console.error("Firebase Auth Init Failed:", err);
  }
}

export const db = admin.firestore();
export const auth = admin.auth();
