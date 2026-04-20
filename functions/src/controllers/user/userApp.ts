import express from "express";
import cors from "cors";
import helmet from "helmet";
import { db } from "../../config/firebase";
import { requireAuth, AuthRequest } from "../../middleware/auth";
import { generateVehicleQRToken } from "../../services/qrService";

const app = express();

app.use(cors({ origin: true }));
app.use(helmet());
app.use(express.json());
// Global middleware to enforce user authentication for standard requests
app.use(requireAuth);

// === PROFILE ===
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

app.put("/profile", async (req: AuthRequest, res) => {
  try {
    const uid = req.user!.uid;
    const schema = Joi.object({
      name: Joi.string().allow("").optional(),
      address: Joi.string().allow("").optional(),
      whatsappNumber: Joi.string().allow("").optional(),
      alternativeNumber: Joi.string().allow("").optional(),
    });

    const { error } = schema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const updates = { ...req.body, updatedAt: new Date().toISOString() };
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
    // Get user's vehicles first
    const vehiclesSnap = await db.collection("vehicles").where("userId", "==", uid).get();
    if (vehiclesSnap.empty) {
      return res.json([]);
    }
    
    const vehicleIds = vehiclesSnap.docs.map(doc => doc.id);
    
    // Using in-query (max 10 items per batch in firestore 'in' query)
    // For larger scale, query DB by individual vehicle or store userId on the alert
    const alertsSnap = await db.collection("alerts").where("vehicleId", "in", vehicleIds.slice(0, 10)).orderBy("timestamp", "desc").get();
    const alerts = alertsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    res.json(alerts);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Acknowledge Alert (On the way / Responded)
app.put("/alerts/:alertId/respond", async (req: AuthRequest, res) => {
  const { alertId } = req.params;
  const { responseCode } = req.body; // 'acknowledged', 'on_my_way', 'ignored'
  const uid = req.user!.uid;

  try {
    const alertRef = db.collection("alerts").doc(alertId);
    const alertSnap = await alertRef.get();
    if (!alertSnap.exists) return res.status(404).json({ error: "Alert not found" });

    // Validate ownership before updating status
    const vehicleId = alertSnap.data()?.vehicleId;
    const vehicleSnap = await db.collection("vehicles").doc(vehicleId).get();
    if (!vehicleSnap.exists || vehicleSnap.data()?.userId !== uid) {
      return res.status(403).json({ error: "Access denied." });
    }

    await alertRef.update({
      status: "responded",
      ownerResponse: responseCode,
      respondedAt: new Date().toISOString()
    });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export const userApp = app;
