import { Request, Response, NextFunction } from "express";

const isProduction = () => process.env.NODE_ENV === "production";

/**
 * Content-Security-Policy for the built SPA. The only third-party origin the frontend uses is Google Fonts.
 * Not sent in development: Vite's dev server injects inline scripts and a websocket that would be blocked.
 */
export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests"
].join("; ");

export function securityHeaders(req: Request, res: Response, next: NextFunction) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
  if (isProduction()) {
    res.setHeader("Content-Security-Policy", CONTENT_SECURITY_POLICY);
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  // API responses can carry account data: keep them out of shared caches
  if (req.path.startsWith("/api/")) {
    res.setHeader("Cache-Control", "no-store");
  }
  next();
}

/**
 * CORS: the SPA is served from the same origin as the API, so no cross-origin access is needed by default.
 * Extra origins (e.g. a separate frontend domain) can be allowed with CORS_ORIGINS="https://a.com,https://b.com".
 */
export function corsAllowList(req: Request, res: Response, next: NextFunction) {
  const allowed = (process.env.CORS_ORIGINS || "").split(",").map(s => s.trim()).filter(Boolean);
  const origin = req.headers.origin;
  if (origin && allowed.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Session-Token");
  }
  if (req.method === "OPTIONS") {
    return res.sendStatus(origin && allowed.includes(origin) ? 204 : 403);
  }
  next();
}
