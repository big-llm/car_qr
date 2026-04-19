"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAdmin = exports.requireAuth = void 0;
const firebase_1 = require("../config/firebase");
// Middleware to strongly verify normal user auth (for vehicle owners)
const requireAuth = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        res.status(401).json({ error: "Unauthorized: Missing authentication token" });
        return;
    }
    const token = authHeader.split(" ")[1];
    try {
        const decodedToken = await firebase_1.auth.verifyIdToken(token);
        req.user = decodedToken;
        next();
    }
    catch (error) {
        console.error("Auth verification error:", error);
        res.status(401).json({ error: "Unauthorized: Invalid authentication token" });
    }
};
exports.requireAuth = requireAuth;
// Middleware to strongly verify admin auth (for Admin Panel)
const requireAdmin = async (req, res, next) => {
    // Allow OPTIONS preflight for CORS freely
    if (req.method === 'OPTIONS') {
        next();
        return;
    }
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        res.status(401).json({ error: "Unauthorized: Missing authentication token" });
        return;
    }
    const token = authHeader.split(" ")[1];
    // Custom Fixed-Credential Admin Bypass
    if (token.startsWith("CUSTOM_ADMIN_AUTH_TOKEN_")) {
        req.user = { admin: true };
        next();
        return;
    }
    try {
        const decodedToken = await firebase_1.auth.verifyIdToken(token);
        // Assuming custom claims { admin: true } are set for admins
        if (decodedToken.admin !== true) {
            res.status(403).json({ error: "Forbidden: Admin privileges required" });
            return;
        }
        req.user = decodedToken;
        next();
    }
    catch (error) {
        console.error("Admin verification error:", error);
        res.status(401).json({ error: "Unauthorized: Invalid authentication token" });
    }
};
exports.requireAdmin = requireAdmin;
//# sourceMappingURL=auth.js.map