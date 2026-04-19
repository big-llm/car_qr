import { Request, Response, NextFunction } from "express";
import { db } from "../config/firebase";

interface RateLimitConfig {
  windowMs: number;
  max: number;
  message: string;
}

export const rateLimitMiddleware = (config: RateLimitConfig) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Basic IP detection; be mindful of proxies (e.g. Cloudflare or Firebase hosting)
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown-ip';
    // For specific routes, we might rate limit by phone number instead of IP
    const identifier = req.body.senderPhone || ip;
    
    // Hash or sanitize the identifier to avoid invalid document paths
    const docId = Buffer.from(identifier as string).toString("base64");
    const rateLimitRef = db.collection("rate_limits").doc(docId);

    try {
      await db.runTransaction(async (transaction) => {
        const doc = await transaction.get(rateLimitRef);
        const now = Date.now();

        if (!doc.exists) {
          transaction.set(rateLimitRef, { count: 1, windowStart: now });
          return;
        }

        const data = doc.data()!;
        const { count, windowStart } = data;

        if (now - windowStart < config.windowMs) {
          if (count >= config.max) {
            throw new Error("RATE_LIMIT_EXCEEDED");
          } else {
            transaction.update(rateLimitRef, { count: count + 1 });
          }
        } else {
          // Reset window
          transaction.set(rateLimitRef, { count: 1, windowStart: now });
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
