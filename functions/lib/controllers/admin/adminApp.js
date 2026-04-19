"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminApp = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const firebase_1 = require("../../config/firebase");
const auth_1 = require("../../middleware/auth");
const qrService_1 = require("../../services/qrService");
const joi_1 = __importDefault(require("joi"));
const app = (0, express_1.default)();
app.use((0, cors_1.default)({ origin: true }));
app.use((0, helmet_1.default)());
app.use(express_1.default.json());
// Public Admin Login endpoint for fixed credentials
app.post("/login", (req, res) => {
    const { userid, password } = req.body;
    if (userid === process.env.ADMIN_USER && password === process.env.ADMIN_PASS) {
        // Issue custom pseudo-token for local fixed session
        res.json({ success: true, token: "CUSTOM_ADMIN_AUTH_TOKEN_" + Date.now() });
    }
    else {
        res.status(401).json({ error: "Invalid admin credentials" });
    }
});
// Global middleware to enforce admin only for all SUBSEQUENT routes
app.use(auth_1.requireAdmin);
// === USERS ===
// Get users
app.route("/users")
    .get(async (req, res) => {
    try {
        const usersSnap = await firebase_1.db.collection("users").orderBy("createdAt", "desc").get();
        const users = usersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        res.json(users);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to fetch users" });
    }
})
    .post(async (req, res) => {
    // Strict schema to create a user internally
    const schema = joi_1.default.object({
        phoneNumber: joi_1.default.string().pattern(/^\+[1-9]\d{1,14}$/).required(),
        name: joi_1.default.string().allow("").optional()
    });
    const { error } = schema.validate(req.body);
    if (error) {
        return res.status(400).json({ error: error.details[0].message });
    }
    const { phoneNumber, name } = req.body;
    try {
        const userRecord = await firebase_1.auth.createUser({ phoneNumber, displayName: name });
        const userData = {
            phoneNumber,
            name: name || "",
            status: "active",
            createdAt: new Date().toISOString(),
        };
        await firebase_1.db.collection("users").doc(userRecord.uid).set(userData);
        res.status(201).json({ id: userRecord.uid, ...userData });
    }
    catch (error) {
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
        await firebase_1.auth.updateUser(userId, { disabled: status === "blocked" });
        // Update in Firestore
        await firebase_1.db.collection("users").doc(userId).update({ status, updatedAt: new Date().toISOString() });
        res.json({ success: true, status });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// === VEHICLES ===
app.route("/vehicles")
    .get(async (req, res) => {
    try {
        const { userId } = req.query;
        let query = firebase_1.db.collection("vehicles").orderBy("createdAt", "desc");
        if (userId) {
            query = query.where("userId", "==", userId);
        }
        const vehiclesSnap = await query.get();
        const vehicles = vehiclesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        res.json(vehicles);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to fetch vehicles" });
    }
})
    .post(async (req, res) => {
    const schema = joi_1.default.object({
        userId: joi_1.default.string().required(),
        licensePlate: joi_1.default.string().max(20).required(),
        make: joi_1.default.string().allow("").optional(),
        model: joi_1.default.string().allow("").optional()
    });
    const { error } = schema.validate(req.body);
    if (error) {
        return res.status(400).json({ error: error.details[0].message });
    }
    const { userId, licensePlate, make, model } = req.body;
    try {
        const qrToken = (0, qrService_1.generateVehicleQRToken)();
        const vehicleData = {
            userId,
            licensePlate,
            make: make || "",
            model: model || "",
            qrToken,
            createdAt: new Date().toISOString(),
            status: "active"
        };
        const docRef = await firebase_1.db.collection("vehicles").add(vehicleData);
        res.status(201).json({ id: docRef.id, ...vehicleData });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
app.put("/vehicles/:vehicleId/qr-regenerate", async (req, res) => {
    const { vehicleId } = req.params;
    try {
        const qrToken = (0, qrService_1.generateVehicleQRToken)();
        await firebase_1.db.collection("vehicles").doc(vehicleId).update({
            qrToken,
            updatedAt: new Date().toISOString()
        });
        res.json({ success: true, qrToken });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
app.delete("/vehicles/:vehicleId", async (req, res) => {
    const { vehicleId } = req.params;
    try {
        await firebase_1.db.collection("vehicles").doc(vehicleId).delete();
        res.json({ success: true });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// === ALERTS ===
app.get("/alerts", async (req, res) => {
    try {
        const { status, vehicleId } = req.query;
        let query = firebase_1.db.collection("alerts").orderBy("timestamp", "desc");
        if (status)
            query = query.where("status", "==", status);
        if (vehicleId)
            query = query.where("vehicleId", "==", vehicleId);
        const alertsSnap = await query.get();
        const alerts = alertsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        res.json(alerts);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// === DASHBOARD AGGREGATES ===
app.get("/dashboard-metrics", async (req, res) => {
    try {
        // Note: For real scale this should be handled by counter functions or aggregations,
        // count() is supported in Firestore recent versions and is efficient.
        const usersCount = (await firebase_1.db.collection("users").count().get()).data().count;
        const vehiclesCount = (await firebase_1.db.collection("vehicles").count().get()).data().count;
        const alertsCount = (await firebase_1.db.collection("alerts").count().get()).data().count;
        res.json({
            totalUsers: usersCount,
            totalVehicles: vehiclesCount,
            totalAlerts: alertsCount,
        });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.adminApp = app;
//# sourceMappingURL=adminApp.js.map