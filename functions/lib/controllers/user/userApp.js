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
const buildOwnerProfile = (phoneNumber, now) => ({
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
    if (!userSnap.exists) {
        if (!phoneNumber) {
            res.status(403).json({ error: "Owner profile not found. Please register first." });
            return;
        }
        const now = new Date().toISOString();
        await userRef.set(buildOwnerProfile(phoneNumber, now), { merge: true });
        next();
        return;
    }
    const userData = userSnap.data();
    if (userData.status === "blocked" || userData.status === "deactivated") {
        res.status(403).json({ error: "Owner account is not active." });
        return;
    }
    const updates = {};
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
const getOwnedVehicleIds = async (uid) => {
    const vehiclesSnap = await firebase_1.db.collection("vehicles").where("userId", "==", uid).get();
    return vehiclesSnap.docs.map(doc => doc.id);
};
// === REGISTRATION ===
app.post("/register", async (req, res) => {
    try {
        const uid = req.user.uid;
        const phoneNumber = getVerifiedPhoneNumber(req);
        if (!phoneNumber)
            return res.status(400).json({ error: "Verified phone number is required." });
        const { error, value } = ownerProfileSchema.validate(req.body);
        if (error)
            return res.status(400).json({ error: error.details[0].message });
        const userRef = firebase_1.db.collection("users").doc(uid);
        const existing = await userRef.get();
        const now = new Date().toISOString();
        const userData = {
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
app.get("/alerts/history", async (req, res) => {
    try {
        const uid = req.user.uid;
        const { vehicleId, from, to, status } = req.query;
        const vehicleIds = await getOwnedVehicleIds(uid);
        if (vehicleIds.length === 0)
            return res.json([]);
        const requestedVehicle = typeof vehicleId === "string" ? vehicleId : "";
        if (requestedVehicle && !vehicleIds.includes(requestedVehicle)) {
            return res.status(403).json({ error: "Access denied for selected vehicle." });
        }
        const effectiveVehicleIds = requestedVehicle ? [requestedVehicle] : vehicleIds.slice(0, 10);
        const oneYearAgo = new Date(Date.now() - ONE_YEAR_MS).toISOString();
        const fromDate = typeof from === "string" && from ? new Date(from).toISOString() : oneYearAgo;
        const toDate = typeof to === "string" && to ? new Date(to).toISOString() : new Date().toISOString();
        const alertsSnap = await firebase_1.db.collection("alerts")
            .where("vehicleId", "in", effectiveVehicleIds)
            .orderBy("timestamp", "desc")
            .get();
        const alerts = alertsSnap.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .filter(alert => alert.timestamp >= fromDate &&
            alert.timestamp <= toDate &&
            (!status || alert.status === status));
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
        // Validate ownership before updating status
        const vehicleId = alertSnap.data()?.vehicleId;
        const vehicleSnap = await firebase_1.db.collection("vehicles").doc(vehicleId).get();
        if (!vehicleSnap.exists || vehicleSnap.data()?.userId !== uid) {
            return res.status(403).json({ error: "Access denied." });
        }
        const alertData = alertSnap.data();
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