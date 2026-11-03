import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { HISTORY_HEADER } from "../services/history/historyFiles";
import {
  median, percentile, periodReturn, maxDrawdown, annualizedVolatility, betaVsIndex, computeStockAnalytics,
} from "../services/history/stockAnalytics";

// Small hand-checkable series in a temporary data directory — never the real data folder.
const day = (i: number) => new Date(Date.UTC(2025, 0, 1) + i * 86400000).toISOString().slice(0, 10);
const series = (closes: number[]) => closes.map((close, i) => ({ date: day(i), close }));

describe("analytics maths", () => {
  it("median and percentile", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 2, 3])).toBe(2.5);
    expect(median([])).toBeNull();
    expect(percentile(5, [1, 2, 3, 4, 6, 7, 8, 9])).toBe(50);
  });

  it("period return uses the last close on or before the start date, and null when history is too short", () => {
    const s = series([100, 110, 120, 90, 99]);
    expect(periodReturn(s, day(1))).toEqual({ from: day(1), to: day(4), pct: -10 });
    expect(periodReturn(s, "2024-12-01")).toBeNull();
  });

  it("max drawdown finds the worst peak-to-trough fall", () => {
    expect(maxDrawdown(series([100, 120, 90, 130, 104]))).toEqual({ pct: -25, peak: day(1), trough: day(2) });
  });

  it("volatility is null with fewer than 20 returns and 0 for a flat price", () => {
    expect(annualizedVolatility(series([1, 2, 3]))).toBeNull();
    expect(annualizedVolatility(series(Array(30).fill(10)))).toBe(0);
  });

  it("beta is 2 when the stock moves exactly twice the index each day", () => {
    const idx: number[] = [100], stk: number[] = [100];
    for (let i = 1; i < 80; i++) {
      const r = (i % 3 === 0 ? -0.01 : 0.012);
      idx.push(idx[i - 1] * Math.exp(r));
      stk.push(stk[i - 1] * Math.exp(2 * r));
    }
    const b = betaVsIndex(series(stk), series(idx))!;
    expect(b.beta).toBe(2);
    expect(b.correlation).toBe(1);
  });
});

describe("computeStockAnalytics", () => {
  let root: string;
  const write = (rel: string, content: string) => {
    const f = path.join(root, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, content);
  };

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "dse-analytics-"));
    const rows = (closes: number[]) => HISTORY_HEADER + "\n" + closes.map((c, i) => `${day(i)},${c},${c},${c},${c},1000,DSE_OFFICIAL`).join("\n") + "\n";
    write("data/history/stocks/AAA.csv", rows([100, 105, 110, 120]));
    write("data/history/stocks/BBB.csv", rows([50, 50, 55]));
    write("data/history/indices/DSEX.csv", "date,open,high,low,close,volume,source\n" + [5000, 5050, 5100, 5200].map((c, i) => `${day(i)},,,,${c},,DSE_OFFICIAL`).join("\n") + "\n");
    write("data/dse/financials/AAA_ratios.json", JSON.stringify({ eps: 10, nav: 60, dividendYield: 3, source: "DSE_OFFICIAL", period: "2025-01-04" }));
    write("data/dse/financials/BBB_ratios.json", JSON.stringify({ eps: 5, nav: 50, dividendYield: 1, source: "LOCAL_DEVELOPMENT_FALLBACK" }));
  });
  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

  it("prices valuation from official EPS/NAV at the last stored close and ignores unofficial ratios", () => {
    const peers = [{ symbol: "AAA", sector: "X" }, { symbol: "BBB", sector: "X" }];
    const a = computeStockAnalytics("AAA", peers, root);
    expect(a.asOf).toBe(day(3));
    expect(a.lastClose).toBe(120);
    expect(a.valuation).toMatchObject({ official: true, eps: 10, nav: 60, pe: 12, pb: 2, earningsYieldPct: 8.33, dividendYieldPct: 3 });
    expect(a.sector.peersWithOfficialRatios).toBe(1);
    const b = computeStockAnalytics("BBB", peers, root);
    expect(b.valuation.official).toBe(false);
    expect(b.valuation.pe).toBeNull();
  });

  it("reports the return since the first stored day against DSEX", () => {
    const a = computeStockAnalytics("AAA", [{ symbol: "AAA", sector: "X" }], root);
    expect(a.returns.find(r => r.key === "MAX")).toMatchObject({ pct: 20, dsexPct: 4 });
    expect(a.relative.at(-1)).toEqual({ date: day(3), stock: 120, dsex: 104 });
  });

  it("returns nulls, not estimates, for a security without history", () => {
    const z = computeStockAnalytics("ZZZ", [{ symbol: "ZZZ", sector: "X" }], root);
    expect(z.history).toBeNull();
    expect(z.returns).toEqual([]);
    expect(z.range52w).toBeNull();
    expect(z.risk.volatilityPct).toBeNull();
    expect(z.liquidity.tradedSessions).toBe(0);
  });
});
