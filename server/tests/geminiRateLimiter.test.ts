import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createApp } from "../app";
import { resetAnonymousQuotas, MAX_ANON_PER_HOUR } from "../middleware/geminiRateLimiter";

describe("Gemini Anonymous IP Rate Limiter", () => {
  beforeEach(() => {
    resetAnonymousQuotas();
  });

  afterEach(() => {
    resetAnonymousQuotas();
  });

  it("permits up to 5 requests per hour for anonymous visitors and blocks the 6th with HTTP 429", async () => {
    const app = createApp();
    const server = app.listen(0);
    const port = (server.address() as any).port;

    try {
      const clientIp = "192.168.1.100";

      // 5 allowed requests
      for (let i = 1; i <= MAX_ANON_PER_HOUR; i++) {
        const res = await fetch(`http://127.0.0.1:${port}/api/gemini/analyze`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Forwarded-For": clientIp
          },
          body: JSON.stringify({ symbol: "GP" })
        });
        // Can be 200 or 503/400 (if no API key / bad payload), but NOT 429
        expect(res.status).not.toBe(429);
      }

      // 6th request from same IP must be rejected with 429
      const blockedRes = await fetch(`http://127.0.0.1:${port}/api/gemini/analyze`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Forwarded-For": clientIp
        },
        body: JSON.stringify({ symbol: "GP" })
      });

      expect(blockedRes.status).toBe(429);
      const data = await blockedRes.json();
      expect(data.error).toBe("ANONYMOUS_RATE_LIMIT_EXCEEDED");
      expect(data.message).toContain("maximum 5 requests per hour");
      expect(blockedRes.headers.get("retry-after")).toBeDefined();

      // Different IP is still allowed
      const otherIpRes = await fetch(`http://127.0.0.1:${port}/api/gemini/analyze`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Forwarded-For": "192.168.1.200"
        },
        body: JSON.stringify({ symbol: "GP" })
      });
      expect(otherIpRes.status).not.toBe(429);
    } finally {
      server.close();
    }
  });

  it("does not rate-limit the informational status endpoint", async () => {
    const app = createApp();
    const server = app.listen(0);
    const port = (server.address() as any).port;

    try {
      for (let i = 0; i < 8; i++) {
        const res = await fetch(`http://127.0.0.1:${port}/api/gemini/status`, {
          headers: { "X-Forwarded-For": "10.0.0.50" }
        });
        expect(res.status).toBe(200);
      }
    } finally {
      server.close();
    }
  });
});
