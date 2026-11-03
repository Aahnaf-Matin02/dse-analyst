import { Request, Response, NextFunction } from "express";
import { activeSessions } from "./auth";
import { UserRepository } from "../repositories/userRepository";

interface IpRateRecord {
  hourWindowStart: number;
  hourCount: number;
  dayWindowStart: number;
  dayCount: number;
}

const anonymousIpMap = new Map<string, IpRateRecord>();

const ONE_HOUR_MS = 60 * 60 * 1000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export const MAX_ANON_PER_HOUR = 5;
export const MAX_ANON_PER_DAY = 20;

export function resetAnonymousQuotas() {
  anonymousIpMap.clear();
}

/**
 * Enforces per-IP rate limits on /api/gemini/* for anonymous / unauthenticated visitors:
 * - 5 requests per hour
 * - 20 requests per day
 * Returns HTTP 429 with a clear informative message.
 */
export function geminiAnonymousRateLimiter(req: Request, res: Response, next: NextFunction) {
  // Allow health/status endpoint without rate limiting
  if (req.path === "/status" || req.path === "/api/gemini/status") {
    return next();
  }

  // Check if caller is authenticated
  const authHeader = req.headers["authorization"];
  let token = authHeader && authHeader.split(" ")[1];
  if (!token) {
    token = req.headers["x-session-token"] as string;
  }

  if (token) {
    const session = activeSessions.get(token);
    if (session && UserRepository.getByEmail(session.email)) {
      // Authenticated user: governed by SaaS plan limits in checkSubscriptionLimits
      return next();
    }
  }

  // Anonymous / Guest user: resolve real client IP (behind trust proxy)
  const clientIp = (req.ip || (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || "127.0.0.1") as string;
  const now = Date.now();

  let record = anonymousIpMap.get(clientIp);
  if (!record) {
    record = {
      hourWindowStart: now,
      hourCount: 1,
      dayWindowStart: now,
      dayCount: 1
    };
    anonymousIpMap.set(clientIp, record);
    return next();
  }

  // Reset hour window if expired
  if (now - record.hourWindowStart >= ONE_HOUR_MS) {
    record.hourWindowStart = now;
    record.hourCount = 0;
  }

  // Reset day window if expired
  if (now - record.dayWindowStart >= ONE_DAY_MS) {
    record.dayWindowStart = now;
    record.dayCount = 0;
  }

  // Check hourly limit
  if (record.hourCount >= MAX_ANON_PER_HOUR) {
    const retryAfterSeconds = Math.ceil((ONE_HOUR_MS - (now - record.hourWindowStart)) / 1000);
    res.setHeader("Retry-After", retryAfterSeconds);
    return res.status(429).json({
      error: "ANONYMOUS_RATE_LIMIT_EXCEEDED",
      message: `Anonymous AI rate limit exceeded: maximum ${MAX_ANON_PER_HOUR} requests per hour. Please wait or sign in to an account for higher quotas.`,
      retryAfterSeconds
    });
  }

  // Check daily limit
  if (record.dayCount >= MAX_ANON_PER_DAY) {
    const retryAfterSeconds = Math.ceil((ONE_DAY_MS - (now - record.dayWindowStart)) / 1000);
    res.setHeader("Retry-After", retryAfterSeconds);
    return res.status(429).json({
      error: "ANONYMOUS_DAILY_LIMIT_EXCEEDED",
      message: `Anonymous AI daily limit exceeded: maximum ${MAX_ANON_PER_DAY} requests per day. Please sign in to an account for higher quotas.`,
      retryAfterSeconds
    });
  }

  record.hourCount++;
  record.dayCount++;
  next();
}
