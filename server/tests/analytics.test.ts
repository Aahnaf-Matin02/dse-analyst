import { describe, it, expect } from "vitest";
import { HistoryRow } from "../repositories/historicalRepository";
import { StockData } from "../../src/types";
import {
  calculatePriceEnvelope,
  calculateComparativeMetrics,
  optimizePortfolio
} from "../services/analyticsService";

// Helper of simulated HistoryRows
function createMockRow(date: string, close: number, volume: number = 5000): HistoryRow {
  return {
    date,
    symbol: "MOCK",
    open: close,
    high: close * 1.02,
    low: close * 0.98,
    close,
    ltp: close,
    ycp: close,
    change: 0,
    changePercent: 0,
    volume,
    value: close * volume,
    trade: 100,
    source: "ImportedHistoricalCSV",
    snapshotType: "Imported",
    lastUpdated: new Date().toISOString()
  };
}

describe("DSE Stock Analytics Service Unit Tests", () => {

  // Test 1: Unit test price envelope calculation
  describe("calculatePriceEnvelope", () => {
    it("should correctly compute standard 20 SMA with a 5% corridor", () => {
      // Create 25 rows of sequential constant close price = 100
      const rows: HistoryRow[] = [];
      for (let i = 1; i <= 25; i++) {
        const dateStr = `2026-06-${i.toString().padStart(2, "0")}`;
        rows.push(createMockRow(dateStr, 100));
      }

      const envelopeResult = calculatePriceEnvelope(rows, 20, 5);
      expect(envelopeResult.dataQuality).toBe("PartialHistory"); // since < 100 rows
      expect(envelopeResult.data.length).toBe(6); // 25 - 20 + 1 = 6 items have 20D SMA
      
      const latest = envelopeResult.data[envelopeResult.data.length - 1];
      expect(latest.close).toBe(100);
      expect(latest.middle).toBe(100); // SMA
      expect(latest.upper).toBe(105); // middle * 1.05
      expect(latest.lower).toBe(95); // middle * 0.95
      expect(latest.position).toBe(0.5); // centered
      expect(latest.zone).toBe("Upper Half"); // middle is inclusive upper half
      expect(latest.signal).toBe("Neutral");
    });

    it("should trigger Oversold Buy when close falls beneath the lower band", () => {
      // Let's create price of 100 for 19 days, then drop to 50 on the 20th day
      const rows: HistoryRow[] = [];
      for (let i = 1; i <= 19; i++) {
        rows.push(createMockRow(`2026-06-${i.toString().padStart(2, "0")}`, 100));
      }
      rows.push(createMockRow("2026-06-20", 50)); // Price drops drastically

      const envelopeResult = calculatePriceEnvelope(rows, 20, 5);
      expect(envelopeResult.data.length).toBe(1);
      
      const latest = envelopeResult.data[0];
      // SMA = (19*100 + 50) / 20 = 1950 / 20 = 97.5
      // Middle = 97.5
      // Lower envelope = 97.5 * 0.95 = 92.625 => ~92.63
      // Close is 50, which is << 92.625
      expect(latest.close).toBe(50);
      expect(latest.zone).toBe("Below Lower");
      expect(latest.signal).toBe("Oversold Buy");
    });
  });

  // Test 2: Unit test DSEX date alignment
  describe("calculateComparativeMetrics Date Alignment", () => {
    it("should strictly align data points by overlapping dates", () => {
      // Stock dates: 1st, 2nd, 3rd, 4th
      // Benchmark dates: 2nd, 3rd, 4th, 5th
      // Overlapping: 2nd, 3rd, 4th
      const stockHistory = [
        createMockRow("2026-06-01", 10),
        createMockRow("2026-06-02", 11),
        createMockRow("2026-06-03", 12),
        createMockRow("2026-06-04", 13)
      ];

      const benchmarkHistory = [
        createMockRow("2026-06-02", 5000),
        createMockRow("2026-06-03", 5100),
        createMockRow("2026-06-04", 5200),
        createMockRow("2026-06-05", 5300)
      ];

      // Executing. Not enough rows for correlation/beta (needs at least 3 returns, which requires 4 aligned periods)
      // but let's check return computations on remaining overlapping days
      const results = calculateComparativeMetrics(stockHistory, benchmarkHistory);
      expect(results).toBeDefined();
      // On 3 overlapping dates: 2nd (start value) and 4th (end value)
      // stockReturn should look back idx_start to end. Since aligned.length = 3
      // looking back 30 trading days falls back to start value: 11 -> 13 => 2/11 * 100 = 18.18%
      expect(results?.stockReturn30D).toBe(18.18);
      // benchmark: 5000 -> 5200 => 200/5000 * 100 = 4.00%
      expect(results?.benchmarkReturn30D).toBe(4.00);
      expect(results?.excessReturn30D).toBe(14.18);
    });
  });

  // Test 3: Unit test relative strength, beta, correlation, and max drawdown
  describe("Quantitative Metrics (Relative Strength, Beta, Correlation, Max Drawdown)", () => {
    it("should compute accurate statistics on overlapping date arrays", () => {
      // Create 10 overlapping dates
      const stockHistory: HistoryRow[] = [];
      const benchmarkHistory: HistoryRow[] = [];

      const stockCloses = [100, 102, 101, 103, 105, 104, 106, 108, 107, 110];
      const bmCloses =    [5000, 5050, 5020, 5080, 5100, 5090, 5120, 5150, 5130, 5200];

      for (let i = 0; i < 10; i++) {
        const dateStr = `2026-06-${(i + 1).toString().padStart(2, "0")}`;
        stockHistory.push(createMockRow(dateStr, stockCloses[i]));
        benchmarkHistory.push(createMockRow(dateStr, bmCloses[i]));
      }

      const results = calculateComparativeMetrics(stockHistory, benchmarkHistory);
      expect(results).not.toBeNull();
      expect(results?.correlation).toBeGreaterThan(0.5); // Highly positive correlation
      expect(results?.beta).toBeDefined();
      expect(results?.volatility).toBeDefined();
      
      // Max drawdown of stock: Peak is 108 (day 8), then falls to 107 (day 9)
      // Also Peak is 105 (day 5), then falls to 104 (day 6) => 1/105 = 0.95%
      // Peak 108 -> 107 => 0.92%
      // Peak 102 -> 101 => 0.98% (Drawdown is 0.98%)
      // Drawdown is calculated. Max drawdown across the whole series should be ~0.98%
      expect(results?.maxDrawdown).toBeGreaterThanOrEqual(0.9);
      expect(results?.rating).not.toBe("Insufficient Data");
    });
  });

  // Test 4 & 5: Unit test portfolio allocation sums to 100% & bounds constraints
  describe("Heuristic Portfolio Optimizer Caps & Normalizations", () => {
    const mockStocks: Record<string, StockData> = {
      GP: {
        symbol: "GP",
        name: "Grameenphone",
        sector: "Telecommunication",
        price: 300, ltp: 300, ycp: 300, change: 0, changePercent: 0, trades: 1000, volume: 500000, value: 150000000,
        eps: 25, nav: 120, peRatio: 12, divYield: 8.5, marketCap: "BDT 400B", revGrowth: 12, profitGrowth: 15,
        source: "CachedFile", dataSource: "CachedFile", lastUpdated: "2026-06-03"
      },
      SQURPHARMA: {
        symbol: "SQURPHARMA",
        name: "Square Pharma",
        sector: "Pharmaceuticals",
        price: 240, ltp: 240, ycp: 240, change: 0, changePercent: 0, trades: 800, volume: 400000, value: 96000000,
        eps: 22, nav: 110, peRatio: 10.9, divYield: 7.2, marketCap: "BDT 320B", revGrowth: 10, profitGrowth: 12,
        source: "CachedFile", dataSource: "CachedFile", lastUpdated: "2026-06-03"
      },
      RENATA: {
        symbol: "RENATA",
        name: "Renata Limited",
        sector: "Pharmaceuticals",
        price: 800, ltp: 800, ycp: 800, change: 0, changePercent: 0, trades: 500, volume: 100000, value: 80000000,
        eps: 35, nav: 250, peRatio: 22.8, divYield: 3.5, marketCap: "BDT 95B", revGrowth: 8, profitGrowth: 6,
        source: "CachedFile", dataSource: "CachedFile", lastUpdated: "2026-06-03"
      },
      BRACBANK: {
        symbol: "BRACBANK",
        name: "BRAC Bank PLC",
        sector: "Banking",
        price: 45, ltp: 45, ycp: 45, change: 0, changePercent: 0, trades: 1500, volume: 2000000, value: 90000000,
        eps: 4.8, nav: 38, peRatio: 9.3, divYield: 5.5, marketCap: "BDT 75B", revGrowth: 15, profitGrowth: 18,
        source: "CachedFile", dataSource: "CachedFile", lastUpdated: "2026-06-03"
      }
    };

    const mockHistoryFetcher = (sym: string) => {
      // Stable 30 rows at constant price
      const sPrice = mockStocks[sym]?.price || 100;
      const rows: HistoryRow[] = [];
      for (let i = 1; i <= 30; i++) {
        rows.push(createMockRow(`2026-06-${i.toString().padStart(2, "0")}`, sPrice));
      }
      return { data: rows };
    };

    const mockBenchmarkRows: HistoryRow[] = [];
    for (let i = 1; i <= 30; i++) {
      mockBenchmarkRows.push(createMockRow(`2026-06-${i.toString().padStart(2, "0")}`, 5000));
    }

    it("should calculate allocations that sum to exactly 100%", () => {
      const symbols = ["GP", "SQURPHARMA", "RENATA", "BRACBANK"];
      const optimizerResult = optimizePortfolio(
        symbols,
        mockStocks,
        mockHistoryFetcher,
        mockBenchmarkRows,
        "Balanced",
        1000000, // 1 BDT Million
        30, // max weight stock
        40  // max weight sector
      );

      expect(optimizerResult.allocations.length).toBe(4);
      
      const sumWeights = optimizerResult.allocations.reduce((sum, item) => sum + item.weight, 0);
      expect(Math.abs(100 - sumWeights)).toBeLessThan(0.01); // Excatly 100%

      const sumCapital = optimizerResult.allocations.reduce((sum, item) => sum + item.allocatedAmount, 0);
      expect(Math.abs(1000000 - sumCapital)).toBeLessThan(1.0); // BDT 1,000,000 matches capital
    });

    it("should strictly enforce maximum allocation per stock (cap = 25%)", () => {
      const symbols = ["GP", "SQURPHARMA", "RENATA", "BRACBANK"];
      const maxStockCap = 25;
      const optimizerResult = optimizePortfolio(
        symbols,
        mockStocks,
        mockHistoryFetcher,
        mockBenchmarkRows,
        "Aggressive",
        500000,
        maxStockCap, // 25
        45
      );

      optimizerResult.allocations.forEach(a => {
        expect(a.weight).toBeLessThanOrEqual(maxStockCap + 0.01);
      });
    });

    it("`should strictly enforce maximum sector exposure (cap = 40%)`", () => {
      // In this setup, SQURPHARMA and RENATA are both inside Pharmaceuticals
      // Combined, they would normally capture more than 40%, but the sector limit should truncate them.
      const symbols = ["GP", "SQURPHARMA", "RENATA", "BRACBANK"];
      const maxSectorCap = 40;
      const optimizerResult = optimizePortfolio(
        symbols,
        mockStocks,
        mockHistoryFetcher,
        mockBenchmarkRows,
        "Conservative",
        500000,
        30,
        maxSectorCap // 40% Pharmaceuticals max
      );

      // Verify sector allocation totals
      const secMap: Record<string, number> = {};
      optimizerResult.allocations.forEach(a => {
        secMap[a.sector] = (secMap[a.sector] || 0) + a.weight;
      });

      expect(secMap["Pharmaceuticals"]).toBeLessThanOrEqual(maxSectorCap + 0.01);
      
      const sumWeights = optimizerResult.allocations.reduce((sum, item) => sum + item.weight, 0);
      expect(Math.abs(100 - sumWeights)).toBeLessThan(0.01); // Strictly normalized
    });
  });
});
