import { Request, Response, NextFunction } from "express";
import fs from "fs";
import path from "path";
import { UserRepository } from "../repositories/userRepository";

const SESSIONS_DB_PATH = process.env.SESSIONS_DB_PATH || path.join(process.cwd(), "data", "sessions_db.json");

export interface SessionData {
  email: string;
  expiresAt: Date;
}

// Session store for active users
export const activeSessions = new Map<string, SessionData>();

function ensureDirExists(filePath: string) {
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  } catch (err) {
    // Fail silently
  }
}

export function loadSessionsFromDisk() {
  try {
    ensureDirExists(SESSIONS_DB_PATH);
    if (fs.existsSync(SESSIONS_DB_PATH)) {
      const content = fs.readFileSync(SESSIONS_DB_PATH, "utf-8");
      const data = JSON.parse(content);
      const now = new Date();
      if (data && typeof data === "object") {
        for (const [token, session] of Object.entries(data)) {
          const s = session as any;
          if (s && s.email && s.expiresAt) {
            const expiresAt = new Date(s.expiresAt);
            if (expiresAt > now) {
              activeSessions.set(token, {
                email: s.email,
                expiresAt
              });
            }
          }
        }
      }
      console.log(`[AuthMiddleware] Successfully loaded ${activeSessions.size} active sessions from disk.`);
    }
  } catch (err) {
    console.warn("[AuthMiddleware] Failed to load sessions from disk:", err);
  }
}

export function saveSessionsToDisk() {
  try {
    ensureDirExists(SESSIONS_DB_PATH);
    const data: Record<string, any> = {};
    for (const [token, session] of activeSessions.entries()) {
      data[token] = {
        email: session.email,
        expiresAt: session.expiresAt.toISOString()
      };
    }
    fs.writeFileSync(SESSIONS_DB_PATH, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.warn("[AuthMiddleware] Failed to save sessions to disk:", err);
  }
}

// Initial load
loadSessionsFromDisk();

// Helper to clean up expired sessions on request
export function cleanupExpiredSessions() {
  const now = new Date();
  let changed = false;
  for (const [token, data] of activeSessions.entries()) {
    if (data.expiresAt < now) {
      activeSessions.delete(token);
      changed = true;
    }
  }
  if (changed) {
    saveSessionsToDisk();
  }
}

export interface AuthenticatedRequest extends Request {
  userEmail?: string;
}

export function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  // Prune expired sessions
  cleanupExpiredSessions();

  // Read either custom header, Auth header or cookies
  const authHeader = req.headers["authorization"];
  let token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    // Fallback to query param or headers directly
    token = req.headers["x-session-token"] as string;
  }

  if (!token) {
    return res.status(401).json({ error: "Access token required. Please sign in." });
  }

  const session = activeSessions.get(token);
  if (!session) {
    return res.status(401).json({ error: "Invalid token or expired session. Please sign in again." });
  }

  const now = new Date();
  if (session.expiresAt < now) {
    activeSessions.delete(token);
    saveSessionsToDisk();
    return res.status(401).json({ error: "Session expired. Please sign in again." });
  }

  // Slide session window (extend expiry time by 30 mins)
  session.expiresAt = new Date(Date.now() + 30 * 60 * 1000);
  saveSessionsToDisk();
  
  req.userEmail = session.email;
  next();
}

export function requireEmailVerified(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.userEmail) {
    return res.status(401).json({ error: "Access token required. Please sign in." });
  }
  const user = UserRepository.getByEmail(req.userEmail);
  if (!user) {
    return res.status(404).json({ error: "User record no longer exists." });
  }
  if (!user.emailVerified) {
    return res.status(403).json({
      error: "EMAIL_UNVERIFIED",
      message: "Please verify your email address to access this feature."
    });
  }
  next();
}

export function revokeAllSessionsForUser(email: string) {
  const normalizedEmail = email.toLowerCase().trim();
  let changed = false;
  for (const [token, session] of activeSessions.entries()) {
    if (session.email.toLowerCase().trim() === normalizedEmail) {
      activeSessions.delete(token);
      changed = true;
    }
  }
  if (changed) {
    saveSessionsToDisk();
  }
}

