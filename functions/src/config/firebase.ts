import * as admin from "firebase-admin";

import * as fs from "fs";
import * as path from "path";

// Attempt to physically map the Service Account Key if it exists in the root repo
const serviceAccountPath = path.resolve(__dirname, "../../../serviceAccountKey.json");

// Attempt to read from Vercel Cloud Environment Variables first
if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  console.log("☁️ Vercel Cloud Environment Detected. Initializing Firebase via Encrypted String.");
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: process.env.VITE_FIREBASE_PROJECT_ID || "smart-vehicle-contact-dev"
  });
} else if (fs.existsSync(serviceAccountPath)) {
  console.log("🔒 Discovered Local physical Service Account Credentials.");
  const serviceAccount = require(serviceAccountPath);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: process.env.VITE_FIREBASE_PROJECT_ID || "smart-vehicle-contact-dev"
  });
} else {
  console.warn("⚠️ No physical or Cloud Service Account Key found. System falling back to native metadata endpoints.");
  admin.initializeApp({
    projectId: process.env.VITE_FIREBASE_PROJECT_ID || "smart-vehicle-contact-dev"
  });
}

export const db = admin.firestore();
export const auth = admin.auth();
