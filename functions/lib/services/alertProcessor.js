"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.processNewAlert = void 0;
const firebase_1 = require("../config/firebase");
const notificationService_1 = require("../services/notificationService");
const processNewAlert = async (alertId, alertData) => {
    const alertRef = firebase_1.db.collection("alerts").doc(alertId);
    try {
        // 1. Fetch Vehicle to find the Owner
        const vehicleDoc = await firebase_1.db.collection("vehicles").doc(alertData.vehicleId).get();
        if (!vehicleDoc.exists) {
            console.error(`Vehicle ${alertData.vehicleId} not found for alert ${alertId}`);
            await alertRef.update({ status: "failed", deliveryLog: ["Vehicle not found"] });
            return;
        }
        const vehicleData = vehicleDoc.data();
        // 2. Fetch User to get phone number
        const userDoc = await firebase_1.db.collection("users").doc(vehicleData.userId).get();
        if (!userDoc.exists) {
            console.error(`User ${vehicleData.userId} not found for alert ${alertId}`);
            await alertRef.update({ status: "failed", deliveryLog: ["User not found"] });
            return;
        }
        const userData = userDoc.data();
        if (userData.status === "blocked" || userData.status === "deactivated") {
            console.warn(`User ${vehicleData.userId} is inactive. Not sending alert.`);
            await alertRef.update({ status: "failed", deliveryLog: ["User account inactive"] });
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
        await alertRef.update(updateData);
    }
    catch (error) {
        console.error(`Error processing alert ${alertId}:`, error);
        await alertRef.update({
            status: "error",
            deliveryLog: [...alertData.deliveryLog, `Internal Error: ${error.message}`]
        });
    }
};
exports.processNewAlert = processNewAlert;
//# sourceMappingURL=alertProcessor.js.map