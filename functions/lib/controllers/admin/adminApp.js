"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
const jwt = __importStar(require("jsonwebtoken"));
const rateLimit_1 = require("../../middleware/rateLimit");
const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET || "SUPER_SECRET_ADMIN_KEY_1337";
const app = (0, express_1.default)();
app.use((0, cors_1.default)({ origin: true }));
app.use((0, helmet_1.default)());
app.use(express_1.default.json());
// Public Admin Login endpoint for fixed credentials
// Rate limited to prevent brute-force
app.post("/login", (0, rateLimit_1.rateLimitMiddleware)({ windowMs: 15 * 60 * 1000, max: 10, message: "Too many login attempts. Try again in 15 minutes." }), (req, res) => {
    const { userid, password } = req.body;
    if (userid === process.env.ADMIN_USER && password === process.env.ADMIN_PASS) {
        // Sign a proper secure JWT
        const token = jwt.sign({
            sub: 'admin_root',
            role: 'admin',
            iat: Math.floor(Date.now() / 1000)
        }, ADMIN_JWT_SECRET, { expiresIn: '24h' });
        res.json({ success: true, token });
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
        const { q } = req.query;
        let snap = await firebase_1.db.collection("users").orderBy("createdAt", "desc").get();
        let users = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        if (q) {
            const query = q.toLowerCase();
            users = users.filter(u => u.name?.toLowerCase().includes(query) ||
                u.email?.toLowerCase().includes(query) ||
                u.phoneNumber?.includes(query) ||
                u.address?.toLowerCase().includes(query));
        }
        res.json(users);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to fetch users" });
    }
})
    .post(async (req, res) => {
    // Strict schema to create a user internally
    const schema = joi_1.default.object({
        email: joi_1.default.string().email().required(),
        password: joi_1.default.string().min(6).required(),
        phoneNumber: joi_1.default.string().pattern(/^\+[1-9]\d{1,14}$/).required(),
        name: joi_1.default.string().allow("").optional(),
        address: joi_1.default.string().allow("").optional(),
        whatsappNumber: joi_1.default.string().allow("").optional(),
        alternativeNumber: joi_1.default.string().allow("").optional(),
        role: joi_1.default.string().valid("owner", "admin").default("owner")
    });
    const { error } = schema.validate(req.body);
    if (error) {
        return res.status(400).json({ error: error.details[0].message });
    }
    const { email, password, phoneNumber, name, address, whatsappNumber, alternativeNumber, role } = req.body;
    try {
        const now = new Date().toISOString();
        const userRecord = await firebase_1.auth.createUser({ email, password, displayName: name });
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
        await firebase_1.db.collection("users").doc(userRecord.uid).set(userData);
        res.status(201).json({ id: userRecord.uid, ...userData });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
app.put("/users/:userId", async (req, res) => {
    const { userId } = req.params;
    const schema = joi_1.default.object({
        name: joi_1.default.string().allow("").optional(),
        address: joi_1.default.string().allow("").optional(),
        whatsappNumber: joi_1.default.string().allow("").optional(),
        alternativeNumber: joi_1.default.string().allow("").optional(),
        role: joi_1.default.string().valid("owner", "admin").optional()
    }).min(1);
    const { error, value } = schema.validate(req.body);
    if (error) {
        return res.status(400).json({ error: error.details[0].message });
    }
    try {
        const updates = { ...value, updatedAt: new Date().toISOString() };
        await firebase_1.db.collection("users").doc(userId).update(updates);
        res.json({ success: true, updates });
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
// === SCANNERS ===
// Get public scanners log
app.get("/scanners", async (req, res) => {
    try {
        const scannerSnap = await firebase_1.db.collection("scanners").orderBy("lastScan", "desc").get();
        const scanners = scannerSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        res.json(scanners);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to fetch scanners" });
    }
});
// === VEHICLES ===
app.route("/vehicles")
    .get(async (req, res) => {
    try {
        const { userId, q } = req.query;
        let queryRef = firebase_1.db.collection("vehicles").orderBy("createdAt", "desc");
        if (userId) {
            queryRef = queryRef.where("userId", "==", userId);
        }
        const vehiclesSnap = await queryRef.get();
        let vehicles = vehiclesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        if (q) {
            const query = q.toLowerCase();
            vehicles = vehicles.filter(v => v.licensePlate?.toLowerCase().includes(query) ||
                v.vehicleName?.toLowerCase().includes(query) ||
                v.make?.toLowerCase().includes(query));
        }
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
        vehicleName: joi_1.default.string().allow("").optional(),
        make: joi_1.default.string().allow("").optional(),
        model: joi_1.default.string().allow("").optional()
    });
    const { error } = schema.validate(req.body);
    if (error) {
        return res.status(400).json({ error: error.details[0].message });
    }
    const { userId, licensePlate, vehicleName, make, model } = req.body;
    try {
        const qrToken = (0, qrService_1.generateVehicleQRToken)();
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
        const [usersCountSnap, vehiclesCountSnap, alertsCountSnap, activeAlertsSnap, failedAlertsSnap, pendingRetrySnap, recentAlertsSnap] = await Promise.all([
            firebase_1.db.collection("users").count().get(),
            firebase_1.db.collection("vehicles").count().get(),
            firebase_1.db.collection("alerts").count().get(),
            firebase_1.db.collection("alerts").where("status", "in", ["pending", "delivered", "pending_retry"]).count().get(),
            firebase_1.db.collection("alerts").where("status", "==", "failed").count().get(),
            firebase_1.db.collection("alerts").where("notificationStatus", "==", "pending").count().get(),
            firebase_1.db.collection("alerts").orderBy("timestamp", "desc").limit(500).get()
        ]);
        const vehicleCounts = new Map();
        const peakHourCounts = new Map();
        recentAlertsSnap.docs.forEach((doc) => {
            const alert = doc.data();
            if (alert.vehicleId)
                vehicleCounts.set(alert.vehicleId, (vehicleCounts.get(alert.vehicleId) || 0) + 1);
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
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.adminApp = app;
//# sourceMappingURL=adminApp.js.map