import { describe, it, expect, vi, beforeEach } from "vitest";
import { HistoryRouter } from "./history";
import * as repo from "../repositories/historicalRepository";
import { HistoryRow } from "../repositories/historicalRepository";

vi.mock("../repositories/historicalRepository", () => {
  return {
    ensureAllDirectoriesExist: vi.fn(),
    getStockHistory: vi.fn(),
    saveManyStockHistoryRows: vi.fn(),
    getAvailableHistorySymbols: vi.fn().mockReturnValue(["GP"]),
    getHistoryCoverage: vi.fn()
  };
});

describe("HistoryRouter /bulk-import tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("POST /api/history/bulk-import returns 200 with valid payload and updates statistics", async () => {
    const mockExistingBar1: HistoryRow = {
      date: "2026-06-01",
      symbol: "GP",
      open: 100,
      high: 105,
      low: 95,
      close: 102,
      ltp: 102,
      ycp: 100,
      change: 2,
      changePercent: 2,
      volume: 500,
      value: 51000,
      trade: null,
      source: "ImportedHistoricalCSV",
      snapshotType: "Imported",
      lastUpdated: "2026-06-01T00:00:00.000Z"
    };

    const mockExistingBar2: HistoryRow = {
      date: "2026-06-03",
      symbol: "GP",
      open: 105,
      high: 112,
      low: 102,
      close: 109, // different close than 110 in incoming
      ltp: 109,
      ycp: 105,
      change: 4,
      changePercent: 3.8,
      volume: 700,
      value: 76300,
      trade: null,
      source: "ImportedHistoricalCSV",
      snapshotType: "Imported",
      lastUpdated: "2026-06-03T00:00:00.000Z"
    };

    vi.mocked(repo.getStockHistory).mockReturnValue({
      symbol: "GP",
      source: "ImportedHistoricalCSV",
      coverage: null,
      data: [mockExistingBar1, mockExistingBar2]
    });

    const layer = (HistoryRouter as any).stack.find(
      (l: any) => l.route && l.route.path === "/bulk-import"
    );
    expect(layer).toBeDefined();

    const routeHandler = layer.route.stack[layer.route.stack.length - 1].handle;

    let responseCode: number = 200;
    let responseData: any = null;

    const req = {
      headers: {
        "x-admin-secret": "your_secret_here"
      },
      ip: "127.0.0.1",
      body: {
        symbol: "GP",
        rows: [
          {
            date: "2026-06-01", // identical -> skipped
            open: 100,
            high: 105,
            low: 95,
            close: 102,
            volume: 500
          },
          {
            date: "2026-06-02", // new date -> inserted
            open: 102,
            high: 108,
            low: 98,
            close: 105,
            volume: 600
          },
          {
            date: "2026-06-03", // changed data -> updated
            open: 105,
            high: 112,
            low: 102,
            close: 110,
            volume: 700
          }
        ]
      }
    };

    const res = {
      status(code: number) {
        responseCode = code;
        return this;
      },
      json(data: any) {
        responseData = data;
        return this;
      }
    };

    await (routeHandler as any)(req, res, () => {});

    expect(responseCode).toBe(200);
    expect(responseData).toBeDefined();
    expect(responseData.symbol).toBe("GP");
    expect(responseData.inserted).toBe(1);
    expect(responseData.updated).toBe(1);
    expect(responseData.skipped).toBe(1);

    expect(repo.saveManyStockHistoryRows).toHaveBeenCalled();
  });

  it("POST /api/history/bulk-import returns 400 with validation errors on invalid payload", async () => {
    const layer = (HistoryRouter as any).stack.find(
      (l: any) => l.route && l.route.path === "/bulk-import"
    );
    const routeHandler = layer.route.stack[layer.route.stack.length - 1].handle;

    let responseCode: number = 200;
    let responseData: any = null;

    const req = {
      headers: {
        "x-admin-secret": "your_secret_here"
      },
      ip: "127.0.0.1",
      body: {
        symbol: "NON_EXISTING_TICKER",
        rows: []
      }
    };

    const res = {
      status(code: number) {
        responseCode = code;
        return this;
      },
      json(data: any) {
        responseData = data;
        return this;
      }
    };

    await (routeHandler as any)(req, res, () => {});

    expect(responseCode).toBe(400);
    expect(responseData.success).toBe(false);
    expect(responseData.errors).toBeDefined();
    expect(responseData.errors.length).toBeGreaterThan(0);
  });
});
