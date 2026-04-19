import express from "express";
import cors from "cors";
import helmet from "helmet";
import { db } from "../../config/firebase";
import { rateLimitMiddleware } from "../../middleware/rateLimit";
import { requireAuth, AuthRequest } from "../../middleware/auth";
import { processNewAlert } from "../../services/alertProcessor";
import Joi from "joi";

const app = express();

app.use(cors({ origin: true }));
app.use(helmet());
app.use(express.json());

// Public Endpoint to resolve QR token and get safe vehicle info
app.get("/qr/:token", async (req, res) => {
  const { token } = req.params;
  try {
    const vehiclesSnap = await db.collection("vehicles").where("qrToken", "==", token).limit(1).get();
    
    if (vehiclesSnap.empty) {
      return res.status(404).json({ error: "Vehicle not found or invalid QR code" });
    }
    
    const vehicle = vehiclesSnap.docs[0].data();
    
    // Extracted safe data to show the scanner (DO NOT expose phone number or real user ID)
    res.json({
      success: true,
      vehicle: {
        id: vehiclesSnap.docs[0].id,
        licensePlateMasked: `***${vehicle.licensePlate.slice(-3)}`,
        make: vehicle.make,
        model: vehicle.model
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Endpoint to send an alert to the vehicle owner
// Includes Rate Limiting to prevent spam
app.post(
  "/qr/:token/alert",
  rateLimitMiddleware({ windowMs: 15 * 60 * 1000, max: 3, message: "Too many alerts sent. Try again later." }),
  requireAuth,
  async (req: AuthRequest, res: any) => {
    const { token } = req.params;
    const { type } = req.body; 
    
    // AuthRequest physically guarantees secure extraction of Phone Number matching Firebase 2FA logic
    const senderPhone = req.user?.phone_number;

    if (!senderPhone || senderPhone.length < 10) {
      return res.status(401).json({ error: "Verified phone number is missing from your secure account." });
    }

    // Strict Request Validation
    const schema = Joi.object({
      type: Joi.string().valid("blocking_vehicle", "blocking_road", "lights_on", "emergency").required(),
    });

    const { error } = schema.validate({ type });
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    if (!senderPhone) {
       return res.status(401).json({ error: "Verified phone number is missing from your account." });
    }

    try {
      // 1. Check if the sender is globally blocked
      const senderHash = Buffer.from(senderPhone).toString("base64");
      const blockSnap = await db.collection("blocked_numbers").doc(senderHash).get();
      if (blockSnap.exists) {
        return res.status(403).json({ error: "Your number is blocked from sending requests." });
      }

      // 2. Validate Vehicle
      const vehiclesSnap = await db.collection("vehicles").where("qrToken", "==", token).limit(1).get();
      
      if (vehiclesSnap.empty) {
        return res.status(404).json({ error: "Invalid QR code" });
      }
      
      const vehicleId = vehiclesSnap.docs[0].id;

      // 3. Create Alert
      const alertData = {
        vehicleId,
        qrToken: token,
        type,
        senderPhone: senderPhone, // UNMASKED for Admin Vaults
        rawSenderHash: senderHash,
        timestamp: new Date().toISOString(),
        status: "pending",
        deliveryLog: []
      };

      const alertRef = await db.collection("alerts").add(alertData);
      // 1. Log Scanner to Registry
      const scannerRef = db.collection("scanners").doc(senderPhone);
      await db.runTransaction(async (t) => {
         const doc = await t.get(scannerRef);
         if (!doc.exists) {
            t.set(scannerRef, { phoneNumber: senderPhone, totalScans: 1, lastScan: new Date().toISOString(), status: 'active' });
         } else {
            const data = doc.data()!;
            t.update(scannerRef, { totalScans: (data.totalScans || 1) + 1, lastScan: new Date().toISOString() });
         }
      });

      // 2. Transmit Alert asynchronously without waiting, or wait if needed
      await processNewAlert(alertRef.id, alertData);
      res.status(200).json({ success: true, alertId: alertRef.id });
    } catch (error: any) {
      console.error("Alert generation error:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  }
);

// Endpoint allowing Scanners to securely poll the status of their dispatched alert
app.get("/qr/alert/:alertId/status", requireAuth, async (req: AuthRequest, res: any) => {
  const { alertId } = req.params;
  const senderPhone = req.user?.phone_number;

  try {
    const alertSnap = await db.collection("alerts").doc(alertId).get();
    if (!alertSnap.exists) return res.status(404).json({ error: "Alert not found" });
    
    const alertData = alertSnap.data()!;
    // Secure it so ONLY the exact person who sent it can physically poll the status of this Alert ID
    if (alertData.senderPhone !== senderPhone) {
       return res.status(403).json({ error: "Access denied" });
    }

    res.json({
      status: alertData.status,
      ownerResponse: alertData.ownerResponse || null,
      respondedAt: alertData.respondedAt || null
    });
  } catch(e) {
    res.status(500).json({ error: "Polling failed" });
  }
});

export const publicApp = app;
