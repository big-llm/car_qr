import express from "express";
import cors from "cors";
import helmet from "helmet";
import { db, auth } from "../../config/firebase";
import { requireAdmin } from "../../middleware/auth";
import { generateVehicleQRToken } from "../../services/qrService";
import Joi from "joi";

import * as jwt from "jsonwebtoken";
import { rateLimitMiddleware } from "../../middleware/rateLimit";

// ── Security guard: reject insecure default in production ──────────────────
const ADMIN_JWT_SECRET = (() => {
  const secret = process.env.ADMIN_JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("FATAL: ADMIN_JWT_SECRET environment variable is not set. Server cannot start.");
    }
    console.warn("[WARN] ADMIN_JWT_SECRET is not set. Using insecure dev default. DO NOT use in production.");
    return "INSECURE_DEV_ONLY_KEY_DO_NOT_USE_IN_PROD";
  }
  return secret;
})();

const app = express();

app.use(cors({ origin: true }));
app.use(helmet());
app.use(express.json());

// Public Admin Login endpoint for fixed credentials
// Rate limited to prevent brute-force
app.post("/login", 
  rateLimitMiddleware({ windowMs: 15 * 60 * 1000, max: 10, message: "Too many login attempts. Try again in 15 minutes." }),
  (req, res) => {
    const { userid, password } = req.body;
    if (userid === process.env.ADMIN_USER && password === process.env.ADMIN_PASS) {
        // Sign a proper secure JWT
        const token = jwt.sign({ 
          sub: 'admin_root',
          role: 'admin',
          iat: Math.floor(Date.now() / 1000)
        }, ADMIN_JWT_SECRET, { expiresIn: '24h' });

        res.json({ success: true, token });
    } else {
        res.status(401).json({ error: "Invalid admin credentials" });
    }
});

// Global middleware to enforce admin only for all SUBSEQUENT routes
app.use(requireAdmin);

// === USERS ===
// Get users
app.route("/users")
  .get(async (req, res) => {
    try {
      const { q } = req.query;
      let snap = await db.collection("users").orderBy("createdAt", "desc").get();
      let users = snap.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));

      if (q) {
        const query = (q as string).toLowerCase();
        users = users.filter(u => 
          u.name?.toLowerCase().includes(query) || 
          u.email?.toLowerCase().includes(query) ||
          u.phoneNumber?.includes(query) || 
          u.address?.toLowerCase().includes(query)
        );
      }

      res.json(users);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch users" });
    }
  })
  .post(async (req, res) => {
    // Strict schema to create a user internally
    const schema = Joi.object({
      email: Joi.string().email().required(),
      password: Joi.string().min(6).required(),
      phoneNumber: Joi.string().pattern(/^\+[1-9]\d{1,14}$/).required(),
      name: Joi.string().allow("").optional(),
      address: Joi.string().allow("").optional(),
      whatsappNumber: Joi.string().allow("").optional(),
      alternativeNumber: Joi.string().allow("").optional(),
      role: Joi.string().valid("owner", "admin").default("owner")
    });

    const { error } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { email, password, phoneNumber, name, address, whatsappNumber, alternativeNumber, role } = req.body;
    try {
      const now = new Date().toISOString();
      const userRecord = await auth.createUser({ email, password, displayName: name });
      const userData = {
        email,
        phoneNumber,
        name: name || "",
        address: address || "",
        whatsappNumber: whatsappNumber || "",
        alternativeNumber: alternativeNumber || "",
        notificationPreferences: {
          sms: true,
          whatsapp: false,
          push: false
        },
        role,
        status: "active",
        createdAt: now,
        updatedAt: now
      };
      await db.collection("users").doc(userRecord.uid).set(userData);
      
      res.status(201).json({ id: userRecord.uid, ...userData });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

app.put("/users/:userId", async (req, res) => {
  const { userId } = req.params;
  const schema = Joi.object({
    name: Joi.string().allow("").optional(),
    address: Joi.string().allow("").optional(),
    whatsappNumber: Joi.string().allow("").optional(),
    alternativeNumber: Joi.string().allow("").optional(),
    role: Joi.string().valid("owner", "admin").optional()
  }).min(1);

  const { error, value } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }

  try {
    const updates = { ...value, updatedAt: new Date().toISOString() };
    await db.collection("users").doc(userId).update(updates);
    res.json({ success: true, updates });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put("/users/:userId/status", async (req, res) => {
  const { status } = req.body; // 'active', 'blocked'
  const { userId } = req.params;
  try {
    if (!["active", "blocked"].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }
    
    // Disable in Firebase Auth
    await auth.updateUser(userId, { disabled: status === "blocked" });
    // Update in Firestore
    await db.collection("users").doc(userId).update({ status, updatedAt: new Date().toISOString() });
    
    res.json({ success: true, status });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// === SCANNERS ===
// Get public scanners log
app.get("/scanners", async (req, res) => {
  try {
    const scannerSnap = await db.collection("scanners").orderBy("lastScan", "desc").get();
    const scanners = scannerSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(scanners);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch scanners" });
  }
});

// Unblock a scanner (remove from blocked_numbers + reset scanner status)
app.put("/scanners/:phoneNumber/unblock", async (req, res) => {
  const { phoneNumber } = req.params;
  try {
    const decodedPhone = decodeURIComponent(phoneNumber);
    const senderHash = Buffer.from(decodedPhone).toString("base64url");
    const legacySenderHash = Buffer.from(decodedPhone).toString("base64");

    // Remove from blocked_numbers (both hash formats for safety)
    const batch = db.batch();
    batch.delete(db.collection("blocked_numbers").doc(senderHash));
    batch.delete(db.collection("blocked_numbers").doc(legacySenderHash));

    // Reset scanner status to active
    const scannerRef = db.collection("scanners").doc(decodedPhone);
    batch.update(scannerRef, {
      status: "active",
      banReason: null,
      unblockedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    await batch.commit();
    res.json({ success: true, message: `${decodedPhone} has been unblocked.` });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});


// === VEHICLES ===
app.route("/vehicles")
  .get(async (req, res) => {
    try {
      const { userId, q } = req.query;
      let queryRef: FirebaseFirestore.Query = db.collection("vehicles").orderBy("createdAt", "desc");
      
      if (userId) {
        queryRef = queryRef.where("userId", "==", userId);
      }
      
      const vehiclesSnap = await queryRef.get();
      let vehicles = vehiclesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));

      if (q) {
        const query = (q as string).toLowerCase();
        vehicles = vehicles.filter(v => 
          v.licensePlate?.toLowerCase().includes(query) || 
          v.vehicleName?.toLowerCase().includes(query) || 
          v.make?.toLowerCase().includes(query)
        );
      }

      res.json(vehicles);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch vehicles" });
    }
  })
  .post(async (req, res) => {
    const schema = Joi.object({
      userId: Joi.string().required(),
      licensePlate: Joi.string().max(20).required(),
      vehicleName: Joi.string().allow("").optional(),
      make: Joi.string().allow("").optional(),
      model: Joi.string().allow("").optional()
    });

    const { error } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { userId, licensePlate, vehicleName, make, model } = req.body;

    try {
      const qrToken = generateVehicleQRToken();
      const vehicleData = {
        userId,
        licensePlate,
        vehicleName: vehicleName || "",
        make: make || "",
        model: model || "",
        qrToken,
        createdAt: new Date().toISOString(),
        status: "active"
      };

      const docRef = await db.collection("vehicles").add(vehicleData);
      res.status(201).json({ id: docRef.id, ...vehicleData });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

app.put("/vehicles/:vehicleId/qr-regenerate", async (req, res) => {
  const { vehicleId } = req.params;
  try {
    const qrToken = generateVehicleQRToken();
    await db.collection("vehicles").doc(vehicleId).update({
      qrToken,
      updatedAt: new Date().toISOString()
    });
    res.json({ success: true, qrToken });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete("/vehicles/:vehicleId", async (req, res) => {
  const { vehicleId } = req.params;
  try {
    await db.collection("vehicles").doc(vehicleId).delete();
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// === ALERTS ===
app.get("/alerts", async (req, res) => {
  try {
    const { status, vehicleId } = req.query;
    let queryRef: FirebaseFirestore.Query = db.collection("alerts").orderBy("timestamp", "desc").limit(100);
    
    if (status) queryRef = queryRef.where("status", "==", status);
    if (vehicleId) queryRef = queryRef.where("vehicleId", "==", vehicleId);
    
    const alertsSnap = await queryRef.get();
    const alerts = alertsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));

    // Batch fetch vehicles and users to avoid N+1 queries
    const vIds = [...new Set(alerts.map(a => a.vehicleId).filter(Boolean))];
    const oIds = [...new Set(alerts.map(a => a.ownerId).filter(Boolean))];

    const [vSnaps, uSnaps] = await Promise.all([
      vIds.length ? db.collection("vehicles").where("__name__", "in", vIds.slice(0, 10)).get() : Promise.resolve({ docs: [] }),
      oIds.length ? db.collection("users").where("__name__", "in", oIds.slice(0, 10)).get() : Promise.resolve({ docs: [] })
    ]);

    const vehicleMap = new Map(vSnaps.docs.map(d => [d.id, d.data()]));
    const userMap = new Map(uSnaps.docs.map(d => [d.id, d.data()]));

    const enriched = alerts.map(alert => ({
      ...alert,
      vehicle: vehicleMap.get(alert.vehicleId) || null,
      owner: userMap.get(alert.ownerId) || null
    }));

    res.json(enriched);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// === DASHBOARD AGGREGATES ===
app.get("/dashboard-metrics", async (req, res) => {
  try {
    // Note: For real scale this should be handled by counter functions or aggregations,
    // count() is supported in Firestore recent versions and is efficient.
    const [
      usersCountSnap,
      vehiclesCountSnap,
      alertsCountSnap,
      activeAlertsSnap,
      failedAlertsSnap,
      pendingRetrySnap,
      recentAlertsSnap
    ] = await Promise.all([
      db.collection("users").count().get(),
      db.collection("vehicles").count().get(),
      db.collection("alerts").count().get(),
      db.collection("alerts").where("status", "in", ["pending", "delivered", "pending_retry"]).count().get(),
      db.collection("alerts").where("status", "==", "failed").count().get(),
      db.collection("alerts").where("notificationStatus", "==", "pending").count().get(),
      db.collection("alerts").orderBy("timestamp", "desc").limit(500).get()
    ]);

    const vehicleCounts = new Map<string, number>();
    const peakHourCounts = new Map<number, number>();
    recentAlertsSnap.docs.forEach((doc) => {
      const alert = doc.data();
      if (alert.vehicleId) vehicleCounts.set(alert.vehicleId, (vehicleCounts.get(alert.vehicleId) || 0) + 1);
      if (alert.timestamp) {
        const hour = new Date(alert.timestamp).getHours();
        peakHourCounts.set(hour, (peakHourCounts.get(hour) || 0) + 1);
      }
    });

    const mostReportedVehicles = Array.from(vehicleCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([vehicleId, count]) => ({ vehicleId, count }));

    const peakUsageHours = Array.from(peakHourCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([hour, count]) => ({ hour, count }));
    
    res.json({
      totalUsers: usersCountSnap.data().count,
      totalVehicles: vehiclesCountSnap.data().count,
      totalAlerts: alertsCountSnap.data().count,
      activeAlerts: activeAlertsSnap.data().count,
      failedAlerts: failedAlertsSnap.data().count,
      pendingNotificationRetries: pendingRetrySnap.data().count,
      mostReportedVehicles,
      peakUsageHours,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export const adminApp = app;
