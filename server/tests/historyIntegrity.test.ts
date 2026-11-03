import { describe, it, expect, vi } from "vitest";

// These tests assert behaviour when DSE is unreachable, so the live source must fail deterministically
// instead of reaching the real old.dsebd.org (which would also overwrite the bundled data files).
vi.mock("../services/dse/dseLegacyLive", async (orig) => {
  const actual: any = await orig();
  return {
    ...actual,
    fetchLegacyPrices: vi.fn().mockRejectedValue(new Error("simulated outage")),
    fetchLegacyMarket: vi.fn().mockRejectedValue(new Error("simulated outage"))
  };
});
import fs from "fs";
import path from "path";

describe("Historical Data Integrity & Startup Purity", () => {
  const historyDir = path.join(process.cwd(), "data", "history");
  const stocksDir = path.join(historyDir, "stocks");

  it("fails if any history CSV contains a generated label or HistoricalArchive", () => {
    if (!fs.existsSync(stocksDir)) {
      return;
    }
    const files = fs.readdirSync(stocksDir).filter(f => f.endsWith(".csv"));
    const forbiddenLabels = ["historicalarchive", "generated", "synthetic", "simulation", "simulated", "randomwalk"];

    const offendingFiles: { file: string; line: string }[] = [];

    for (const f of files) {
      const filePath = path.join(stocksDir, f);
      const content = fs.readFileSync(filePath, "utf-8");
      const lines = content.split("\n");

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const lower = line.toLowerCase();
        for (const forbidden of forbiddenLabels) {
          if (lower.includes(forbidden)) {
            offendingFiles.push({ file: f, line: line.slice(0, 100) });
            break;
          }
        }
      }
    }

    expect(
      offendingFiles,
      `Found ${offendingFiles.length} files with generated or synthetic labels: ${JSON.stringify(offendingFiles.slice(0, 5))}`
    ).toHaveLength(0);
  });

  it("fails if starting/instantiating the server creates or modifies files in data/history", async () => {
    // Snapshot existing files and mtimes in data/history
    function getFileSnapshot(dir: string): Map<string, number> {
      const map = new Map<string, number>();
      if (!fs.existsSync(dir)) return map;
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const ent of entries) {
        const full = path.join(dir, ent.name);
        if (ent.isDirectory()) {
          const sub = getFileSnapshot(full);
          for (const [k, v] of sub.entries()) {
            map.set(k, v);
          }
        } else {
          map.set(full, fs.statSync(full).mtimeMs);
        }
      }
      return map;
    }

    const beforeSnapshot = getFileSnapshot(historyDir);

    // Import createApp and instantiate
    const { createApp } = await import("../app");
    const app = createApp();
    expect(app).toBeDefined();

    // Check that data/history has not been altered
    const afterSnapshot = getFileSnapshot(historyDir);

    const createdFiles: string[] = [];
    const modifiedFiles: string[] = [];

    for (const [file, mtime] of afterSnapshot.entries()) {
      if (!beforeSnapshot.has(file)) {
        createdFiles.push(file);
      } else if (Math.abs(beforeSnapshot.get(file)! - mtime) > 10) {
        modifiedFiles.push(file);
      }
    }

    expect(createdFiles, `Server instantiation created files in data/history: ${createdFiles.join(", ")}`).toHaveLength(0);
    expect(modifiedFiles, `Server instantiation modified files in data/history: ${modifiedFiles.join(", ")}`).toHaveLength(0);
  });

  it("fails if any history file lacks the standard header or has an invalid source label", () => {
    if (!fs.existsSync(stocksDir)) return;
    const files = fs.readdirSync(stocksDir).filter(f => f.endsWith(".csv"));
    if (files.length === 0) return; // no history loaded yet is allowed; it stays missing

    const standardHeader = "date,open,high,low,close,volume,source";
    const allowedSources = new Set(["DSE_OFFICIAL", "LankaBD", "InvestingCSV"]);

    const nonStandardFiles: { file: string; issue: string }[] = [];

    for (const f of files) {
      const filePath = path.join(stocksDir, f);
      const content = fs.readFileSync(filePath, "utf-8").trim();
      const lines = content.split("\n");

      if (lines.length < 2) {
        nonStandardFiles.push({ file: f, issue: "File is empty or header-only" });
        continue;
      }

      const header = lines[0].trim();
      if (header !== standardHeader) {
        nonStandardFiles.push({ file: f, issue: `Invalid header: "${header}" (expected "${standardHeader}")` });
        continue;
      }

      // Check first and last row
      // Every row must carry a real source label (no generated/adjusted/gap-filled rows)
      const bad = lines.slice(1).map((l, i) => ({ row: i + 2, source: l.trim().split(",")[6]?.trim() })).find(r => !allowedSources.has(r.source));
      if (bad) nonStandardFiles.push({ file: f, issue: `Invalid source label "${bad.source}" on line ${bad.row}` });
    }

    expect(
      nonStandardFiles,
      `Found non-standard history files: ${JSON.stringify(nonStandardFiles.slice(0, 5))}`
    ).toHaveLength(0);
  });

  it("verifies lastSuccessfulSync only changes when a scrape actually succeeds", async () => {
    const { DSEScraper, latestPriceCandidates } = await import("../services/dseScraper");
    const originalCandidates = [...latestPriceCandidates];
    latestPriceCandidates.length = 0;
    latestPriceCandidates.push("http://127.0.0.1:54321/latest_share_price_all.php");
    const { loadDseSyncStatus, saveDseSyncStatus } = await import("../repositories/dseCacheRepository");

    const previousFixedTimestamp = "2026-09-29T10:30:00.000Z";
    saveDseSyncStatus({
      status: "Cached",
      source: "CachedFile",
      live: false,
      lastSuccessfulSync: previousFixedTimestamp,
      lastAttemptTime: previousFixedTimestamp,
      parsedSymbols: 0,
      cachedSymbols: 634
    });

    // 1. Calling getStatus without new successful scrape MUST preserve previous timestamp
    const statusBefore = DSEScraper.getStatus();
    expect(statusBefore.lastSuccessfulSync).toBe(previousFixedTimestamp);

    // 2. Calling syncLiveDSEData when cache is fresh MUST NOT update lastSuccessfulSync
    const syncRes = await DSEScraper.syncLiveDSEData(1, false);
    const statusAfter = DSEScraper.getStatus();
    expect(statusAfter.lastSuccessfulSync).toBe(previousFixedTimestamp);
    latestPriceCandidates.length = 0;
    latestPriceCandidates.push(...originalCandidates);
  });
});
