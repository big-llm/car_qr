import { db } from "../config/firebase";
import { sendNotification } from "../services/notificationService";

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

    // 4. Send Notification
    const success = await sendNotification(ownerPhone, message);

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

  } catch (error: any) {
    console.error(`Error processing alert ${alertId}:`, error);
    await alertRef.update({ 
        status: "error", 
        deliveryLog: [...alertData.deliveryLog, `Internal Error: ${error.message}`] 
    });
  }
};
