import { Request, Response, NextFunction } from "express";
import crypto from "crypto";

/**
 * Constant-time string comparison (avoids leaking secret length/prefix via timing).
 */
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

/**
 * Guards admin data-modification routes with the ADMIN_IMPORT_SECRET env variable.
 * There is deliberately no default secret: if ADMIN_IMPORT_SECRET is unset, every admin call is refused.
 */
export function verifyAdminSecret(req: Request, res: Response, next: NextFunction) {
  const configuredSecret = process.env.ADMIN_IMPORT_SECRET;
  const secretHeader = req.headers["x-admin-secret"];

  if (!configuredSecret) {
    return res.status(503).json({
      success: false,
      error: "Admin actions are disabled: ADMIN_IMPORT_SECRET is not configured on the server.",
      message: "Admin actions are disabled: ADMIN_IMPORT_SECRET is not configured on the server."
    });
  }

  if (typeof secretHeader !== "string" || !safeEqual(secretHeader, configuredSecret)) {
    return res.status(401).json({
      success: false,
      error: "Unauthorized history admin action.",
      message: "Unauthorized history admin action. Check the admin secret."
    });
  }
  next();
}
