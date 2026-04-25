import { Request, Response, NextFunction } from "express";
import * as admin from "firebase-admin";
import { auth } from "../config/firebase";

export interface AuthRequest extends Request {
  user?: admin.auth.DecodedIdToken;
}

const getBearerToken = (req: Request): string | null => {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.split(" ")[1];
  }

  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return null;

  const sessionCookie = cookieHeader
    .split(";")
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith("__session="));

  return sessionCookie ? decodeURIComponent(sessionCookie.split("=")[1]) : null;
};

// Middleware to strongly verify normal user auth (for vehicle owners)
export const requireAuth = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  const token = getBearerToken(req);
  if (!token) {
    res.status(401).json({ error: "Unauthorized: Missing authentication token" });
    return;
  }

  try {
    const decodedToken = token.split(".").length === 3
      ? await auth.verifySessionCookie(token, true).catch(() => auth.verifyIdToken(token))
      : await auth.verifyIdToken(token);
    req.user = decodedToken;
    next();
  } catch (error) {
    console.error("Auth verification error:", error);
    res.status(401).json({ error: "Unauthorized: Invalid authentication token" });
  }
};

import * as jwt from "jsonwebtoken";

const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET || "SUPER_SECRET_ADMIN_KEY_1337";

// Middleware to strongly verify admin auth (for Admin Panel)
export const requireAdmin = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
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
      const decodedToken = await auth.verifyIdToken(token);
      if (decodedToken.admin === true) {
        req.user = decodedToken;
        next();
        return;
      }
    } catch (firebaseErr) {
      // Not a firebase admin token, try JWT
    }

    // 2. Try JWT for fixed-credential admin session (the modern secure way)
    const decoded: any = jwt.verify(token, ADMIN_JWT_SECRET);
    if (decoded.role === 'admin') {
      req.user = { uid: "admin_fixed", admin: true } as any;
      next();
      return;
    }

    res.status(403).json({ error: "Forbidden: Admin privileges required" });
  } catch (error) {
    console.error("Admin verification error:", error);
    res.status(401).json({ error: "Unauthorized: Invalid or expired session" });
  }
};
