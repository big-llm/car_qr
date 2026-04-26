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
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAdmin = exports.requireAuth = void 0;
const firebase_1 = require("../config/firebase");
const getBearerToken = (req) => {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
        return authHeader.split(" ")[1];
    }
    const cookieHeader = req.headers.cookie;
    if (!cookieHeader)
        return null;
    const sessionCookie = cookieHeader
        .split(";")
        .map((cookie) => cookie.trim())
        .find((cookie) => cookie.startsWith("__session="));
    return sessionCookie ? decodeURIComponent(sessionCookie.split("=")[1]) : null;
};
// Middleware to strongly verify normal user auth (for vehicle owners)
const requireAuth = async (req, res, next) => {
    const token = getBearerToken(req);
    if (!token) {
        res.status(401).json({ error: "Unauthorized: Missing authentication token" });
        return;
    }
    try {
        const decodedToken = token.split(".").length === 3
            ? await firebase_1.auth.verifySessionCookie(token, true).catch(() => firebase_1.auth.verifyIdToken(token))
            : await firebase_1.auth.verifyIdToken(token);
        req.user = decodedToken;
        next();
    }
    catch (error) {
        console.error("Auth verification error:", error);
        res.status(401).json({ error: "Unauthorized: Invalid authentication token" });
    }
};
exports.requireAuth = requireAuth;
const jwt = __importStar(require("jsonwebtoken"));
const ADMIN_JWT_SECRET = (() => {
    const secret = process.env.ADMIN_JWT_SECRET;
    if (!secret) {
        if (process.env.NODE_ENV === "production") {
            throw new Error("FATAL: ADMIN_JWT_SECRET environment variable is not set. Server cannot start.");
        }
        return "INSECURE_DEV_ONLY_KEY_DO_NOT_USE_IN_PROD";
    }
    return secret;
})();
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
    try {
        // 1. Try Firebase Auth first (for real admin accounts)
        try {
            const decodedToken = await firebase_1.auth.verifyIdToken(token);
            if (decodedToken.admin === true) {
                req.user = decodedToken;
                next();
                return;
            }
        }
        catch (firebaseErr) {
            // Not a firebase admin token, try JWT
        }
        // 2. Try JWT for fixed-credential admin session (the modern secure way)
        const decoded = jwt.verify(token, ADMIN_JWT_SECRET);
        if (decoded.role === 'admin') {
            req.user = { uid: "admin_fixed", admin: true };
            next();
            return;
        }
        res.status(403).json({ error: "Forbidden: Admin privileges required" });
    }
    catch (error) {
        console.error("Admin verification error:", error);
        res.status(401).json({ error: "Unauthorized: Invalid or expired session" });
    }
};
exports.requireAdmin = requireAdmin;
//# sourceMappingURL=auth.js.map