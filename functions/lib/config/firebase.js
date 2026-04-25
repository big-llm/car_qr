"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.auth = exports.db = void 0;
const admin = __importStar(require("firebase-admin"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
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
        }
        else if (fs.existsSync(serviceAccountPath)) {
            console.log("🔒 Discovered Local physical Credentials.");
            const serviceAccount = require(serviceAccountPath);
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
                projectId: process.env.VITE_FIREBASE_PROJECT_ID || serviceAccount.project_id
            });
        }
        else {
            console.log("⚠️ Falling back to default credentials.");
            admin.initializeApp({
                projectId: process.env.VITE_FIREBASE_PROJECT_ID
            });
        }
    }
    catch (err) {
        console.error("Firebase Auth Init Failed:", err);
    }
}
exports.db = admin.firestore();
exports.auth = admin.auth();
//# sourceMappingURL=firebase.js.map