import express from "express";
import cors from "cors";
import helmet from "helmet";
import Joi from "joi";
import { db } from "../../config/firebase";
import { requireAuth, AuthRequest } from "../../middleware/auth";
import { generateVehicleQRToken } from "../../services/qrService";

const app = express();
const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

app.use(cors({ origin: true }));
app.use(helmet());
app.use(express.json());
// Global middleware to enforce user authentication for standard requests
app.use(requireAuth);

const ownerProfileSchema = Joi.object({
  name: Joi.string().allow("").optional(),
  phoneNumber: Joi.string().pattern(/^\+[1-9]\d{1,14}$/).allow("").optional(),
  address: Joi.string().allow("").optional(),
  whatsappNumber: Joi.string().allow("").optional(),
  alternativeNumber: Joi.string().allow("").optional(),
  notificationPreferences: Joi.object({
    sms: Joi.boolean().default(true),
    whatsapp: Joi.boolean().default(false),
    push: Joi.boolean().default(false)
  }).optional()
});

const vehicleSchema = Joi.object({
  licensePlate: Joi.string().max(20).required(),
  vehicleName: Joi.string().allow("").optional(),
  make: Joi.string().allow("").optional(),
  model: Joi.string().allow("").optional()
});

const vehicleUpdateSchema = Joi.object({
  licensePlate: Joi.string().max(20).optional(),
  vehicleName: Joi.string().allow("").optional(),
  make: Joi.string().allow("").optional(),
  model: Joi.string().allow("").optional()
}).min(1);

const defaultNotificationPreferences = {
  sms: true,
  whatsapp: false,
  push: false
};

const getVerifiedPhoneNumber = (req: AuthRequest): string => {
  const token = req.user as any;
  return token?.phone_number || token?.firebase?.identities?.phone?.[0] || "";
};

const getVerifiedEmail = (req: AuthRequest): string => {
  const token = req.user as any;
  return token?.email || token?.firebase?.identities?.email?.[0] || "";
};

const buildOwnerProfile = (email: string, phoneNumber: string, now: string) => ({
  email,
  phoneNumber,
  name: "",
  address: "",
  whatsappNumber: "",
  alternativeNumber: "",
  notificationPreferences: defaultNotificationPreferences,
  role: "owner",
  status: "active",
  createdAt: now,
  updatedAt: now
});

const ensureOwnerProfile = async (req: AuthRequest, res: express.Response, next: express.NextFunction): Promise<void> => {
  const uid = req.user!.uid;
  const userRef = db.collection("users").doc(uid);
  const userSnap = await userRef.get();
  const phoneNumber = getVerifiedPhoneNumber(req);
  const email = getVerifiedEmail(req);

  if (!email) {
    res.status(403).json({ error: "Owner login requires email and password. OTP is only for scanners." });
    return;
  }

  if (!userSnap.exists) {
    const now = new Date().toISOString();
    await userRef.set(buildOwnerProfile(email, phoneNumber, now), { merge: true });
    next();
    return;
  }

  const userData = userSnap.data()!;
  if (userData.status === "blocked" || userData.status === "deactivated") {
    res.status(403).json({ error: "Owner account is not active." });
    return;
  }

  const updates: Record<string, unknown> = {};
  if (!userData.email) {
    updates.email = email;
  }
  if (!userData.phoneNumber || userData.phoneNumber === "Unknown") {
    updates.phoneNumber = phoneNumber || userData.phoneNumber || "";
  }
  if (!userData.role) {
    updates.role = "owner";
  }

  const effectiveRole = (updates.role as string | undefined) || userData.role;
  if (!["owner", "admin"].includes(effectiveRole)) {
    res.status(403).json({ error: "Owner role required." });
    return;
  }

  if (Object.keys(updates).length > 0) {
    await userRef.update({ ...updates, updatedAt: new Date().toISOString() });
  }

  next();
};


// === REGISTRATION ===
app.post("/register", async (req: AuthRequest, res) => {
  try {
    const uid = req.user!.uid;
    const email = getVerifiedEmail(req);
    if (!email) return res.status(400).json({ error: "Verified email account is required for owner registration." });

    const { error, value } = ownerProfileSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const userRef = db.collection("users").doc(uid);
    const existing = await userRef.get();
    const now = new Date().toISOString();
    const phoneNumber = value.phoneNumber || existing.data()?.phoneNumber || getVerifiedPhoneNumber(req);
    if (!phoneNumber) return res.status(400).json({ error: "Owner alert phone number is required." });

    const userData = {
      email,
      phoneNumber,
      name: value.name || existing.data()?.name || "",
      address: value.address || existing.data()?.address || "",
      whatsappNumber: value.whatsappNumber || existing.data()?.whatsappNumber || "",
      alternativeNumber: value.alternativeNumber || existing.data()?.alternativeNumber || "",
      notificationPreferences: value.notificationPreferences || existing.data()?.notificationPreferences || defaultNotificationPreferences,
      role: "owner",
      status: existing.data()?.status || "active",
      createdAt: existing.data()?.createdAt || now,
      updatedAt: now
    };

    await userRef.set(userData, { merge: true });
    res.status(existing.exists ? 200 : 201).json({ id: uid, ...userData });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.use(ensureOwnerProfile);

app.get("/profile", async (req: AuthRequest, res) => {
  try {
    const uid = req.user!.uid;
    const doc = await db.collection("users").doc(uid).get();
    
    if (!doc.exists) {
      return res.status(404).json({ error: "User profile not found" });
    }
    res.json({ id: uid, ...doc.data() });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put("/fcm-token", async (req: AuthRequest, res) => {
  try {
    const uid = req.user!.uid;
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: "Token is required" });

    await db.collection("users").doc(uid).update({
      fcmToken: token,
      updatedAt: new Date().toISOString()
    });
    
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put("/profile", async (req: AuthRequest, res) => {
  try {
    const uid = req.user!.uid;
    const { error, value } = ownerProfileSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const updates = { ...value, updatedAt: new Date().toISOString() };
    await db.collection("users").doc(uid).update(updates);
    
    res.json({ success: true, updates });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// === MY VEHICLES ===
app.get("/vehicles", async (req: AuthRequest, res) => {
  try {
    const uid = req.user!.uid;
    const vehiclesSnap = await db.collection("vehicles").where("userId", "==", uid).get();
    const vehicles = vehiclesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(vehicles);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/vehicles", async (req: AuthRequest, res) => {
  try {
    const uid = req.user!.uid;
    const { error, value } = vehicleSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const qrToken = generateVehicleQRToken();
    const vehicleData = {
      userId: uid,
      licensePlate: value.licensePlate,
      vehicleName: value.vehicleName || "",
      make: value.make || "",
      model: value.model || "",
      qrToken,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: "active"
    };

    const docRef = await db.collection("vehicles").add(vehicleData);
    res.status(201).json({ id: docRef.id, ...vehicleData });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put("/vehicles/:vehicleId", async (req: AuthRequest, res) => {
  const { vehicleId } = req.params;
  const uid = req.user!.uid;

  try {
    const { error, value } = vehicleUpdateSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const docRef = db.collection("vehicles").doc(vehicleId);
    const docSnap = await docRef.get();
    if (!docSnap.exists || docSnap.data()?.userId !== uid) {
      return res.status(403).json({ error: "Access denied. Cannot modify non-owned vehicle." });
    }

    const updates = { ...value, updatedAt: new Date().toISOString() };
    await docRef.update(updates);
    res.json({ success: true, updates });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete("/vehicles/:vehicleId", async (req: AuthRequest, res) => {
  const { vehicleId } = req.params;
  const uid = req.user!.uid;

  try {
    const docRef = db.collection("vehicles").doc(vehicleId);
    const docSnap = await docRef.get();
    if (!docSnap.exists || docSnap.data()?.userId !== uid) {
      return res.status(403).json({ error: "Access denied. Cannot delete non-owned vehicle." });
    }

    await docRef.delete();
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// QR Code Re-generation (Self-service Owner security rotation)
app.put("/vehicles/:vehicleId/qr-regenerate", async (req: AuthRequest, res) => {
  const { vehicleId } = req.params;
  const uid = req.user!.uid;
  try {
    const docRef = db.collection("vehicles").doc(vehicleId);
    const docSnap = await docRef.get();
    
    // Strict Owner Validation
    if (!docSnap.exists || docSnap.data()?.userId !== uid) {
      return res.status(403).json({ error: "Access denied. Cannot modify non-owned asset." });
    }
    
    // Nuke the old hash and assign a new token
    const qrToken = generateVehicleQRToken();
    await docRef.update({
      qrToken,
      updatedAt: new Date().toISOString()
    });
    res.json({ success: true, qrToken });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Regular users can only VIEW alerts directed to their own vehicles (covered by endpoint above fetching from alerts using vehicleIds)
app.get("/alerts", async (req: AuthRequest, res) => {
  try {
    const uid = req.user!.uid;
    
    // Query by ownerId which is indexed and efficient
    const alertsSnap = await db.collection("alerts")
      .where("ownerId", "==", uid)
      .get();
      
    const alerts = alertsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));
    
    // Sort in memory to avoid needing composite index with timestamp
    alerts.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    
    res.json(alerts.slice(0, 50));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/alerts/history", async (req: AuthRequest, res) => {
  try {
    const uid = req.user!.uid;
    const { vehicleId, from, to, status } = req.query;

    // Use ownerId for an index-free query
    const alertsSnap = await db.collection("alerts")
      .where("ownerId", "==", uid)
      .get();

    const oneYearAgo = new Date(Date.now() - ONE_YEAR_MS).toISOString();
    const fromDate = typeof from === "string" && from ? new Date(from).toISOString() : oneYearAgo;
    const toDate = typeof to === "string" && to ? new Date(to).toISOString() : new Date().toISOString();

    const alerts = alertsSnap.docs
      .map(doc => ({ id: doc.id, ...doc.data() as any }))
      .filter(alert =>
        // In-memory filters
        alert.timestamp >= fromDate &&
        alert.timestamp <= toDate &&
        (!status || alert.status === status) &&
        (!vehicleId || alert.vehicleId === vehicleId)
      );

    // Sort in-memory to avoid index requirement
    alerts.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    res.json(alerts);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Acknowledge Alert (On the way / Responded)
app.put("/alerts/:alertId/respond", async (req: AuthRequest, res) => {
  const { alertId } = req.params;
  const uid = req.user!.uid;
  const schema = Joi.object({
    responseCode: Joi.string().valid(
      "acknowledged",
      "on_my_way",
      "call_me",
      "not_my_vehicle",
      "will_take_time",
      "resolved"
    ).required()
  });

  const { error, value } = schema.validate(req.body);
  if (error) return res.status(400).json({ error: error.details[0].message });
  const { responseCode } = value;

  try {
    const alertRef = db.collection("alerts").doc(alertId);
    const alertSnap = await alertRef.get();
    if (!alertSnap.exists) return res.status(404).json({ error: "Alert not found" });

    const alertData = alertSnap.data()!;
    
    // Primary check: Direct ownerId on alert
    // Fallback: Check vehicle ownership if alert is legacy
    let isOwner = alertData.ownerId === uid;
    
    if (!isOwner && alertData.vehicleId) {
      const vehicleSnap = await db.collection("vehicles").doc(alertData.vehicleId).get();
      isOwner = vehicleSnap.exists && vehicleSnap.data()?.userId === uid;
    }

    if (!isOwner) {
      return res.status(403).json({ error: "Access denied. You do not own this vehicle alert." });
    }

    const now = new Date().toISOString();
    if (alertData.expiresAt && alertData.expiresAt <= now && !["responded", "resolved"].includes(alertData.status)) {
      await alertRef.update({
        status: "expired",
        expiredAt: now,
        updatedAt: now
      });
      return res.status(409).json({ error: "Alert has expired." });
    }

    await alertRef.update({
      status: responseCode === "resolved" ? "resolved" : "responded",
      ownerResponse: responseCode,
      respondedAt: now,
      resolvedAt: responseCode === "resolved" ? now : null,
      updatedAt: now
    });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export const userApp = app;
