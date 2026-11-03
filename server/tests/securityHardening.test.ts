import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import os from "os";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import type { Server } from "http";

// Isolated user/session stores so these tests never touch data/
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "dse-hard-"));
process.env.USERS_DB_PATH = path.join(tmpDir, "users_db.json");
process.env.SESSIONS_DB_PATH = path.join(tmpDir, "sessions_db.json");

vi.mock("../services/passwordValidator", async (orig) => {
  const actual: any = await orig();
  return { PasswordValidator: { ...actual.PasswordValidator, isBreached: vi.fn().mockResolvedValue(false) } };
});
vi.mock("../services/mailer", () => ({ MailerService: { sendMail: vi.fn().mockResolvedValue(true) } }));

const PASSWORD = "Zq8!vT3#mW9$kL2^xR";
let server: Server;
let base = "";
let UserRepository: any;
let resetAuthRateLimits: () => void;

async function post(p: string, body: any, headers: Record<string, string> = {}) {
  const res = await fetch(base + p, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) });
  return { status: res.status, headers: res.headers, body: await res.json().catch(() => null) };
}

beforeAll(async () => {
  ({ UserRepository } = await import("../repositories/userRepository"));
  ({ resetAuthRateLimits } = await import("../middleware/authRateLimiter"));
  const { createApp } = await import("../app");
  server = createApp().listen(0);
  base = `http://127.0.0.1:${(server.address() as any).port}`;
});
beforeEach(() => resetAuthRateLimits());
afterAll(() => {
  server?.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("Security headers and CORS", () => {
  it("sends hardening headers and hides the framework", async () => {
    const res = await fetch(base + "/api/revenue/plans");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("x-frame-options")).toBe("DENY");
    expect(res.headers.get("referrer-policy")).toBe("strict-origin-when-cross-origin");
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(res.headers.get("x-powered-by")).toBeNull();
  });

  it("no longer allows every origin; only CORS_ORIGINS entries get CORS headers", async () => {
    const evil = await fetch(base + "/api/revenue/plans", { headers: { Origin: "https://evil.example" } });
    expect(evil.headers.get("access-control-allow-origin")).toBeNull();

    process.env.CORS_ORIGINS = "https://app.example";
    try {
      const ok = await fetch(base + "/api/revenue/plans", { headers: { Origin: "https://app.example" } });
      expect(ok.headers.get("access-control-allow-origin")).toBe("https://app.example");
      const preflightBad = await fetch(base + "/api/auth/login", { method: "OPTIONS", headers: { Origin: "https://evil.example" } });
      expect(preflightBad.status).toBe(403);
    } finally {
      delete process.env.CORS_ORIGINS;
    }
  });
});

describe("Auth endpoint rate limiting", () => {
  it("returns 429 after 10 login attempts from one IP within 15 minutes", async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 11; i++) {
      statuses.push((await post("/api/auth/login", { email: "nobody@example.test", password: "wrong" })).status);
    }
    expect(statuses.slice(0, 10).every(s => s === 401)).toBe(true);
    expect(statuses[10]).toBe(429);
  });
});

describe("Sessions", () => {
  it("stores only token hashes on disk, and logout invalidates the token", async () => {
    const email = `sess-${crypto.randomBytes(4).toString("hex")}@example.test`;
    const signup = await post("/api/auth/signup", { email, name: "T", password: PASSWORD });
    const token: string = signup.body.token;
    expect(token).toMatch(/^[a-f0-9]{64}$/);

    const onDisk = fs.readFileSync(process.env.SESSIONS_DB_PATH!, "utf8");
    expect(onDisk).not.toContain(token);
    expect(onDisk).toContain(crypto.createHash("sha256").update(token).digest("hex"));

    const me = await fetch(base + "/api/auth/me", { headers: { Authorization: `Bearer ${token}` } });
    expect(me.status).toBe(200);
    await post("/api/auth/logout", {}, { Authorization: `Bearer ${token}` });
    const after = await fetch(base + "/api/auth/me", { headers: { Authorization: `Bearer ${token}` } });
    expect(after.status).toBe(401);
  });
});

describe("Password hashing", () => {
  it("hashes new passwords with 210,000 PBKDF2 iterations", () => {
    const email = `iter-${crypto.randomBytes(4).toString("hex")}@example.test`;
    UserRepository.createUser(email, "T", PASSWORD);
    expect(UserRepository.getByEmail(email).passwordIterations).toBe(210_000);
  });

  it("still accepts legacy 10,000-iteration hashes and upgrades them on login", async () => {
    const email = `legacy-${crypto.randomBytes(4).toString("hex")}@example.test`;
    UserRepository.createUser(email, "T", PASSWORD);
    const salt = crypto.randomBytes(16).toString("hex");
    UserRepository.updateUser(email, {
      salt,
      passwordHash: crypto.pbkdf2Sync(PASSWORD, salt, 10_000, 64, "sha512").toString("hex"),
      passwordIterations: undefined
    });

    const login = await post("/api/auth/login", { email, password: PASSWORD });
    expect(login.status).toBe(200);
    const upgraded = UserRepository.getByEmail(email);
    expect(upgraded.passwordIterations).toBe(210_000);
    expect(upgraded.salt).not.toBe(salt);
    // and the upgraded hash still works
    expect((await post("/api/auth/login", { email, password: PASSWORD })).status).toBe(200);
  });
});

describe("Billing", () => {
  it("does not grant a paid tier through a 100% coupon either", async () => {
    const email = `coupon-${crypto.randomBytes(4).toString("hex")}@example.test`;
    const token = (await post("/api/auth/signup", { email, name: "T", password: PASSWORD })).body.token;
    UserRepository.updateUser(email, { emailVerified: true });
    const r = await post("/api/revenue/subscribe",
      { tier: "institutional", paymentMethod: "bkash", transactionId: "X", couponCode: "COMPCOFOUNDER" },
      { Authorization: `Bearer ${token}` });
    expect(r.status).toBe(402);
    expect(UserRepository.getByEmail(email).tier).toBe("free");
  });

  it("enforces the advertised free-plan AI quota", async () => {
    const { PLANS } = await import("../config/plans");
    const plans = await (await fetch(base + "/api/revenue/plans")).json();
    expect(plans.plans.free.aiDailyLimit).toBe(PLANS.free.aiDailyLimit);
    const email = `quota-${crypto.randomBytes(4).toString("hex")}@example.test`;
    UserRepository.createUser(email, "T", PASSWORD);
    let allowed = 0;
    for (let i = 0; i < PLANS.free.aiDailyLimit + 3; i++) {
      if (UserRepository.checkAndIncrementAiUsage(email, PLANS.free.aiDailyLimit).allowed) allowed++;
    }
    expect(allowed).toBe(PLANS.free.aiDailyLimit);
  });
});

describe("Error handler", () => {
  it("hides internal 5xx messages in production", async () => {
    const { errorHandler } = await import("../middleware/errorHandler");
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    const res: any = { statusCode: 0, body: null, status(c: number) { this.statusCode = c; return this; }, json(b: any) { this.body = b; return this; } };
    vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      errorHandler(new Error("ENOENT: C:\\secret\\path\\users_db.json"), { originalUrl: "/api/x" } as any, res, () => {});
      expect(res.statusCode).toBe(500);
      expect(res.body.error).not.toContain("secret");
    } finally {
      process.env.NODE_ENV = prev;
    }
  });
});
