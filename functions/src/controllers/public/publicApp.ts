import express from "express";
import cors from "cors";
import helmet from "helmet";
import { auth, db } from "../../config/firebase";
import { rateLimitMiddleware } from "../../middleware/rateLimit";
import { requireAuth, AuthRequest } from "../../middleware/auth";
import { processNewAlert } from "../../services/alertProcessor";
import Joi from "joi";

const app = express();
const ALERT_TTL_MS = 15 * 60 * 1000;
const MAX_ALERTS_PER_HOUR = 5;
const MAX_DEVICE_ALERTS_PER_HOUR = 8;

app.use(cors({ origin: true }));
app.use(helmet());
app.use(express.json());

const getClientIp = (req: express.Request): string => {
  const forwarded = req.headers["x-forwarded-for"];
  if (Array.isArray(forwarded)) return forwarded[0] || "unknown-ip";
  if (typeof forwarded === "string") return forwarded.split(",")[0].trim();
  return req.socket.remoteAddress || req.ip || "unknown-ip";
};

const getDeviceId = (req: express.Request): string => {
  const deviceHeader = req.headers["x-device-id"];
  if (Array.isArray(deviceHeader)) return deviceHeader[0] || "unknown-device";
  return deviceHeader || "unknown-device";
};

const incrementAbuseWindow = async (kind: string, value: string, windowMs: number) => {
  const now = Date.now();
  const windowStart = Math.floor(now / windowMs) * windowMs;
  const docId = Buffer.from(`${kind}:${value}:${windowStart}`).toString("base64url");
  const ref = db.collection("abuse_windows").doc(docId);

  return db.runTransaction(async (transaction) => {
    const snap = await transaction.get(ref);
    if (!snap.exists) {
      transaction.set(ref, {
        kind,
        value,
        count: 1,
        windowStart,
        expiresAt: new Date(windowStart + windowMs).toISOString(),
        updatedAt: new Date().toISOString()
      });
      return 1;
    }

    const nextCount = (snap.data()?.count || 0) + 1;
    transaction.update(ref, {
      count: nextCount,
      updatedAt: new Date().toISOString()
    });
    return nextCount;
  });
};

app.post("/session", requireAuth, async (req: AuthRequest, res: any) => {
  const authHeader = req.headers.authorization;
  const idToken = authHeader?.startsWith("Bearer ") ? authHeader.split(" ")[1] : null;

  if (!idToken) {
    return res.status(400).json({ error: "Missing Firebase ID token" });
  }

  try {
    const expiresIn = 1000 * 60 * 60 * 24 * 14;
    const sessionCookie = await auth.createSessionCookie(idToken, { expiresIn });
    res.cookie("__session", sessionCookie, {
      maxAge: expiresIn,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax"
    });
    res.json({ success: true, expiresIn });
  } catch (error: any) {
    res.status(401).json({ error: "Unable to create session" });
  }
});

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
  requireAuth,
  rateLimitMiddleware({
    windowMs: 15 * 60 * 1000,
    max: 3,
    message: "Too many alerts sent from this verified device. Try again later.",
    keyPrefix: "scanner-alert"
  }),
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
      location: Joi.object({
        lat: Joi.number().required(),
        lng: Joi.number().required()
      }).optional()
    });

    const { error } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { location } = req.body;

    try {
      // 1. Check if the sender is globally blocked
      const senderHash = Buffer.from(senderPhone).toString("base64url");
      const legacySenderHash = Buffer.from(senderPhone).toString("base64");
      const [blockSnap, legacyBlockSnap] = await Promise.all([
        db.collection("blocked_numbers").doc(senderHash).get(),
        db.collection("blocked_numbers").doc(legacySenderHash).get()
      ]);
      if (blockSnap.exists || legacyBlockSnap.exists) {
        return res.status(403).json({ error: "Your number is blocked from sending requests." });
      }

      // 1b. Reputation System Check (Prevent Harassment)
      const deviceId = getDeviceId(req);
      const clientIp = getClientIp(req);
      const oneHourMs = 60 * 60 * 1000;
      const [recentCount, deviceRecentCount] = await Promise.all([
        incrementAbuseWindow("phone", senderPhone, oneHourMs),
        incrementAbuseWindow("device", deviceId, oneHourMs)
      ]);

      if (recentCount > MAX_ALERTS_PER_HOUR || deviceRecentCount > MAX_DEVICE_ALERTS_PER_HOUR) {
        // Auto-block for harassment
        await db.collection("blocked_numbers").doc(senderHash).set({
          phoneNumber: senderPhone,
          reason: `Automated block: Exceeded threshold. phone=${recentCount}/hour device=${deviceRecentCount}/hour.`,
          blockedAt: new Date().toISOString(),
          deviceId,
          ip: clientIp
        });
        
        // Mark scanner as banned in registry
        await db.collection("scanners").doc(senderPhone).update({
          status: 'blocked',
          banReason: 'Harassment/Excessive Pinging',
          lastDeviceId: deviceId,
          lastIp: clientIp
        }).catch(() => {});

        return res.status(403).json({ error: "Access Denied: Your account has been automatically flagged and blocked for excessive activity." });
      }

      // 2. Validate Vehicle
      const vehiclesSnap = await db.collection("vehicles").where("qrToken", "==", token).limit(1).get();
      
      if (vehiclesSnap.empty) {
        return res.status(404).json({ error: "Invalid QR code" });
      }
      
      const vehicleId = vehiclesSnap.docs[0].id;
      const now = new Date();
      const expiresAt = new Date(now.getTime() + ALERT_TTL_MS).toISOString();

      // 3. Create Alert
      const alertData = {
        vehicleId,
        qrToken: token,
        type,
        senderUid: req.user?.uid,
        senderPhone: senderPhone, // UNMASKED for Admin Vaults
        rawSenderHash: senderHash,
        timestamp: now.toISOString(),
        expiresAt,
        status: "pending",
        notificationStatus: "pending",
        deliveryLog: [],
        metadata: {
          ip: clientIp,
          userAgent: req.get("user-agent"),
          deviceId,
          location: location || null
        }
      };

      const alertRef = await db.collection("alerts").add(alertData);
      // 1. Log Scanner to Registry
      const scannerRef = db.collection("scanners").doc(senderPhone);
      await db.runTransaction(async (t) => {
         const doc = await t.get(scannerRef);
         if (!doc.exists) {
            t.set(scannerRef, { 
              phoneNumber: senderPhone, 
              totalScans: 1, 
              lastScan: new Date().toISOString(), 
              status: 'active',
              lastIp: clientIp,
              lastDeviceId: deviceId,
              lastUserAgent: req.get("user-agent")
            });
         } else {
            const data = doc.data()!;
            t.update(scannerRef, { 
              totalScans: (data.totalScans || 1) + 1, 
              lastScan: new Date().toISOString(),
              lastIp: clientIp,
              lastDeviceId: deviceId,
              lastUserAgent: req.get("user-agent")
            });
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

    if (alertData.expiresAt && alertData.expiresAt <= new Date().toISOString() && !["responded", "expired", "resolved"].includes(alertData.status)) {
      await alertSnap.ref.update({
        status: "expired",
        expiredAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      alertData.status = "expired";
    }

    res.json({
      status: alertData.status,
      notificationStatus: alertData.notificationStatus || null,
      ownerResponse: alertData.ownerResponse || null,
      respondedAt: alertData.respondedAt || null,
      expiresAt: alertData.expiresAt || null
    });
  } catch(e) {
    res.status(500).json({ error: "Polling failed" });
  }
});

export const publicApp = app;
