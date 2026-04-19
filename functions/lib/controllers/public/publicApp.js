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
app.use((0, cors_1.default)({ origin: true }));
app.use((0, helmet_1.default)());
app.use(express_1.default.json());
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
app.post("/qr/:token/alert", (0, rateLimit_1.rateLimitMiddleware)({ windowMs: 15 * 60 * 1000, max: 3, message: "Too many alerts sent. Try again later." }), auth_1.requireAuth, async (req, res) => {
    const { token } = req.params;
    const { type } = req.body;
    // AuthRequest attaches decoded user, which for OTP contains phone_number
    const senderPhone = req.user?.phone_number;
    // Strict Request Validation
    const schema = joi_1.default.object({
        type: joi_1.default.string().valid("blocking_vehicle", "blocking_road", "lights_on", "emergency").required(),
    });
    const { error } = schema.validate({ type });
    if (error) {
        return res.status(400).json({ error: error.details[0].message });
    }
    if (!senderPhone) {
        return res.status(401).json({ error: "Verified phone number is missing from your account." });
    }
    try {
        // 1. Check if the sender is globally blocked
        const senderHash = Buffer.from(senderPhone).toString("base64");
        const blockSnap = await firebase_1.db.collection("blocked_numbers").doc(senderHash).get();
        if (blockSnap.exists) {
            return res.status(403).json({ error: "Your number is blocked from sending requests." });
        }
        // 2. Validate Vehicle
        const vehiclesSnap = await firebase_1.db.collection("vehicles").where("qrToken", "==", token).limit(1).get();
        if (vehiclesSnap.empty) {
            return res.status(404).json({ error: "Invalid QR code" });
        }
        const vehicleId = vehiclesSnap.docs[0].id;
        // 3. Mask sender's phone number for privacy
        const maskedSenderPhone = senderPhone.slice(0, 3) + "****" + senderPhone.slice(-4);
        // 4. Create Alert
        const alertData = {
            vehicleId,
            qrToken: token,
            type,
            senderPhone: maskedSenderPhone,
            rawSenderHash: senderHash, // Keep hashed verion to trace abuse without revealing raw easily
            timestamp: new Date().toISOString(),
            status: "pending",
            deliveryLog: []
        };
        const alertRef = await firebase_1.db.collection("alerts").add(alertData);
        // Manually trigger the notification logic (monolithic behavior)
        // Run it asynchronously in the background so it doesn't block the response
        (0, alertProcessor_1.processNewAlert)(alertRef.id, alertData).catch(err => console.error("Background processing failed", err));
        res.status(201).json({ success: true, alertId: alertRef.id, message: "Alert request sent successfully" });
    }
    catch (error) {
        console.error("Alert generation error:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});
exports.publicApp = app;
//# sourceMappingURL=publicApp.js.map