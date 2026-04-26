"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.publicApp = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const firebase_1 = require("../../config/firebase");
const rateLimit_1 = require("../../middleware/rateLimit");
const auth_1 = require("../../middleware/auth");
const alertProcessor_1 = require("../../services/alertProcessor");
const joi_1 = __importDefault(require("joi"));
const app = (0, express_1.default)();
const ALERT_TTL_MS = 15 * 60 * 1000;
const MAX_ALERTS_PER_HOUR = 5;
const MAX_DEVICE_ALERTS_PER_HOUR = 8;
app.use((0, cors_1.default)({ origin: true }));
app.use((0, helmet_1.default)());
app.use(express_1.default.json());
const getClientIp = (req) => {
    const forwarded = req.headers["x-forwarded-for"];
    if (Array.isArray(forwarded))
        return forwarded[0] || "unknown-ip";
    if (typeof forwarded === "string")
        return forwarded.split(",")[0].trim();
    return req.socket.remoteAddress || req.ip || "unknown-ip";
};
const getDeviceId = (req) => {
    const deviceHeader = req.headers["x-device-id"];
    if (Array.isArray(deviceHeader))
        return deviceHeader[0] || "unknown-device";
    return deviceHeader || "unknown-device";
};
const incrementAbuseWindow = async (kind, value, windowMs) => {
    const now = Date.now();
    const windowStart = Math.floor(now / windowMs) * windowMs;
    const docId = Buffer.from(`${kind}:${value}:${windowStart}`).toString("base64url");
    const ref = firebase_1.db.collection("abuse_windows").doc(docId);
    return firebase_1.db.runTransaction(async (transaction) => {
        const snap = await transaction.get(ref);
        if (!snap.exists) {
            transaction.set(ref, {
                kind,
                value,
                count: 1,
                windowStart,
                expiresAt: new Date(windowStart + windowMs).toISOString(),
                updatedAt: new Date().toISOString()
            });
            return 1;
        }
        const nextCount = (snap.data()?.count || 0) + 1;
        transaction.update(ref, {
            count: nextCount,
            updatedAt: new Date().toISOString()
        });
        return nextCount;
    });
};
app.post("/session", auth_1.requireAuth, async (req, res) => {
    const authHeader = req.headers.authorization;
    const idToken = authHeader?.startsWith("Bearer ") ? authHeader.split(" ")[1] : null;
    if (!idToken) {
        return res.status(400).json({ error: "Missing Firebase ID token" });
    }
    try {
        const expiresIn = 1000 * 60 * 60 * 24 * 14;
        const sessionCookie = await firebase_1.auth.createSessionCookie(idToken, { expiresIn });
        res.cookie("__session", sessionCookie, {
            maxAge: expiresIn,
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax"
        });
        res.json({ success: true, expiresIn });
    }
    catch (error) {
        res.status(401).json({ error: "Unable to create session" });
    }
});
// Public Endpoint to resolve QR token and get safe vehicle info
app.get("/qr/:token", async (req, res) => {
    const { token } = req.params;
    try {
        const vehiclesSnap = await firebase_1.db.collection("vehicles").where("qrToken", "==", token).limit(1).get();
        if (vehiclesSnap.empty) {
            return res.status(404).json({ error: "Vehicle not found or invalid QR code" });
        }
        const vehicle = vehiclesSnap.docs[0].data();
        // Extracted safe data to show the scanner (DO NOT expose phone number or real user ID)
        res.json({
            success: true,
            vehicle: {
                id: vehiclesSnap.docs[0].id,
                licensePlateMasked: `***${vehicle.licensePlate.slice(-3)}`,
                make: vehicle.make,
                model: vehicle.model
            }
        });
    }
    catch (error) {
        res.status(500).json({ error: "Internal Server Error" });
    }
});
// Endpoint to send an alert to the vehicle owner
// Includes Rate Limiting to prevent spam
app.post("/qr/:token/alert", auth_1.requireAuth, (0, rateLimit_1.rateLimitMiddleware)({
    windowMs: 15 * 60 * 1000,
    max: 3,
    message: "Too many alerts sent from this verified device. Try again later.",
    keyPrefix: "scanner-alert"
}), async (req, res) => {
    const { token } = req.params;
    const { type } = req.body;
    // AuthRequest physically guarantees secure extraction of Phone Number matching Firebase 2FA logic
    const senderPhone = req.user?.phone_number;
    if (!senderPhone || senderPhone.length < 10) {
        return res.status(401).json({ error: "Verified phone number is missing from your secure account." });
    }
    // Strict Request Validation
    const schema = joi_1.default.object({
        type: joi_1.default.string().valid("blocking_vehicle", "blocking_road", "lights_on", "emergency").required(),
        location: joi_1.default.object({
            lat: joi_1.default.number().required(),
            lng: joi_1.default.number().required()
        }).allow(null).optional()
    });
    const { error } = schema.validate(req.body);
    if (error) {
        return res.status(400).json({ error: error.details[0].message });
    }
    const { location } = req.body;
    try {
        // 1. Check if the sender is globally blocked
        const senderHash = Buffer.from(senderPhone).toString("base64url");
        const legacySenderHash = Buffer.from(senderPhone).toString("base64");
        const [blockSnap, legacyBlockSnap] = await Promise.all([
            firebase_1.db.collection("blocked_numbers").doc(senderHash).get(),
            firebase_1.db.collection("blocked_numbers").doc(legacySenderHash).get()
        ]);
        if (blockSnap.exists || legacyBlockSnap.exists) {
            return res.status(403).json({ error: "Your number is blocked from sending requests." });
        }
        // 1b. Reputation System Check (Prevent Harassment)
        const deviceId = getDeviceId(req);
        const clientIp = getClientIp(req);
        const oneHourMs = 60 * 60 * 1000;
        const [recentCount, deviceRecentCount] = await Promise.all([
            incrementAbuseWindow("phone", senderPhone, oneHourMs),
            incrementAbuseWindow("device", deviceId, oneHourMs)
        ]);
        if (recentCount > MAX_ALERTS_PER_HOUR || deviceRecentCount > MAX_DEVICE_ALERTS_PER_HOUR) {
            // Auto-block for harassment
            await firebase_1.db.collection("blocked_numbers").doc(senderHash).set({
                phoneNumber: senderPhone,
                reason: `Automated block: Exceeded threshold. phone=${recentCount}/hour device=${deviceRecentCount}/hour.`,
                blockedAt: new Date().toISOString(),
                deviceId,
                ip: clientIp
            });
            // Mark scanner as banned in registry
            await firebase_1.db.collection("scanners").doc(senderPhone).update({
                status: 'blocked',
                banReason: 'Harassment/Excessive Pinging',
                lastDeviceId: deviceId,
                lastIp: clientIp
            }).catch(() => { });
            return res.status(403).json({ error: "Access Denied: Your account has been automatically flagged and blocked for excessive activity." });
        }
        // 2. Validate Vehicle
        const vehiclesSnap = await firebase_1.db.collection("vehicles").where("qrToken", "==", token).limit(1).get();
        if (vehiclesSnap.empty) {
            return res.status(404).json({ error: "Invalid QR code" });
        }
        const vehicleId = vehiclesSnap.docs[0].id;
        const vehicleData = vehiclesSnap.docs[0].data();
        const now = new Date();
        const expiresAt = new Date(now.getTime() + ALERT_TTL_MS).toISOString();
        // 3. Create Alert
        const alertData = {
            vehicleId,
            ownerId: vehicleData.userId, // ADDED for simpler real-time listening
            qrToken: token,
            type,
            senderUid: req.user?.uid,
            senderPhone: senderPhone, // UNMASKED for Admin Vaults
            rawSenderHash: senderHash,
            timestamp: now.toISOString(),
            expiresAt,
            status: "pending",
            notificationStatus: "pending",
            deliveryLog: [],
            metadata: {
                ip: clientIp,
                userAgent: req.get("user-agent"),
                deviceId,
                location: location || null
            }
        };
        const alertRef = await firebase_1.db.collection("alerts").add(alertData);
        // 1. Log Scanner to Registry
        const scannerRef = firebase_1.db.collection("scanners").doc(senderPhone);
        await firebase_1.db.runTransaction(async (t) => {
            const doc = await t.get(scannerRef);
            if (!doc.exists) {
                t.set(scannerRef, {
                    phoneNumber: senderPhone,
                    totalScans: 1,
                    lastScan: new Date().toISOString(),
                    status: 'active',
                    lastIp: clientIp,
                    lastDeviceId: deviceId,
                    lastUserAgent: req.get("user-agent")
                });
            }
            else {
                const data = doc.data();
                t.update(scannerRef, {
                    totalScans: (data.totalScans || 1) + 1,
                    lastScan: new Date().toISOString(),
                    lastIp: clientIp,
                    lastDeviceId: deviceId,
                    lastUserAgent: req.get("user-agent")
                });
            }
        });
        // 2. Transmit Alert asynchronously without waiting, or wait if needed
        await (0, alertProcessor_1.processNewAlert)(alertRef.id, alertData);
        res.status(200).json({ success: true, alertId: alertRef.id });
    }
    catch (error) {
        console.error("Alert generation error:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});
// Endpoint allowing Scanners to securely poll the status of their dispatched alert
app.get("/qr/alert/:alertId/status", auth_1.requireAuth, async (req, res) => {
    const { alertId } = req.params;
    const senderPhone = req.user?.phone_number;
    try {
        const alertSnap = await firebase_1.db.collection("alerts").doc(alertId).get();
        if (!alertSnap.exists)
            return res.status(404).json({ error: "Alert not found" });
        const alertData = alertSnap.data();
        if (alertData.senderPhone !== senderPhone) {
            return res.status(403).json({ error: "Access denied" });
        }
        if (alertData.expiresAt && alertData.expiresAt <= new Date().toISOString() && !["responded", "expired", "resolved"].includes(alertData.status)) {
            await alertSnap.ref.update({
                status: "expired",
                expiredAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });
            alertData.status = "expired";
        }
        res.json({
            status: alertData.status,
            notificationStatus: alertData.notificationStatus || null,
            ownerResponse: alertData.ownerResponse || null,
            respondedAt: alertData.respondedAt || null,
            expiresAt: alertData.expiresAt || null
        });
    }
    catch (e) {
        res.status(500).json({ error: "Polling failed" });
    }
});
// Public status check — alertId is a cryptographically random token, safe without auth
app.get("/qr/alert/:alertId/public-status", async (req, res) => {
    const { alertId } = req.params;
    if (!alertId || alertId.length < 10)
        return res.status(400).json({ error: "Invalid alert ID" });
    try {
        const alertSnap = await firebase_1.db.collection("alerts").doc(alertId).get();
        if (!alertSnap.exists)
            return res.status(404).json({ error: "Alert not found" });
        const alertData = alertSnap.data();
        if (alertData.expiresAt && alertData.expiresAt <= new Date().toISOString() && !["responded", "expired", "resolved"].includes(alertData.status)) {
            await alertSnap.ref.update({ status: "expired", expiredAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
            alertData.status = "expired";
        }
        // Only expose what the scanner needs to know — no personal owner data
        res.json({
            status: alertData.status,
            ownerResponse: alertData.ownerResponse || null,
            respondedAt: alertData.respondedAt || null,
            expiresAt: alertData.expiresAt || null
        });
    }
    catch (e) {
        res.status(500).json({ error: "Status check failed" });
    }
});
// === SCANNER PROFILE & HISTORY ===
app.get("/profile", auth_1.requireAuth, async (req, res) => {
    const senderPhone = req.user?.phone_number;
    if (!senderPhone)
        return res.status(401).json({ error: "Auth required" });
    try {
        const scannerDoc = await firebase_1.db.collection("scanners").doc(senderPhone).get();
        if (!scannerDoc.exists) {
            return res.json({ phoneNumber: senderPhone, status: 'active', totalScans: 0 });
        }
        res.json({ id: scannerDoc.id, ...scannerDoc.data() });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
app.put("/profile", auth_1.requireAuth, async (req, res) => {
    const senderPhone = req.user?.phone_number;
    if (!senderPhone)
        return res.status(401).json({ error: "Auth required" });
    const schema = joi_1.default.object({
        name: joi_1.default.string().max(50).allow("").optional()
    });
    const { error, value } = schema.validate(req.body);
    if (error)
        return res.status(400).json({ error: error.details[0].message });
    try {
        await firebase_1.db.collection("scanners").doc(senderPhone).set({
            ...value,
            updatedAt: new Date().toISOString()
        }, { merge: true });
        res.json({ success: true });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
app.get("/history", auth_1.requireAuth, async (req, res) => {
    const uid = req.user?.uid;
    if (!uid)
        return res.status(401).json({ error: "Auth required" });
    try {
        const alertsSnap = await firebase_1.db.collection("alerts")
            .where("senderUid", "==", uid)
            .orderBy("timestamp", "desc")
            .limit(50)
            .get();
        const alerts = alertsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        res.json(alerts);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.publicApp = app;
//# sourceMappingURL=publicApp.js.map