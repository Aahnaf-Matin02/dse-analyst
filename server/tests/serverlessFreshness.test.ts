import { describe, it, expect, vi, beforeEach } from "vitest";

const status = vi.hoisted(() => ({ lastSuccessfulSync: null as string | null }));
vi.mock("../repositories/dseCacheRepository", () => ({ loadDseSyncStatus: () => status }));

const NOW = Date.parse("2026-11-03T05:00:00Z");
let mod: typeof import("../services/serverlessFreshness");

beforeEach(async () => {
  vi.resetModules(); // fresh in-flight / last-attempt state per test
  mod = await import("../services/serverlessFreshness");
});

describe("serverless DSE freshness", () => {
  it("does not scrape while the instance's data is fresh", async () => {
    status.lastSuccessfulSync = new Date(NOW - 60_000).toISOString();
    const sync = vi.fn(async () => {});
    await mod.ensureFreshDseData(NOW, sync);
    expect(sync).not.toHaveBeenCalled();
  });

  it("scrapes once for concurrent requests when the bundled snapshot is stale", async () => {
    status.lastSuccessfulSync = "2026-09-29T10:30:00.000Z";
    const sync = vi.fn(async () => {});
    await Promise.all([mod.ensureFreshDseData(NOW, sync), mod.ensureFreshDseData(NOW, sync)]);
    expect(sync).toHaveBeenCalledTimes(1);
  });

  it("retries a failed scrape at most once a minute", async () => {
    status.lastSuccessfulSync = null;
    const sync = vi.fn(async () => { throw new Error("DSE down"); });
    await mod.ensureFreshDseData(NOW, sync);
    await mod.ensureFreshDseData(NOW + 30_000, sync);
    expect(sync).toHaveBeenCalledTimes(1);
    await mod.ensureFreshDseData(NOW + mod.RETRY_MS + 1, sync);
    expect(sync).toHaveBeenCalledTimes(2);
  });
});
