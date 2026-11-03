import { describe, it, expect, beforeEach, afterEach } from "vitest";
import os from "os";
import fs from "fs";
import path from "path";
import { DseStorageManager } from "../services/storage/dseStorage";
import { DseSecurity } from "../services/dse/dseUniverse";
import { DseMarketSnapshot } from "../services/dse/dseMarketData";

describe("DSE Storage Interface & Cold-Start Resolution Hierarchy", () => {
  let storage: DseStorageManager;
  let testStorageDir: string;

  beforeEach(() => {
    testStorageDir = path.join(os.tmpdir(), `dse-test-storage-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`);
    fs.mkdirSync(testStorageDir, { recursive: true });
    storage = new DseStorageManager({ customStorageDir: testStorageDir });
  });

  afterEach(() => {
    try {
      if (fs.existsSync(testStorageDir)) {
        fs.rmSync(testStorageDir, { recursive: true, force: true });
      }
    } catch {}
  });

  it("writes and reads back security master through storage interface", async () => {
    const mockSecurities: DseSecurity[] = [
      {
        id: "TESTSTOCK",
        symbol: "TESTSTOCK",
        companyName: "Test Stock PLC",
        instrumentType: "Equity",
        securityType: "Public",
        sector: "Bank",
        category: "A",
        board: "PUBLIC",
        status: "Active",
        faceValue: 10,
        authorizedCapital: null,
        paidUpCapital: null,
        totalSecurities: null,
        marketLot: 1,
        source: "DSE_OFFICIAL",
        sourceUrl: "https://www.dse.com.bd/company/TESTSTOCK",
        sourceRetrievedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];

    await storage.saveSecurityMaster(mockSecurities);
    const result = await storage.loadSecurityMaster();

    expect(result.data).toBeDefined();
    expect(result.data!.length).toBe(1);
    expect(result.data![0].symbol).toBe("TESTSTOCK");
    expect(result.tier).toBe("BUNDLED_FILE");
  });

  it("writes and reads back market snapshots through storage interface", async () => {
    const mockSnapshots: DseMarketSnapshot[] = [
      {
        symbol: "TESTSTOCK",
        tradingDate: "2026-10-01",
        lastPrice: 50.5,
        open: 50.0,
        high: 51.0,
        low: 49.5,
        previousClose: 50.0,
        change: 0.5,
        changePercent: 1.0,
        volume: 10000,
        trades: 150,
        turnover: null,
        marketCap: 500000000,
        freeFloatMarketCap: null,
        source: "DSE_OFFICIAL",
        sourceUrl: "https://www.dse.com.bd/company/TESTSTOCK",
        retrievedAt: new Date().toISOString()
      }
    ];

    await storage.saveMarketSnapshots(mockSnapshots);
    const result = await storage.loadMarketSnapshots();

    expect(result.data).toBeDefined();
    expect(result.data!.length).toBe(1);
    expect(result.data![0].symbol).toBe("TESTSTOCK");
    expect(result.tier).toBe("BUNDLED_FILE");
  });

  it("respects cold-start resolution order: durable store -> bundled file -> fallback seed", async () => {
    // 1. When simulated durable store (blobs/cloud) has data, it must take priority (Tier 1)
    const mockBlobsStore = {
      get: async (key: string) => {
        if (key === "security-master") {
          return [{ symbol: "DURABLE_SYM", companyName: "Durable PLC" }];
        }
        return null;
      },
      setJSON: async () => {}
    };

    (storage as any).blobsStore = mockBlobsStore;
    const durableResult = await storage.loadSecurityMaster();
    expect(durableResult.tier).toBe("DURABLE_STORE");
    expect(durableResult.source).toContain("NetlifyBlobs");
    expect(durableResult.data![0].symbol).toBe("DURABLE_SYM");
    expect(storage.getUniverseTier()).toBe("DURABLE_STORE");

    // 2. When durable store has no data, fall back to bundled files (Tier 2)
    (storage as any).blobsStore = {
      get: async () => null,
      setJSON: async () => {}
    };
    // Seed a file into testStorageDir
    fs.writeFileSync(
      path.join(testStorageDir, "security-master.json"),
      JSON.stringify([{ symbol: "BUNDLED_SYM", companyName: "Bundled PLC" }]),
      "utf-8"
    );
    const bundledResult = await storage.loadSecurityMaster();
    expect(bundledResult.tier).toBe("BUNDLED_FILE");
    expect(bundledResult.data![0].symbol).toBe("BUNDLED_SYM");
    expect(storage.getUniverseTier()).toBe("BUNDLED_FILE");

    // 3. When both durable store and bundled files are missing, fall back to seed (Tier 3)
    const emptyTestDir = path.join(os.tmpdir(), `dse-empty-test-${Date.now()}`);
    fs.mkdirSync(emptyTestDir, { recursive: true });
    const emptyStorage = new DseStorageManager({ customStorageDir: emptyTestDir });
    (emptyStorage as any).blobsStore = { get: async () => null, setJSON: async () => {} };

    const fallbackResult = await emptyStorage.loadSecurityMaster();
    expect(fallbackResult.tier).toBe("FALLBACK_SEED");
    expect(fallbackResult.data).toBeNull();
    expect(emptyStorage.getUniverseTier()).toBe("FALLBACK_SEED");

    fs.rmSync(emptyTestDir, { recursive: true, force: true });
  });
});
