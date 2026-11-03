import { describe, it, expect, vi, beforeEach } from "vitest";
import { calculateDecisionIntelligence } from "../services/decisionIntelligence";
import * as historicalRepository from "../repositories/historicalRepository";
import * as stockRepository from "../repositories/stockRepository";

// Helper of simulated HistoryRows
function createMockRow(symbol: string, date: string, close: number): historicalRepository.HistoryRow {
  return {
    date,
    symbol,
    open: close,
    high: close * 1.01,
    low: close * 0.99,
    close,
    ltp: close,
    ycp: close,
    change: 0,
    changePercent: 0,
    volume: 1000,
    value: close * 1000,
    trade: 50,
    source: "ImportedHistoricalCSV",
    snapshotType: "Imported",
    lastUpdated: new Date().toISOString()
  };
}

describe("Decision Intelligence Service Unit & Fallback Tests", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // Path B test: rows.length = 0
  it("should handle Path B (0 rows) gracefully with 'Insufficient Data'", () => {
    vi.spyOn(stockRepository, "getStockBySymbol").mockReturnValue({
      symbol: "ZERO",
      name: "Zero Data stock",
      price: 50,
      divYield: null,
      nav: null,
      eps: null,
      sector: "Miscellaneous"
    } as any);

    vi.spyOn(historicalRepository, "getStockHistory").mockReturnValue({
      success: true,
      data: []
    } as any);

    const result = calculateDecisionIntelligence("ZERO");

    expect(result.dataQuality).toBe("Insufficient"); // Path B returns "Insufficient"
    expect(result.trend.classification).toBe("Insufficient Data");
    expect(result.trend.primaryTrend).toContain("Not enough historical data");
    
    // Check key fields allow null
    expect(result.marketStructure.supportZones).toEqual([]);
    expect(result.marketStructure.resistanceZones).toEqual([]);
    expect(result.marketStructure.breakoutPrice).toBeNull();
    expect(result.marketStructure.breakdownPrice).toBeNull();
    expect(result.risk.atr).toBeNull();
    
    expect(result.targets.valuationTargetPrice).toBeNull();
    expect(result.targets.consensusTargetPrice).toBeNull();
    expect(result.targets.expectedReturn).toBeNull();
  });

  // Path A test: rows.length = 5 with Modest Uptrend
  it("should calculate Path A (5 rows) with Modest Uptrend correctly using real statistical pricing", () => {
    vi.spyOn(stockRepository, "getStockBySymbol").mockReturnValue({
      symbol: "UP",
      name: "Uptrend stock",
      price: 100,
      divYield: null,
      nav: null,
      eps: null,
      sector: "Miscellaneous"
    } as any);

    // 5 rows: close goes from 100 -> 106 (+6%)
    const rows = [
      createMockRow("UP", "2026-06-01", 100),
      createMockRow("UP", "2026-06-02", 101),
      createMockRow("UP", "2026-06-03", 103),
      createMockRow("UP", "2026-06-04", 104),
      createMockRow("UP", "2026-06-05", 106)
    ];

    vi.spyOn(historicalRepository, "getStockHistory").mockReturnValue({
      success: true,
      data: rows
    } as any);

    const result = calculateDecisionIntelligence("UP");

    expect(result.dataQuality).toBe("Partial"); // Path A returns Partial
    expect(result.trend.primaryTrend).toBe("Limited Data — Modest Uptrend");
    
    // Mathematical checks for realSupport/realResistance from mock rows:
    // Min low of rows (each low is close * 0.99):
    // 100 * 0.99 = 99
    // Max high of rows (each high is close * 1.01):
    // 106 * 1.01 = 107.06
    expect(result.marketStructure.breakdownPrice).toBeCloseTo(99, 1);
    expect(result.marketStructure.breakoutPrice).toBeCloseTo(107.06, 1);
    
    // ATR verification:
    // Simple mock TR average: (high - low) across 5 rows.
    // row 1: 101 - 99 = 2
    // row 2: 102.01 - 99.99 = 2.02
    // row 3: 104.03 - 101.97 = 2.06
    // row 4: 105.04 - 102.96 = 2.08
    // row 5: 107.06 - 104.94 = 2.12
    // Avg = (2 + 2.02 + 2.06 + 2.08 + 2.12) / 5 = 10.28 / 5 = 2.056 -> ~2.06
    expect(result.risk.atr).toBeCloseTo(2.06, 1);
    
    // Targets framework checking consensusTargetPrice: (realResistance * 0.4) + (currentPrice * 0.6)
    // 107.06 * 0.4 + 100 * 0.6 = 42.824 + 60 = 102.824 -> ~102.82
    expect(result.targets.consensusTargetPrice).toBeCloseTo(102.82, 1);
  });

  // Path A test: rows.length = 5 with Modest Downtrend
  it("should classify Path A (5 rows) as Modest Downtrend if close points drop over 2%", () => {
    vi.spyOn(stockRepository, "getStockBySymbol").mockReturnValue({
      symbol: "DOWN",
      name: "Downtrend stock",
      price: 100,
      divYield: null,
      nav: null,
      eps: null,
      sector: "Miscellaneous"
    } as any);

    // 5 rows: close goes from 100 -> 95 (-5%)
    const rows = [
      createMockRow("DOWN", "2026-06-01", 100),
      createMockRow("DOWN", "2026-06-02", 99),
      createMockRow("DOWN", "2026-06-03", 98),
      createMockRow("DOWN", "2026-06-04", 96),
      createMockRow("DOWN", "2026-06-05", 95)
    ];

    vi.spyOn(historicalRepository, "getStockHistory").mockReturnValue({
      success: true,
      data: rows
    } as any);

    const result = calculateDecisionIntelligence("DOWN");

    expect(result.dataQuality).toBe("Partial");
    expect(result.trend.primaryTrend).toBe("Limited Data — Modest Downtrend");
  });

  // Path A test: rows.length = 5 with Range Bound
  it("should classify Path A (5 rows) as Range Bound if trend change is under 2%", () => {
    vi.spyOn(stockRepository, "getStockBySymbol").mockReturnValue({
      symbol: "RANGE",
      name: "Sideways stock",
      price: 100,
      divYield: null,
      nav: null,
      eps: null,
      sector: "Miscellaneous"
    } as any);

    // 5 rows: close goes from 100 -> 100.5 (under 2%)
    const rows = [
      createMockRow("RANGE", "2026-06-01", 100),
      createMockRow("RANGE", "2026-06-02", 100.8),
      createMockRow("RANGE", "2026-06-03", 100.2),
      createMockRow("RANGE", "2026-06-04", 99.5),
      createMockRow("RANGE", "2026-06-05", 100.5)
    ];

    vi.spyOn(historicalRepository, "getStockHistory").mockReturnValue({
      success: true,
      data: rows
    } as any);

    const result = calculateDecisionIntelligence("RANGE");

    expect(result.dataQuality).toBe("Partial");
    expect(result.trend.primaryTrend).toBe("Limited Data — Range Bound");
  });
});
