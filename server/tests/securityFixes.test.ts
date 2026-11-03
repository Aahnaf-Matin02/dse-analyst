import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import os from "os";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import type { Server } from "http";

// Isolated user/session stores so these tests never touch data/users_db.json
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "dse-sec-"));
process.env.USERS_DB_PATH = path.join(tmpDir, "users_db.json");
process.env.SESSIONS_DB_PATH = path.join(tmpDir, "sessions_db.json");

vi.mock("../services/passwordValidator", async (orig) => {
  const actual: any = await orig();
  return { PasswordValidator: { ...actual.PasswordValidator, isBreached: vi.fn().mockResolvedValue(false) } };
});
vi.mock("../services/mailer", () => ({ MailerService: { sendMail: vi.fn().mockResolvedValue(true) } }));

let server: Server;
let base = "";
let UserRepository: any;

async function post(p: string, body: any, headers: Record<string, string> = {}) {
  const res = await fetch(base + p, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body)
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

async function signupVerified(email: string) {
  const r = await post("/api/auth/signup", { email, name: "Test", password: "Zq8!vT3#mW9$kL2^xR" });
  UserRepository.updateUser(email, { emailVerified: true });
  return r.body.token as string;
}

beforeAll(async () => {
  ({ UserRepository } = await import("../repositories/userRepository"));
  const { createApp } = await import("../app");
  server = createApp().listen(0);
  const addr = server.address() as any;
  base = `http://127.0.0.1:${addr.port}`;
});

afterAll(() => {
  server?.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("Admin secret protection", () => {
  beforeEach(() => {
    delete process.env.ADMIN_IMPORT_SECRET;
  });

  it("refuses admin routes when ADMIN_IMPORT_SECRET is not configured, even with the old default", async () => {
    const r = await post("/api/stocks/historical/repair-financials", {}, { "x-admin-secret": "your_secret_here" });
    expect(r.status).toBe(503);
  });

  it("rejects a wrong secret and requires it on repair / refresh routes", async () => {
    process.env.ADMIN_IMPORT_SECRET = "correct-secret";
    for (const p of ["/api/stocks/historical/repair-history", "/api/stocks/historical/repair-financials", "/api/stocks/historical/refresh-coverage", "/api/history/bulk-import"]) {
      expect((await post(p, {})).status).toBe(401);
      expect((await post(p, {}, { "x-admin-secret": "wrong" })).status).toBe(401);
    }
  });
});

describe("Subscription upgrades", () => {
  it("does not grant a paid tier for an unverified transaction id", async () => {
    const email = `pay-${crypto.randomBytes(4).toString("hex")}@example.test`;
    const token = await signupVerified(email);
    const r = await post(
      "/api/revenue/subscribe",
      { tier: "institutional", paymentMethod: "bkash", transactionId: "FAKE123" },
      { Authorization: `Bearer ${token}` }
    );
    expect(r.status).toBe(402);
    expect(UserRepository.getByEmail(email).tier).toBe("free");
  });
});

describe("Email verification brute force", () => {
  it("invalidates the code after 5 wrong attempts so the real code no longer works", async () => {
    const email = `otp-${crypto.randomBytes(4).toString("hex")}@example.test`;
    await post("/api/auth/signup", { email, name: "Test", password: "Zq8!vT3#mW9$kL2^xR" });

    // Plant a known code
    const code = "123456";
    UserRepository.updateUser(email, {
      emailVerificationTokenHash: crypto.createHash("sha256").update(code).digest("hex"),
      emailVerificationTokenExpires: new Date(Date.now() + 60_000).toISOString(),
      emailVerificationAttempts: 0
    });

    for (let i = 0; i < 5; i++) {
      const r = await post("/api/auth/verify-email", { email, code: "000000" });
      expect(r.status).toBe(400);
    }
    const final = await post("/api/auth/verify-email", { email, code });
    expect(final.status).toBe(400);
    expect(UserRepository.getByEmail(email).emailVerified).toBe(false);
  });
});

describe("Unknown API routes", () => {
  it("return a JSON 404", async () => {
    const res = await fetch(base + "/api/does-not-exist");
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("API route not found");
  });
});
