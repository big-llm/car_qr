"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.userApp = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const joi_1 = __importDefault(require("joi"));
const firebase_1 = require("../../config/firebase");
const auth_1 = require("../../middleware/auth");
const qrService_1 = require("../../services/qrService");
const app = (0, express_1.default)();
const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;
app.use((0, cors_1.default)({ origin: true }));
app.use((0, helmet_1.default)());
app.use(express_1.default.json());
// Global middleware to enforce user authentication for standard requests
app.use(auth_1.requireAuth);
const ownerProfileSchema = joi_1.default.object({
    name: joi_1.default.string().allow("").optional(),
    phoneNumber: joi_1.default.string().pattern(/^\+[1-9]\d{1,14}$/).allow("").optional(),
    address: joi_1.default.string().allow("").optional(),
    whatsappNumber: joi_1.default.string().allow("").optional(),
    alternativeNumber: joi_1.default.string().allow("").optional(),
    notificationPreferences: joi_1.default.object({
        sms: joi_1.default.boolean().default(true),
        whatsapp: joi_1.default.boolean().default(false),
        push: joi_1.default.boolean().default(false)
    }).optional()
});
const vehicleSchema = joi_1.default.object({
    licensePlate: joi_1.default.string().max(20).required(),
    vehicleName: joi_1.default.string().allow("").optional(),
    make: joi_1.default.string().allow("").optional(),
    model: joi_1.default.string().allow("").optional()
});
const vehicleUpdateSchema = joi_1.default.object({
    licensePlate: joi_1.default.string().max(20).optional(),
    vehicleName: joi_1.default.string().allow("").optional(),
    make: joi_1.default.string().allow("").optional(),
    model: joi_1.default.string().allow("").optional()
}).min(1);
const defaultNotificationPreferences = {
    sms: true,
    whatsapp: false,
    push: false
};
const getVerifiedPhoneNumber = (req) => {
    const token = req.user;
    return token?.phone_number || token?.firebase?.identities?.phone?.[0] || "";
};
const getVerifiedEmail = (req) => {
    const token = req.user;
    return token?.email || token?.firebase?.identities?.email?.[0] || "";
};
const buildOwnerProfile = (email, phoneNumber, now) => ({
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
const ensureOwnerProfile = async (req, res, next) => {
    const uid = req.user.uid;
    const userRef = firebase_1.db.collection("users").doc(uid);
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
    const userData = userSnap.data();
    if (userData.status === "blocked" || userData.status === "deactivated") {
        res.status(403).json({ error: "Owner account is not active." });
        return;
    }
    const updates = {};
    if (!userData.email) {
        updates.email = email;
    }
    if (!userData.phoneNumber || userData.phoneNumber === "Unknown") {
        updates.phoneNumber = phoneNumber || userData.phoneNumber || "";
    }
    if (!userData.role) {
        updates.role = "owner";
    }
    const effectiveRole = updates.role || userData.role;
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
app.post("/register", async (req, res) => {
    try {
        const uid = req.user.uid;
        const email = getVerifiedEmail(req);
        if (!email)
            return res.status(400).json({ error: "Verified email account is required for owner registration." });
        const { error, value } = ownerProfileSchema.validate(req.body);
        if (error)
            return res.status(400).json({ error: error.details[0].message });
        const userRef = firebase_1.db.collection("users").doc(uid);
        const existing = await userRef.get();
        const now = new Date().toISOString();
        const phoneNumber = value.phoneNumber || existing.data()?.phoneNumber || getVerifiedPhoneNumber(req);
        if (!phoneNumber)
            return res.status(400).json({ error: "Owner alert phone number is required." });
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
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
app.use(ensureOwnerProfile);
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
app.put("/fcm-token", async (req, res) => {
    try {
        const uid = req.user.uid;
        const { token } = req.body;
        if (!token)
            return res.status(400).json({ error: "Token is required" });
        await firebase_1.db.collection("users").doc(uid).update({
            fcmToken: token,
            updatedAt: new Date().toISOString()
        });
        res.json({ success: true });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
app.put("/profile", async (req, res) => {
    try {
        const uid = req.user.uid;
        const { error, value } = ownerProfileSchema.validate(req.body);
        if (error)
            return res.status(400).json({ error: error.details[0].message });
        const updates = { ...value, updatedAt: new Date().toISOString() };
        await firebase_1.db.collection("users").doc(uid).update(updates);
        res.json({ success: true, updates });
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
app.post("/vehicles", async (req, res) => {
    try {
        const uid = req.user.uid;
        const { error, value } = vehicleSchema.validate(req.body);
        if (error)
            return res.status(400).json({ error: error.details[0].message });
        const qrToken = (0, qrService_1.generateVehicleQRToken)();
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
        const docRef = await firebase_1.db.collection("vehicles").add(vehicleData);
        res.status(201).json({ id: docRef.id, ...vehicleData });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
app.put("/vehicles/:vehicleId", async (req, res) => {
    const { vehicleId } = req.params;
    const uid = req.user.uid;
    try {
        const { error, value } = vehicleUpdateSchema.validate(req.body);
        if (error)
            return res.status(400).json({ error: error.details[0].message });
        const docRef = firebase_1.db.collection("vehicles").doc(vehicleId);
        const docSnap = await docRef.get();
        if (!docSnap.exists || docSnap.data()?.userId !== uid) {
            return res.status(403).json({ error: "Access denied. Cannot modify non-owned vehicle." });
        }
        const updates = { ...value, updatedAt: new Date().toISOString() };
        await docRef.update(updates);
        res.json({ success: true, updates });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
app.delete("/vehicles/:vehicleId", async (req, res) => {
    const { vehicleId } = req.params;
    const uid = req.user.uid;
    try {
        const docRef = firebase_1.db.collection("vehicles").doc(vehicleId);
        const docSnap = await docRef.get();
        if (!docSnap.exists || docSnap.data()?.userId !== uid) {
            return res.status(403).json({ error: "Access denied. Cannot delete non-owned vehicle." });
        }
        await docRef.delete();
        res.json({ success: true });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// QR Code Re-generation (Self-service Owner security rotation)
app.put("/vehicles/:vehicleId/qr-regenerate", async (req, res) => {
    const { vehicleId } = req.params;
    const uid = req.user.uid;
    try {
        const docRef = firebase_1.db.collection("vehicles").doc(vehicleId);
        const docSnap = await docRef.get();
        // Strict Owner Validation
        if (!docSnap.exists || docSnap.data()?.userId !== uid) {
            return res.status(403).json({ error: "Access denied. Cannot modify non-owned asset." });
        }
        // Nuke the old hash and assign a new token
        const qrToken = (0, qrService_1.generateVehicleQRToken)();
        await docRef.update({
            qrToken,
            updatedAt: new Date().toISOString()
        });
        res.json({ success: true, qrToken });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Regular users can only VIEW alerts directed to their own vehicles (covered by endpoint above fetching from alerts using vehicleIds)
app.get("/alerts", async (req, res) => {
    try {
        const uid = req.user.uid;
        // Query by ownerId which is indexed and efficient
        const alertsSnap = await firebase_1.db.collection("alerts")
            .where("ownerId", "==", uid)
            .get();
        const alerts = alertsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        // Sort in memory to avoid needing composite index with timestamp
        alerts.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        res.json(alerts.slice(0, 50));
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
app.get("/alerts/history", async (req, res) => {
    try {
        const uid = req.user.uid;
        const { vehicleId, from, to, status } = req.query;
        // Use ownerId for an index-free query
        const alertsSnap = await firebase_1.db.collection("alerts")
            .where("ownerId", "==", uid)
            .get();
        const oneYearAgo = new Date(Date.now() - ONE_YEAR_MS).toISOString();
        const fromDate = typeof from === "string" && from ? new Date(from).toISOString() : oneYearAgo;
        const toDate = typeof to === "string" && to ? new Date(to).toISOString() : new Date().toISOString();
        const alerts = alertsSnap.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .filter(alert => 
        // In-memory filters
        alert.timestamp >= fromDate &&
            alert.timestamp <= toDate &&
            (!status || alert.status === status) &&
            (!vehicleId || alert.vehicleId === vehicleId));
        // Sort in-memory to avoid index requirement
        alerts.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        res.json(alerts);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Acknowledge Alert (On the way / Responded)
app.put("/alerts/:alertId/respond", async (req, res) => {
    const { alertId } = req.params;
    const uid = req.user.uid;
    const schema = joi_1.default.object({
        responseCode: joi_1.default.string().valid("acknowledged", "on_my_way", "call_me", "not_my_vehicle", "will_take_time", "resolved").required()
    });
    const { error, value } = schema.validate(req.body);
    if (error)
        return res.status(400).json({ error: error.details[0].message });
    const { responseCode } = value;
    try {
        const alertRef = firebase_1.db.collection("alerts").doc(alertId);
        const alertSnap = await alertRef.get();
        if (!alertSnap.exists)
            return res.status(404).json({ error: "Alert not found" });
        const alertData = alertSnap.data();
        // Primary check: Direct ownerId on alert
        // Fallback: Check vehicle ownership if alert is legacy
        let isOwner = alertData.ownerId === uid;
        if (!isOwner && alertData.vehicleId) {
            const vehicleSnap = await firebase_1.db.collection("vehicles").doc(alertData.vehicleId).get();
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
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.userApp = app;
//# sourceMappingURL=userApp.js.map