import { Request, Response, NextFunction } from "express";

const ipRequests = new Map<string, { count: number; windowStart: number }>();
const LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_MIN = 120; // 120 requests/min

export function rateLimiter(req: Request, res: Response, next: NextFunction) {
  // Never rate-limit static assets, fonts, or HTML document requests
  if (
    !req.path.startsWith("/api/") ||
    req.path.startsWith("/assets") ||
    req.path.endsWith(".js") ||
    req.path.endsWith(".css") ||
    req.path.endsWith(".png") ||
    req.path.endsWith(".svg") ||
    req.path.endsWith(".ico")
  ) {
    return next();
  }

  if (process.env.NODE_ENV !== "production") {
    return next();
  }
  const ip = (req.ip || req.headers["x-forwarded-for"] || "unknown") as string;
  const now = Date.now();

  const record = ipRequests.get(ip);
  if (!record) {
    ipRequests.set(ip, { count: 1, windowStart: now });
    return next();
  }

  if (now - record.windowStart < LIMIT_WINDOW_MS) {
    if (record.count >= 300) {
      return res.status(429).json({
        error: "Too many requests. Please slow down and try again later.",
        retryAfterMs: LIMIT_WINDOW_MS - (now - record.windowStart),
      });
    }
    record.count++;
  } else {
    // Reset window
    record.count = 1;
    record.windowStart = now;
  }

  next();
}
