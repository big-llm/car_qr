"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rateLimitMiddleware = void 0;
const firebase_1 = require("../config/firebase");
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
const rateLimitMiddleware = (config) => {
    return async (req, res, next) => {
        const ip = getClientIp(req);
        const deviceId = getDeviceId(req);
        const phone = req.user?.phone_number || req.body.senderPhone;
        const uid = req.user?.uid;
        const identifier = [config.keyPrefix || req.path, phone || uid || "anonymous", deviceId, ip].join(":");
        // Hash or sanitize the identifier to avoid invalid document paths
        const docId = Buffer.from(identifier).toString("base64url");
        const rateLimitRef = firebase_1.db.collection("rate_limits").doc(docId);
        try {
            await firebase_1.db.runTransaction(async (transaction) => {
                const doc = await transaction.get(rateLimitRef);
                const now = Date.now();
                if (!doc.exists) {
                    transaction.set(rateLimitRef, {
                        count: 1,
                        windowStart: now,
                        identifier,
                        lastIp: ip,
                        lastDeviceId: deviceId
                    });
                    return;
                }
                const data = doc.data();
                const { count, windowStart } = data;
                if (now - windowStart < config.windowMs) {
                    if (count >= config.max) {
                        throw new Error("RATE_LIMIT_EXCEEDED");
                    }
                    else {
                        transaction.update(rateLimitRef, { count: count + 1, lastSeen: now, lastIp: ip, lastDeviceId: deviceId });
                    }
                }
                else {
                    // Reset window
                    transaction.set(rateLimitRef, {
                        count: 1,
                        windowStart: now,
                        identifier,
                        lastIp: ip,
                        lastDeviceId: deviceId
                    });
                }
            });
            next();
        }
        catch (error) {
            if (error.message === "RATE_LIMIT_EXCEEDED") {
                res.status(429).json({ error: config.message });
            }
            else {
                console.error("Rate limiting error:", error);
                res.status(500).json({ error: "Internal Server Error" });
            }
        }
    };
};
exports.rateLimitMiddleware = rateLimitMiddleware;
//# sourceMappingURL=rateLimit.js.map