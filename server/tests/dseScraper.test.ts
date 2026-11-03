import { describe, it, expect, vi } from "vitest";
import { DSEScraper, DSE_BASE_URL, latestPriceCandidates } from "../services/dseScraper";

// Simulate a full outage of DSE's JSON live feed so the HTML fallback path is what gets exercised
vi.mock("../services/dse/dseLiveApi", async (orig) => {
  const actual: any = await orig();
  return {
    ...actual,
    fetchLivePrices: vi.fn().mockRejectedValue(new Error("simulated outage")),
    fetchLiveMarket: vi.fn().mockRejectedValue(new Error("simulated outage"))
  };
});

describe("DSE Scraper System Tests", () => {
  it("should ensure the first latestPriceCandidates entry starts with https://", () => {
    expect(latestPriceCandidates.length).toBeGreaterThan(0);
    expect(latestPriceCandidates[0]).toMatch(/^https:\/\//);
  });

  it("should ensure the default DSE_BASE_URL starts with https://", () => {
    expect(DSE_BASE_URL).toMatch(/^https:\/\//);
  });

  it("should ensure getStatus() includes the activeEndpoint field and activeEndpoint starts with https:// or http://", () => {
    const status = DSEScraper.getStatus();
    expect(status).toHaveProperty("activeEndpoint");
    expect(typeof status.activeEndpoint).toBe("string");
    expect(status.activeEndpoint).toMatch(/^https?:\/\//);
  });

  it("must NEVER yield live: true or source 'LiveScraped' when a scrape fails", async () => {
    const originalCandidates = [...latestPriceCandidates];
    // Point candidate list to unreachable local port to guarantee real network failure
    latestPriceCandidates.length = 0;
    latestPriceCandidates.push("http://127.0.0.1:54321/latest_share_price_all.php");

    try {
      const result = await DSEScraper.syncLiveDSEData(0, true);

      expect(result.success).toBe(false);
      expect(result.live).toBe(false);
      expect(result.source).not.toBe("LiveScraped");
      expect(["CachedFile", "Unavailable"]).toContain(result.source);

      const status = DSEScraper.getStatus();
      expect(status.live).toBe(false);
      expect(status.source).not.toBe("LiveScraped");
    } finally {
      latestPriceCandidates.length = 0;
      latestPriceCandidates.push(...originalCandidates);
    }
  });
});
