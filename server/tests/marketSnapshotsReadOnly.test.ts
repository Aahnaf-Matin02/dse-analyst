import { describe, it, expect, vi, afterEach } from "vitest";
import fs from "fs";
import { DseMarketDataManager } from "../services/dse/dseMarketData";

afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

describe("market snapshots on a read-only bundle (Netlify)", () => {
  it("keeps live prices in memory when the snapshot file cannot be written", () => {
    // Simulate the read-only function bundle: every write fails, nothing on disk changes
    vi.spyOn(fs, "writeFileSync").mockImplementation(() => { throw Object.assign(new Error("EROFS"), { code: "EROFS" }); });
    vi.spyOn(fs, "renameSync").mockImplementation(() => { throw new Error("EROFS"); });
    vi.spyOn(console, "error").mockImplementation(() => {});

    DseMarketDataManager.updateFromPriceRows([{ code: "GP", ltp: 231.2, ycp: 229, high: 232, low: 229, volume: 3241, trades: 95, value: 0.75, percent: 0.96 }], "https://old.dsebd.org/latest_share_price_scroll_l.php");
    vi.useFakeTimers({ now: Date.now() + 5 * 60 * 1000 }); // well past the old 30 s reload window

    const gp = DseMarketDataManager.getLatestSnapshot("GP");
    expect(gp?.lastPrice).toBe(231.2);
    expect(gp?.previousClose).toBe(229);
    expect(gp?.open).toBeNull(); // no opening price in the feed and none from today: not a stale one
  });
});
