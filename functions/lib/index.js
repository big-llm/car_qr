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
exports.onUserDelete = exports.onUserSignup = exports.expireAlerts = exports.retryNotifications = exports.api = exports.scanner = exports.admin = void 0;
const functions = __importStar(require("firebase-functions"));
const adminApp_1 = require("./controllers/admin/adminApp");
const publicApp_1 = require("./controllers/public/publicApp");
const userApp_1 = require("./controllers/user/userApp");
const firebase_1 = require("./config/firebase");
const alertProcessor_1 = require("./services/alertProcessor");
exports.admin = functions.https.onRequest(adminApp_1.adminApp);
exports.scanner = functions.https.onRequest(publicApp_1.publicApp);
exports.api = functions.https.onRequest(userApp_1.userApp);
exports.retryNotifications = functions.pubsub.schedule("every 2 minutes").onRun(async () => {
    const processed = await (0, alertProcessor_1.retryPendingNotificationJobs)();
    console.log(`Processed ${processed} notification retry jobs`);
});
exports.expireAlerts = functions.pubsub.schedule("every 5 minutes").onRun(async () => {
    const expired = await (0, alertProcessor_1.expireOldAlerts)();
    console.log(`Expired ${expired} old alerts`);
});
exports.onUserSignup = functions.auth.user().onCreate(async (user) => {
    if (!user.email)
        return;
    const now = new Date().toISOString();
    const userData = {
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
    await firebase_1.db.collection("users").doc(user.uid).set(userData, { merge: true });
});
exports.onUserDelete = functions.auth.user().onDelete(async (user) => {
    await firebase_1.db.collection("users").doc(user.uid).set({
        status: "deactivated",
        updatedAt: new Date().toISOString()
    }, { merge: true });
});
//# sourceMappingURL=index.js.map