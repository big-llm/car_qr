import express from "express";
import cors from "cors";
import helmet from "helmet";
import { db, auth } from "../../config/firebase";
import { requireAdmin } from "../../middleware/auth";
import { generateVehicleQRToken } from "../../services/qrService";
import Joi from "joi";

const app = express();

app.use(cors({ origin: true }));
app.use(helmet());
app.use(express.json());
// Public Admin Login endpoint for fixed credentials
app.post("/login", (req, res) => {
  const { userid, password } = req.body;
  if (userid === process.env.ADMIN_USER && password === process.env.ADMIN_PASS) {
      // Issue custom pseudo-token for local fixed session
      res.json({ success: true, token: "CUSTOM_ADMIN_AUTH_TOKEN_" + Date.now() });
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
      const usersSnap = await db.collection("users").orderBy("createdAt", "desc").get();
      const users = usersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      res.json(users);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch users" });
    }
  })
  .post(async (req, res) => {
    // Strict schema to create a user internally
    const schema = Joi.object({
      phoneNumber: Joi.string().pattern(/^\+[1-9]\d{1,14}$/).required(),
      name: Joi.string().allow("").optional()
    });

    const { error } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { phoneNumber, name } = req.body;
    try {
      
      const userRecord = await auth.createUser({ phoneNumber, displayName: name });
      const userData = {
        phoneNumber,
        name: name || "",
        status: "active",
        createdAt: new Date().toISOString(),
      };
      await db.collection("users").doc(userRecord.uid).set(userData);
      
      res.status(201).json({ id: userRecord.uid, ...userData });
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
      const { userId } = req.query;
      let query: FirebaseFirestore.Query = db.collection("vehicles").orderBy("createdAt", "desc");
      if (userId) {
        query = query.where("userId", "==", userId);
      }
      const vehiclesSnap = await query.get();
      const vehicles = vehiclesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      res.json(vehicles);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch vehicles" });
    }
  })
  .post(async (req, res) => {
    const schema = Joi.object({
      userId: Joi.string().required(),
      licensePlate: Joi.string().max(20).required(),
      make: Joi.string().allow("").optional(),
      model: Joi.string().allow("").optional()
    });

    const { error } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { userId, licensePlate, make, model } = req.body;

    try {
      const qrToken = generateVehicleQRToken();
      const vehicleData = {
        userId,
        licensePlate,
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
    const usersCount = (await db.collection("users").count().get()).data().count;
    const vehiclesCount = (await db.collection("vehicles").count().get()).data().count;
    const alertsCount = (await db.collection("alerts").count().get()).data().count;
    
    res.json({
      totalUsers: usersCount,
      totalVehicles: vehiclesCount,
      totalAlerts: alertsCount,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export const adminApp = app;
