import fs from "fs";
import path from "path";
import crypto from "crypto";

function resolveUsersDbPath(): string {
  const envPath = process.env.USERS_DB_PATH;
  if (envPath && !envPath.includes("path to your") && !envPath.includes("<") && envPath.endsWith(".json")) {
    return path.isAbsolute(envPath) ? envPath : path.join(process.cwd(), envPath);
  }
  return path.join(process.cwd(), "data", "users_db.json");
}

const USERS_DB_PATH = resolveUsersDbPath();

export interface UserRecord {
  email: string;
  name: string;
  passwordHash: string;
  salt: string;
  passwordIterations?: number; // PBKDF2 iterations used for passwordHash (absent = legacy 10,000)
  watchlist: string[];
  tier?: "free" | "premium" | "professional" | "institutional";
  subscriptionStatus?: "active" | "inactive" | "trial";
  subscriptionExpiresAt?: string;
  aiUsageCount?: number;
  aiUsageDate?: string;
  emailVerified: boolean;
  emailVerificationTokenHash?: string | null;
  emailVerificationTokenExpires?: string | null;
  emailVerificationAttempts?: number;
  passwordResetTokenHash?: string | null;
  passwordResetTokenExpires?: string | null;
  loginAttempts?: number;
  lockoutUntil?: string | null;
  investingStyle?: string;
  riskTolerance?: string;
}

export interface DatabaseSchema {
  users: Record<string, UserRecord>;
}

// In-memory shadow copy of user database as fallback
let memoryDb: DatabaseSchema = { users: {} };

function ensureDb() {
  try {
    const dir = path.dirname(USERS_DB_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    if (!fs.existsSync(USERS_DB_PATH)) {
      fs.writeFileSync(USERS_DB_PATH, JSON.stringify({ users: {} }, null, 2), "utf-8");
    }
  } catch (err) {
    // Fail silently, memoryDb will act as fallback
  }
}

function loadDb(): DatabaseSchema {
  try {
    ensureDb();
    if (fs.existsSync(USERS_DB_PATH)) {
      const data = fs.readFileSync(USERS_DB_PATH, "utf-8");
      const parsed = JSON.parse(data);
      if (parsed && parsed.users) {
        memoryDb = parsed;
        return memoryDb;
      }
    }
  } catch (err) {
    console.warn("[UserRepository] Failed to load user database from disk, using safe in-memory cache:", err);
  }
  return memoryDb;
}

function saveDb(db: DatabaseSchema) {
  memoryDb = db;
  try {
    ensureDb();
    fs.writeFileSync(USERS_DB_PATH, JSON.stringify(db, null, 2), "utf-8");
  } catch (err) {
    console.warn("[UserRepository] Failed to save user database to disk (this is expected under serverless environment):", err);
  }
}

// OWASP (2023) guidance for PBKDF2-HMAC-SHA512. Accounts created before this change used 10,000
// iterations; they are verified with their stored count and transparently re-hashed on next login.
export const PBKDF2_ITERATIONS = 210_000;
const LEGACY_PBKDF2_ITERATIONS = 10_000;

export function hashPassword(password: string, salt?: string, iterations: number = PBKDF2_ITERATIONS) {
  const userSalt = salt || crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(password, userSalt, iterations, 64, "sha512").toString("hex");
  return { salt: userSalt, hash, iterations };
}

// Async variant for request handlers so a login does not block the event loop for every other user
function hashPasswordAsync(password: string, salt: string, iterations: number): Promise<string> {
  return new Promise((resolve, reject) =>
    crypto.pbkdf2(password, salt, iterations, 64, "sha512", (err, key) => (err ? reject(err) : resolve(key.toString("hex"))))
  );
}

export const UserRepository = {
  getByEmail(email: string): UserRecord | null {
    const db = loadDb();
    const normalizedEmail = email.toLowerCase().trim();
    return db.users[normalizedEmail] || null;
  },

  createUser(email: string, name: string, passwordPlain: string): Omit<UserRecord, "passwordHash" | "salt"> {
    const db = loadDb();
    const normalizedEmail = email.toLowerCase().trim();

    if (db.users[normalizedEmail]) {
      throw new Error("User with this email already exists");
    }

    const { salt, hash, iterations } = hashPassword(passwordPlain);
    const newUser: UserRecord = {
      email: normalizedEmail,
      name: name.trim(),
      passwordHash: hash,
      salt,
      passwordIterations: iterations,
      watchlist: ["GP", "SQURPHARMA"], // default seed
      tier: "free",
      subscriptionStatus: "active",
      subscriptionExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year free tier duration
      aiUsageCount: 0,
      aiUsageDate: new Date().toISOString().split("T")[0],
      emailVerified: false,
      emailVerificationTokenHash: null,
      emailVerificationTokenExpires: null,
      passwordResetTokenHash: null,
      passwordResetTokenExpires: null,
      loginAttempts: 0,
      lockoutUntil: null
    };

    db.users[normalizedEmail] = newUser;
    saveDb(db);
    return {
      email: newUser.email,
      name: newUser.name,
      watchlist: newUser.watchlist,
      tier: newUser.tier,
      subscriptionStatus: newUser.subscriptionStatus,
      subscriptionExpiresAt: newUser.subscriptionExpiresAt,
      emailVerified: newUser.emailVerified
    } as any;
  },

  updateUser(email: string, updates: Partial<UserRecord>): boolean {
    const db = loadDb();
    const normalizedEmail = email.toLowerCase().trim();
    const user = db.users[normalizedEmail];
    if (!user) return false;

    db.users[normalizedEmail] = {
      ...user,
      ...updates
    };
    saveDb(db);
    return true;
  },

  incrementFailedLogin(email: string): { locked: boolean; lockoutUntil?: string } {
    const db = loadDb();
    const normalizedEmail = email.toLowerCase().trim();
    const user = db.users[normalizedEmail];
    if (!user) return { locked: false };

    const currentAttempts = (user.loginAttempts || 0) + 1;
    user.loginAttempts = currentAttempts;

    let locked = false;
    let lockoutUntilStr: string | undefined;

    if (currentAttempts >= 5) {
      const lockoutTime = new Date(Date.now() + 15 * 60 * 1000); // 15 mins lock
      lockoutUntilStr = lockoutTime.toISOString();
      user.lockoutUntil = lockoutUntilStr;
      locked = true;
    }

    db.users[normalizedEmail] = user;
    saveDb(db);

    return { locked, lockoutUntil: lockoutUntilStr };
  },

  resetFailedLogin(email: string): void {
    const db = loadDb();
    const normalizedEmail = email.toLowerCase().trim();
    const user = db.users[normalizedEmail];
    if (!user) return;

    user.loginAttempts = 0;
    user.lockoutUntil = null;

    db.users[normalizedEmail] = user;
    saveDb(db);
  },

  async verifyPassword(email: string, passwordPlain: string): Promise<{ email: string; name: string } | null> {
    const user = this.getByEmail(email);
    if (!user) {
      // Spend comparable time for unknown accounts so response timing does not reveal which emails exist
      await hashPasswordAsync(passwordPlain, "0".repeat(32), PBKDF2_ITERATIONS);
      return null;
    }

    const iterations = user.passwordIterations || LEGACY_PBKDF2_ITERATIONS;
    const hash = await hashPasswordAsync(passwordPlain, user.salt, iterations);
    const expected = Buffer.from(user.passwordHash || "", "hex");
    const actual = Buffer.from(hash, "hex");
    if (!(expected.length === actual.length && crypto.timingSafeEqual(expected, actual))) {
      return null;
    }

    // Upgrade legacy hashes now that we briefly hold the correct plaintext
    if (iterations < PBKDF2_ITERATIONS) {
      const salt = crypto.randomBytes(16).toString("hex");
      const upgraded = await hashPasswordAsync(passwordPlain, salt, PBKDF2_ITERATIONS);
      this.updateUser(user.email, { passwordHash: upgraded, salt, passwordIterations: PBKDF2_ITERATIONS });
    }
    return { email: user.email, name: user.name };
  },

  updateUserSubscription(email: string, tier: "free" | "premium" | "professional" | "institutional", status: "active" | "inactive" | "trial", expiresAt: string): boolean {
    const db = loadDb();
    const normalizedEmail = email.toLowerCase().trim();
    const user = db.users[normalizedEmail];
    if (!user) return false;

    user.tier = tier;
    user.subscriptionStatus = status;
    user.subscriptionExpiresAt = expiresAt;

    db.users[normalizedEmail] = user;
    saveDb(db);
    return true;
  },

  checkAndIncrementAiUsage(email: string, limit: number): { allowed: boolean; count: number; limit: number } {
    const db = loadDb();
    const normalizedEmail = email.toLowerCase().trim();
    const user = db.users[normalizedEmail];
    if (!user) {
      return { allowed: false, count: 0, limit };
    }

    const todayStr = new Date().toISOString().split("T")[0];
    
    // Reset counter if day has shifted
    if (!user.aiUsageDate || user.aiUsageDate !== todayStr) {
      user.aiUsageDate = todayStr;
      user.aiUsageCount = 0;
    }

    const currentCount = user.aiUsageCount || 0;
    if (currentCount >= limit) {
      return { allowed: false, count: currentCount, limit };
    }

    user.aiUsageCount = currentCount + 1;
    db.users[normalizedEmail] = user;
    saveDb(db);

    return { allowed: true, count: user.aiUsageCount, limit };
  }
};
