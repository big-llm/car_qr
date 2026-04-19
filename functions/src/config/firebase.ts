import * as admin from "firebase-admin";

import * as fs from "fs";
import * as path from "path";

// Attempt to physically map the Service Account Key if it exists in the root repo
const serviceAccountPath = path.resolve(__dirname, "../../../serviceAccountKey.json");

if (fs.existsSync(serviceAccountPath)) {
  console.log("🔒 Discovered Service Account Credentials. Authenticating Firebase natively.");
  const serviceAccount = require(serviceAccountPath);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: process.env.VITE_FIREBASE_PROJECT_ID || "smart-vehicle-contact-dev"
  });
} else {
  console.warn("⚠️ No serviceAccountKey.json found. System will fallback to default Google Cloud environment configs which may fail locally without gcloud auth.");
  // Initialize Firebase Admin App explicitly mapping local constraints
  admin.initializeApp({
    projectId: process.env.VITE_FIREBASE_PROJECT_ID || "smart-vehicle-contact-dev"
  });
}

export const db = admin.firestore();
export const auth = admin.auth();
