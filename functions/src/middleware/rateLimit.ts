import { Request, Response, NextFunction } from "express";
import { db } from "../config/firebase";
import { AuthRequest } from "./auth";

interface RateLimitConfig {
  windowMs: number;
  max: number;
  message: string;
  keyPrefix?: string;
}

const getClientIp = (req: Request): string => {
  const forwarded = req.headers["x-forwarded-for"];
  if (Array.isArray(forwarded)) return forwarded[0] || "unknown-ip";
  if (typeof forwarded === "string") return forwarded.split(",")[0].trim();
  return req.socket.remoteAddress || req.ip || "unknown-ip";
};

const getDeviceId = (req: Request): string => {
  const deviceHeader = req.headers["x-device-id"];
  if (Array.isArray(deviceHeader)) return deviceHeader[0] || "unknown-device";
  return deviceHeader || "unknown-device";
};

export const rateLimitMiddleware = (config: RateLimitConfig) => {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    const ip = getClientIp(req);
    const deviceId = getDeviceId(req);
    const phone = req.user?.phone_number || req.body.senderPhone;
    const uid = req.user?.uid;
    const identifier = [config.keyPrefix || req.path, phone || uid || "anonymous", deviceId, ip].join(":");
    
    // Hash or sanitize the identifier to avoid invalid document paths
    const docId = Buffer.from(identifier).toString("base64url");
    const rateLimitRef = db.collection("rate_limits").doc(docId);

    try {
      await db.runTransaction(async (transaction) => {
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

        const data = doc.data()!;
        const { count, windowStart } = data;

        if (now - windowStart < config.windowMs) {
          if (count >= config.max) {
            throw new Error("RATE_LIMIT_EXCEEDED");
          } else {
            transaction.update(rateLimitRef, { count: count + 1, lastSeen: now, lastIp: ip, lastDeviceId: deviceId });
          }
        } else {
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
    } catch (error: any) {
      if (error.message === "RATE_LIMIT_EXCEEDED") {
        res.status(429).json({ error: config.message });
      } else {
        console.error("Rate limiting error:", error);
        res.status(500).json({ error: "Internal Server Error" });
      }
    }
  };
};
