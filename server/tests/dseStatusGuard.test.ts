import { describe, it, expect, vi, afterEach } from "vitest";
import { createApp } from "../app";
import { DseUniverseManager } from "../services/dse/dseUniverse";
import { DseMarketDataManager } from "../services/dse/dseMarketData";
import { DseDisclosuresManager } from "../services/dse/dseDisclosures";
import { DseCorporateActionsManager } from "../services/dse/dseCorporateActions";
import { DseFinancialsManager } from "../services/dse/dseFinancials";
import { HistoryRepository } from "../repositories/historyRepository";
import * as dseCacheRepo from "../repositories/dseCacheRepository";
import { getLastTradingSessionCutoff } from "../services/dse/dseMarketData";
import { defaultDseSyncService } from "../services/dse/dseSyncService";
import { DSEScraper } from "../services/dseScraper";

// The status route reads history coverage from data/history/processed/coverage-summary.json.
// Tests that simulate empty stores switch it to the "no summary yet" report.
const coverage = vi.hoisted(() => ({ empty: false }));
vi.mock("../services/history/historyCoverage", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../services/history/historyCoverage")>();
  return {
    ...actual,
    getHistoryCoverageReport: (baseDir?: string) =>
      actual.getHistoryCoverageReport(coverage.empty ? "__no_history_dir__" : baseDir),
  };
});

describe("DSE Status Integrity Guard", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    coverage.empty = false;
  });

  it("must NEVER return live: true or status 'Live' when universeCount is 0", async () => {
    vi.spyOn(DseUniverseManager, "getCount").mockReturnValue(0);
    vi.spyOn(DseMarketDataManager, "getSnapshotCount").mockReturnValue(634);

    const app = createApp();
    const server = app.listen(0);
    const port = (server.address() as any).port;

    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/dse/status`);
      expect(res.status).toBe(200);
      const data = await res.json();

      expect(data.universeCount).toBe(0);
      expect(data.live).toBe(false);
      expect(data.status).not.toBe("Live");
      expect(data.connected).toBe(false);
      expect(data.source).not.toBe("LiveScraped");
    } finally {
      server.close();
    }
  });

  it("must NEVER return live: true or status 'Live' when marketCount is 0", async () => {
    vi.spyOn(DseUniverseManager, "getCount").mockReturnValue(643);
    vi.spyOn(DseMarketDataManager, "getSnapshotCount").mockReturnValue(0);

    const app = createApp();
    const server = app.listen(0);
    const port = (server.address() as any).port;

    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/dse/status`);
      expect(res.status).toBe(200);
      const data = await res.json();

      expect(data.marketDataCount).toBe(0);
      expect(data.live).toBe(false);
      expect(data.status).not.toBe("Live");
      expect(data.connected).toBe(false);
      expect(data.source).not.toBe("LiveScraped");
    } finally {
      server.close();
    }
  });

  it("returns nulls and zeros rather than invented numbers when stores are empty", async () => {
    vi.spyOn(DseUniverseManager, "getCount").mockReturnValue(0);
    vi.spyOn(DseUniverseManager, "getAllSymbols").mockReturnValue([]);
    vi.spyOn(DseMarketDataManager, "getSnapshotCount").mockReturnValue(0);
    vi.spyOn(DseDisclosuresManager, "getTotalCount").mockReturnValue(null);
    vi.spyOn(DseCorporateActionsManager, "getTotalCount").mockReturnValue(null);
    vi.spyOn(DseFinancialsManager, "getPopulatedCount").mockReturnValue(null);
    vi.spyOn(HistoryRepository, "computeCoverage").mockReturnValue(0);
    coverage.empty = true;

    const app = createApp();
    const server = app.listen(0);
    const port = (server.address() as any).port;

    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/dse/status`);
      expect(res.status).toBe(200);
      const data = await res.json();

      expect(data.universeCount).toBe(0);
      expect(data.marketDataCount).toBe(0);
      expect(data.financialDataCount).toBeNull();
      expect(data.disclosureCount).toBeNull();
      expect(data.corporateActionCount).toBeNull();
      expect(data.historicalDataCoverage).toBe(0);
      expect(data.live).toBe(false);
      expect(data.status).toBe("Seeded");
      expect(data.source).toBe("DefaultSeed");
    } finally {
      server.close();
    }
  });

  it("reflects old timestamps in staleRecords count accurately", async () => {
    // Mock 42 snapshots being older than the trading session threshold
    vi.spyOn(DseMarketDataManager, "getStaleSnapshotCount").mockReturnValue(42);

    const app = createApp();
    const server = app.listen(0);
    const port = (server.address() as any).port;

    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/dse/status`);
      expect(res.status).toBe(200);
      const data = await res.json();

      expect(data.staleRecords).toBe(42);
    } finally {
      server.close();
    }
  });

  it("drops dataQualityScore when components are missing or outdated and returns audit breakdown", async () => {
    // Scenario A: Stale sync (> 3 days old) and low universe count
    vi.spyOn(DseUniverseManager, "getCount").mockReturnValue(100);
    vi.spyOn(DseMarketDataManager, "getSnapshotCount").mockReturnValue(100);
    vi.spyOn(DseMarketDataManager, "getValidMetricsCount").mockReturnValue(50);
    vi.spyOn(dseCacheRepo, "loadDseSyncStatus").mockReturnValue({
      status: "Success",
      source: "DSE_OFFICIAL",
      lastSuccessfulSync: new Date(Date.now() - 4 * 24 * 3600 * 1000).toISOString(), // 4 days ago
      lastAttemptTime: new Date(Date.now() - 4 * 24 * 3600 * 1000).toISOString()
    });

    const app = createApp();
    const server = app.listen(0);
    const port = (server.address() as any).port;

    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/dse/status`);
      expect(res.status).toBe(200);
      const data = await res.json();

      expect(data).toHaveProperty("dataQualityBreakdown");
      expect(data.dataQualityBreakdown).toHaveProperty("historicalCoverage");
      expect(data.dataQualityBreakdown.syncFreshness).toBe(4); // dropped to 4 for >48h
      expect(data.dataQualityBreakdown.universeCoverage).toBeLessThan(10); // 100 / 650 * 20 ≈ 3.1
      expect(data.dataQualityScore).toBeLessThan(50); // overall score dropped
    } finally {
      server.close();
    }
  });

  it("computes live: true, status 'Live', and full auditable metrics strictly when real data is present", async () => {
    vi.spyOn(dseCacheRepo, "loadDseSyncStatus").mockReturnValue({
      status: "Success",
      source: "LiveScraped",
      lastSuccessfulSync: new Date().toISOString(),
      lastAttemptTime: new Date().toISOString(),
      parsedSymbols: 643,
      message: "Sync completed successfully"
    });

    const realUniverseCount = DseUniverseManager.getCount();
    const realMarketCount = DseMarketDataManager.getSnapshotCount();

    expect(realUniverseCount).toBeGreaterThan(600);
    expect(realMarketCount).toBeGreaterThan(0);

    const app = createApp();
    const server = app.listen(0);
    const port = (server.address() as any).port;

    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/dse/status`);
      expect(res.status).toBe(200);
      const data = await res.json();

      expect(data.universeCount).toBe(realUniverseCount);
      expect(data.marketDataCount).toBe(realMarketCount);
      expect(data.sourceStatus).toBe("DSE_OFFICIAL");
      expect(data.source).toBe("LiveScraped");
      expect(data.live).toBe(true);
      expect(data.status).toBe("Live");
      expect(data.connected).toBe(true);
      expect(typeof data.historicalDataCoverage).toBe("number");
      expect(data.dataQualityBreakdown).toBeDefined();
      expect(data.dataQualityBreakdown).toHaveProperty("historicalCoverage");
      expect(data.dataQualityBreakdown.universeCoverage).toBeGreaterThan(15);
      expect(data.dataQualityBreakdown.validTradingMetrics).toBeGreaterThan(15);
      expect(data.dataQualityBreakdown.historicalCoverage).toBeGreaterThan(0);
    } finally {
      server.close();
    }
  });

  it("protects POST /api/dse/sync requiring SYNC_SECRET and returns 401 when unauthorized", async () => {
    process.env.SYNC_SECRET = "production-guard-secret-xyz";
    // This test is about authorization only; keep the authorized request off the real network
    const companySpy = vi.spyOn(defaultDseSyncService, "syncCompany").mockResolvedValue(true);
    const scraperSpy = vi.spyOn(DSEScraper, "syncLiveDSEData").mockResolvedValue({
      success: false, live: false, source: "CachedFile", message: "stubbed", parsedSymbols: 0
    });

    const app = createApp();
    const server = app.listen(0);
    const port = (server.address() as any).port;

    try {
      // 1. Without header -> 401
      const resNoSecret = await fetch(`http://127.0.0.1:${port}/api/dse/sync`, {
        method: "POST"
      });
      expect(resNoSecret.status).toBe(401);

      // 2. With wrong secret -> 401
      const resWrongSecret = await fetch(`http://127.0.0.1:${port}/api/dse/sync`, {
        method: "POST",
        headers: { "X-Sync-Secret": "wrong-secret" }
      });
      expect(resWrongSecret.status).toBe(401);

      // 3. With correct secret -> allowed (200)
      const resValid = await fetch(`http://127.0.0.1:${port}/api/dse/sync?type=company&symbol=GP`, {
        method: "POST",
        headers: { "X-Sync-Secret": "production-guard-secret-xyz" }
      });
      expect(resValid.status).not.toBe(401);
      expect(companySpy).toHaveBeenCalledWith("GP");
    } finally {
      companySpy.mockRestore();
      scraperSpy.mockRestore();
      delete process.env.SYNC_SECRET;
      server.close();
    }
  });

  it("calculates session cutoff relative to DSE Sunday-Thursday trading calendar without flagging weekends", () => {
    // Test on Friday (e.g. 2026-10-02 14:00 UTC = Friday 20:00 Dhaka)
    // DSE last trading session was Thursday 2026-10-01.
    const fridayDate = new Date("2026-10-02T14:00:00.000Z");
    const cutoffFriday = getLastTradingSessionCutoff(fridayDate);

    // Thursday evening timestamp (2026-10-01 16:00 UTC = 22:00 Dhaka)
    const thursdayEveningSnapshot = new Date("2026-10-01T16:00:00.000Z").getTime();
    expect(thursdayEveningSnapshot).toBeGreaterThanOrEqual(cutoffFriday);

    // Test on Saturday (e.g. 2026-10-03 10:00 UTC = Saturday 16:00 Dhaka)
    const saturdayDate = new Date("2026-10-03T10:00:00.000Z");
    const cutoffSaturday = getLastTradingSessionCutoff(saturdayDate);
    expect(thursdayEveningSnapshot).toBeGreaterThanOrEqual(cutoffSaturday);

    // An old snapshot from Wednesday before Thursday session should be before cutoff
    const oldWednesdaySnapshot = new Date("2026-09-30T10:00:00.000Z").getTime();
    expect(oldWednesdaySnapshot).toBeLessThan(cutoffFriday);
  });
});
