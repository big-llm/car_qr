import express from "express";
import cors from "cors";
import helmet from "helmet";
import { db, auth } from "../../config/firebase";
import { requireAdmin } from "../../middleware/auth";
import { generateVehicleQRToken } from "../../services/qrService";
import Joi from "joi";

import * as jwt from "jsonwebtoken";
import { rateLimitMiddleware } from "../../middleware/rateLimit";

const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET || "SUPER_SECRET_ADMIN_KEY_1337";

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

    const { phoneNumber, name, address, whatsappNumber, alternativeNumber, role } = req.body;
    try {
      
      const userRecord = await auth.createUser({ phoneNumber, displayName: name });
      const userData = {
        phoneNumber,
        name: name || "",
        address: address || "",
        whatsappNumber: whatsappNumber || "",
        alternativeNumber: alternativeNumber || "",
        role,
        status: "active",
        createdAt: new Date().toISOString(),
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
    let query: FirebaseFirestore.Query = db.collection("alerts").orderBy("timestamp", "desc");
    
    if (status) query = query.where("status", "==", status);
    if (vehicleId) query = query.where("vehicleId", "==", vehicleId);
    
    const alertsSnap = await query.get();
    const alerts = alertsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(alerts);
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
