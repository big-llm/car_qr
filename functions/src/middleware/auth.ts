import { Request, Response, NextFunction } from "express";
import * as admin from "firebase-admin";
import { auth } from "../config/firebase";

export interface AuthRequest extends Request {
  user?: admin.auth.DecodedIdToken;
}

// Middleware to strongly verify normal user auth (for vehicle owners)
export const requireAuth = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized: Missing authentication token" });
    return;
  }

  const token = authHeader.split(" ")[1];
  try {
    const decodedToken = await auth.verifyIdToken(token);
    req.user = decodedToken;
    next();
  } catch (error) {
    console.error("Auth verification error:", error);
    res.status(401).json({ error: "Unauthorized: Invalid authentication token" });
  }
};

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

  // Custom Fixed-Credential Admin Bypass
  if (token.startsWith("CUSTOM_ADMIN_AUTH_TOKEN_")) {
     req.user = { admin: true } as any; 
     next();
     return;
  }

  try {
    const decodedToken = await auth.verifyIdToken(token);
    // Assuming custom claims { admin: true } are set for admins
    if (decodedToken.admin !== true) {
      res.status(403).json({ error: "Forbidden: Admin privileges required" });
      return;
    }
    req.user = decodedToken;
    next();
  } catch (error) {
    console.error("Admin verification error:", error);
    res.status(401).json({ error: "Unauthorized: Invalid authentication token" });
  }
};
