import { Request, Response, NextFunction } from "express";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { UserRepository } from "../repositories/userRepository";

const SESSIONS_DB_PATH = process.env.SESSIONS_DB_PATH || path.join(process.cwd(), "data", "sessions_db.json");

const SESSION_IDLE_MS = 30 * 60 * 1000; // sliding inactivity window
const SESSION_MAX_AGE_MS = 12 * 60 * 60 * 1000; // absolute lifetime, however active the session is
const PERSIST_THROTTLE_MS = 60 * 1000; // don't rewrite the sessions file on every request

export interface SessionData {
  email: string;
  expiresAt: Date;
  createdAt: Date;
  lastPersistedExpiry?: number;
}

/**
 * Session store keyed by SHA-256(token). Raw bearer tokens are only ever held by the client, so the
 * sessions file (or a memory dump) cannot be replayed to impersonate users.
 */
const sessions = new Map<string, SessionData>();

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

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
      const data = JSON.parse(fs.readFileSync(SESSIONS_DB_PATH, "utf-8"));
      const now = Date.now();
      if (data && typeof data === "object") {
        for (const [key, session] of Object.entries(data)) {
          const s = session as any;
          // Only SHA-256 keys are accepted; files from older versions held raw tokens and are dropped
          if (!/^[a-f0-9]{64}$/.test(key) || !s?.email || !s?.expiresAt) continue;
          const expiresAt = new Date(s.expiresAt);
          const createdAt = s.createdAt ? new Date(s.createdAt) : new Date(now);
          if (expiresAt.getTime() > now && createdAt.getTime() + SESSION_MAX_AGE_MS > now) {
            sessions.set(key, { email: s.email, expiresAt, createdAt, lastPersistedExpiry: expiresAt.getTime() });
          }
        }
      }
      console.log(`[AuthMiddleware] Loaded ${sessions.size} active sessions from disk.`);
    }
  } catch (err) {
    console.warn("[AuthMiddleware] Failed to load sessions from disk:", err);
  }
}

export function saveSessionsToDisk() {
  try {
    ensureDirExists(SESSIONS_DB_PATH);
    const data: Record<string, any> = {};
    for (const [key, session] of sessions.entries()) {
      data[key] = {
        email: session.email,
        expiresAt: session.expiresAt.toISOString(),
        createdAt: session.createdAt.toISOString()
      };
      session.lastPersistedExpiry = session.expiresAt.getTime();
    }
    fs.writeFileSync(SESSIONS_DB_PATH, JSON.stringify(data, null, 2), { encoding: "utf-8", mode: 0o600 });
  } catch (err) {
    console.warn("[AuthMiddleware] Failed to save sessions to disk:", err);
  }
}

// Initial load
loadSessionsFromDisk();

function isExpired(s: SessionData, now = Date.now()): boolean {
  return s.expiresAt.getTime() < now || s.createdAt.getTime() + SESSION_MAX_AGE_MS < now;
}

export function cleanupExpiredSessions() {
  const now = Date.now();
  let changed = false;
  for (const [key, s] of sessions.entries()) {
    if (isExpired(s, now)) {
      sessions.delete(key);
      changed = true;
    }
  }
  if (changed) saveSessionsToDisk();
}

/** Creates a session and returns the raw token for the client. Only its hash is stored. */
export function createSession(email: string): string {
  const token = crypto.randomBytes(32).toString("hex");
  const now = Date.now();
  sessions.set(hashToken(token), { email, createdAt: new Date(now), expiresAt: new Date(now + SESSION_IDLE_MS) });
  saveSessionsToDisk();
  return token;
}

/** Returns the live session for a raw token, or null. Does not extend it. */
export function getSession(token: string | undefined | null): SessionData | null {
  if (!token || typeof token !== "string") return null;
  const s = sessions.get(hashToken(token));
  if (!s) return null;
  if (isExpired(s)) {
    sessions.delete(hashToken(token));
    saveSessionsToDisk();
    return null;
  }
  return s;
}

export function deleteSession(token: string | undefined | null) {
  if (!token) return;
  if (sessions.delete(hashToken(token))) saveSessionsToDisk();
}

/** Reads the bearer token from Authorization or X-Session-Token. */
export function extractToken(req: Request): string | undefined {
  const authHeader = req.headers["authorization"];
  const bearer = typeof authHeader === "string" ? authHeader.match(/^Bearer\s+(\S+)$/i)?.[1] : undefined;
  return bearer || (req.headers["x-session-token"] as string | undefined) || undefined;
}

export interface AuthenticatedRequest extends Request {
  userEmail?: string;
}

export function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  cleanupExpiredSessions();

  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({ error: "Access token required. Please sign in." });
  }

  const session = getSession(token);
  if (!session) {
    return res.status(401).json({ error: "Invalid token or expired session. Please sign in again." });
  }

  // Slide the inactivity window, persisting at most once a minute per session
  session.expiresAt = new Date(Date.now() + SESSION_IDLE_MS);
  if (session.expiresAt.getTime() - (session.lastPersistedExpiry || 0) > PERSIST_THROTTLE_MS) {
    saveSessionsToDisk();
  }

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
  for (const [key, session] of sessions.entries()) {
    if (session.email.toLowerCase().trim() === normalizedEmail) {
      sessions.delete(key);
      changed = true;
    }
  }
  if (changed) saveSessionsToDisk();
}
