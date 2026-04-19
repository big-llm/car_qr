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
exports.processNewAlert = void 0;
const functions = __importStar(require("firebase-functions"));
const firebase_1 = require("../config/firebase");
const notificationService_1 = require("../services/notificationService");
exports.processNewAlert = functions.firestore
    .document("alerts/{alertId}")
    .onCreate(async (snap, context) => {
    const alertData = snap.data();
    const alertId = context.params.alertId;
    try {
        // 1. Fetch Vehicle to find the Owner
        const vehicleDoc = await firebase_1.db.collection("vehicles").doc(alertData.vehicleId).get();
        if (!vehicleDoc.exists) {
            console.error(`Vehicle ${alertData.vehicleId} not found for alert ${alertId}`);
            await snap.ref.update({ status: "failed", deliveryLog: ["Vehicle not found"] });
            return;
        }
        const vehicleData = vehicleDoc.data();
        // 2. Fetch User to get phone number
        const userDoc = await firebase_1.db.collection("users").doc(vehicleData.userId).get();
        if (!userDoc.exists) {
            console.error(`User ${vehicleData.userId} not found for alert ${alertId}`);
            await snap.ref.update({ status: "failed", deliveryLog: ["User not found"] });
            return;
        }
        const userData = userDoc.data();
        if (userData.status === "blocked" || userData.status === "deactivated") {
            console.warn(`User ${vehicleData.userId} is inactive. Not sending alert.`);
            await snap.ref.update({ status: "failed", deliveryLog: ["User account inactive"] });
            return;
        }
        const ownerPhone = userData.phoneNumber;
        // 3. Compose Message
        const message = `Smart Vehicle Contact: You have a new alert (${alertData.type}) regarding your vehicle ${vehicleData.licensePlate}. Sender details are masked for privacy. Please check your app or vehicle.`;
        // 4. Send Notification
        const success = await (0, notificationService_1.sendNotification)(ownerPhone, message);
        // 5. Update Alert Status
        const updateData = {
            status: success ? "delivered" : "failed",
            deliveryLog: [
                ...alertData.deliveryLog,
                {
                    timestamp: new Date().toISOString(),
                    status: success ? "Message Sent" : "Message Service Failed"
                }
            ]
        };
        await snap.ref.update(updateData);
    }
    catch (error) {
        console.error(`Error processing alert ${alertId}:`, error);
        await snap.ref.update({
            status: "error",
            deliveryLog: [...alertData.deliveryLog, `Internal Error: ${error.message}`]
        });
    }
});
//# sourceMappingURL=onAlertCreated.js.map