"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rateLimitMiddleware = void 0;
const firebase_1 = require("../config/firebase");
const rateLimitMiddleware = (config) => {
    return async (req, res, next) => {
        // Basic IP detection; be mindful of proxies (e.g. Cloudflare or Firebase hosting)
        const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown-ip';
        // For specific routes, we might rate limit by phone number instead of IP
        const identifier = req.body.senderPhone || ip;
        // Hash or sanitize the identifier to avoid invalid document paths
        const docId = Buffer.from(identifier).toString("base64");
        const rateLimitRef = firebase_1.db.collection("rate_limits").doc(docId);
        try {
            await firebase_1.db.runTransaction(async (transaction) => {
                const doc = await transaction.get(rateLimitRef);
                const now = Date.now();
                if (!doc.exists) {
                    transaction.set(rateLimitRef, { count: 1, windowStart: now });
                    return;
                }
                const data = doc.data();
                const { count, windowStart } = data;
                if (now - windowStart < config.windowMs) {
                    if (count >= config.max) {
                        throw new Error("RATE_LIMIT_EXCEEDED");
                    }
                    else {
                        transaction.update(rateLimitRef, { count: count + 1 });
                    }
                }
                else {
                    // Reset window
                    transaction.set(rateLimitRef, { count: 1, windowStart: now });
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