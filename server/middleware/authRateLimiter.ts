import { Request, Response, NextFunction } from "express";

/**
 * Per-IP fixed-window limits for credential and code endpoints (brute force, OTP guessing, email flooding).
 * Applies in every environment, unlike the general API limiter. In-memory, so limits are per instance.
 */
const RULES: Record<string, { max: number; windowMs: number }> = {
  "/login": { max: 10, windowMs: 15 * 60 * 1000 },
  "/signup": { max: 5, windowMs: 60 * 60 * 1000 },
  "/verify-email": { max: 10, windowMs: 15 * 60 * 1000 },
  "/resend-verification": { max: 5, windowMs: 60 * 60 * 1000 },
  "/forgot-password": { max: 5, windowMs: 60 * 60 * 1000 },
  "/reset-password": { max: 10, windowMs: 15 * 60 * 1000 }
};

const hits = new Map<string, { count: number; windowStart: number }>();

export function resetAuthRateLimits() {
  hits.clear();
}

export function authRateLimiter(req: Request, res: Response, next: NextFunction) {
  const rule = req.method === "POST" ? RULES[req.path] : undefined;
  if (!rule) return next();

  const ip = req.ip || req.socket.remoteAddress || "unknown";
  const key = `${req.path}|${ip}`;
  const now = Date.now();
  const rec = hits.get(key);

  if (!rec || now - rec.windowStart >= rule.windowMs) {
    hits.set(key, { count: 1, windowStart: now });
    return next();
  }
  if (rec.count >= rule.max) {
    const retryAfterSeconds = Math.ceil((rule.windowMs - (now - rec.windowStart)) / 1000);
    res.setHeader("Retry-After", retryAfterSeconds);
    return res.status(429).json({
      error: "RATE_LIMITED",
      message: `Too many attempts. Please try again in ${Math.ceil(retryAfterSeconds / 60)} minute(s).`
    });
  }
  rec.count++;
  next();
}

// Drop stale entries so the map cannot grow without bound
setInterval(() => {
  const now = Date.now();
  for (const [key, rec] of hits.entries()) {
    if (now - rec.windowStart > 60 * 60 * 1000) hits.delete(key);
  }
}, 10 * 60 * 1000).unref();
