"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.userApp = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const firebase_1 = require("../../config/firebase");
const auth_1 = require("../../middleware/auth");
const app = (0, express_1.default)();
app.use((0, cors_1.default)({ origin: true }));
app.use((0, helmet_1.default)());
app.use(express_1.default.json());
// Global middleware to enforce user authentication for standard requests
app.use(auth_1.requireAuth);
// === PROFILE ===
app.get("/profile", async (req, res) => {
    try {
        const uid = req.user.uid;
        const doc = await firebase_1.db.collection("users").doc(uid).get();
        if (!doc.exists) {
            return res.status(404).json({ error: "User profile not found" });
        }
        res.json({ id: uid, ...doc.data() });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// === MY VEHICLES ===
app.get("/vehicles", async (req, res) => {
    try {
        const uid = req.user.uid;
        const vehiclesSnap = await firebase_1.db.collection("vehicles").where("userId", "==", uid).get();
        const vehicles = vehiclesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        res.json(vehicles);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Regular users can only VIEW alerts directed to their own vehicles (covered by endpoint above fetching from alerts using vehicleIds)
app.get("/alerts", async (req, res) => {
    try {
        const uid = req.user.uid;
        // Get user's vehicles first
        const vehiclesSnap = await firebase_1.db.collection("vehicles").where("userId", "==", uid).get();
        if (vehiclesSnap.empty) {
            return res.json([]);
        }
        const vehicleIds = vehiclesSnap.docs.map(doc => doc.id);
        // Using in-query (max 10 items per batch in firestore 'in' query)
        // For larger scale, query DB by individual vehicle or store userId on the alert
        const alertsSnap = await firebase_1.db.collection("alerts").where("vehicleId", "in", vehicleIds.slice(0, 10)).orderBy("timestamp", "desc").get();
        const alerts = alertsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        res.json(alerts);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.userApp = app;
//# sourceMappingURL=userApp.js.map