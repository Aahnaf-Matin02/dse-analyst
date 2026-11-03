import { describe, it, expect } from "vitest";
import { EquityValuationModel, getSectorBenchmark } from "./equityValuationModel";

describe("Enterprise Book Value Valuation Engine Tests", () => {
  it("should match P/B fair value calculation correctly (exact sector P/B * BVPS)", () => {
    const res = EquityValuationModel.calculateEquityValuation({
      symbol: "TEST_A",
      currentPrice: 100,
      bvps: 50,
      eps: 5,
      beta: 1.0,
      sector: "Pharmaceuticals & Chemicals",
      debtRatio: 0.2,
      revGrowth: 10,
      profitGrowth: 10
    });

    const sBm = getSectorBenchmark("Pharmaceuticals & Chemicals");
    expect(res.sectorBenchmark.sector).toBe("Pharmaceuticals & Chemicals");
    expect(res.sectorBenchmark.avgPB).toBe(3.20);
    expect(res.methods.pbFairValue.fairPrice).toBe(parseFloat((3.20 * 50).toFixed(2))); // 160
    expect(res.methods.pbFairValue.available).toBe(true);
  });

  it("should calculate Graham Number correctly and flag it as unavailable when EPS <= 0", () => {
    const positiveEpsRes = EquityValuationModel.calculateEquityValuation({
      symbol: "TEST_B",
      currentPrice: 100,
      bvps: 40,
      eps: 10,
      beta: 1.2,
      sector: "Bank",
      debtRatio: 0.1,
      revGrowth: 5,
      profitGrowth: 5
    });
    expect(positiveEpsRes.methods.grahamNumber.available).toBe(true);
    expect(positiveEpsRes.methods.grahamNumber.fairPrice).toBe(parseFloat(Math.sqrt(22.5 * 10 * 40).toFixed(2))); // sqrt(9000) = 94.87

    const negativeEpsRes = EquityValuationModel.calculateEquityValuation({
      symbol: "TEST_C",
      currentPrice: 100,
      bvps: 40,
      eps: -2,
      beta: 1.2,
      sector: "Bank",
      debtRatio: 0.1,
      revGrowth: 5,
      profitGrowth: 5
    });
    expect(negativeEpsRes.methods.grahamNumber.available).toBe(false);
    expect(negativeEpsRes.methods.grahamNumber.fairPrice).toBe(0);
  });

  it("should calculate ROE < Cost of Equity -> Justified P/B < 1.0 and vice-versa", () => {
    // 1. ROE (6%) < Cost of Equity ( Ke = 8% + 1.0 * 6.5% = 14.5% ) -> justifiedPB < 1.0
    const testLowRoe = EquityValuationModel.calculateEquityValuation({
      symbol: "TEST_D",
      currentPrice: 50,
      bvps: 50,
      eps: 3, // roe = (3 / 50) * 100 = 6%
      beta: 1.0,
      sector: "Bank"
    });
    const lowPbValue = testLowRoe.methods.roeJustifiedPB.targetPB;
    expect(lowPbValue).toBeLessThan(1.0);

    // 2. ROE (20%) > Cost of Equity ( Ke = 8% + 1.0 * 6.5% = 14.5% ) -> justifiedPB > 1.0
    const testHighRoe = EquityValuationModel.calculateEquityValuation({
      symbol: "TEST_E",
      currentPrice: 50,
      bvps: 50,
      eps: 10, // roe = 20%
      beta: 1.0,
      sector: "Bank"
    });
    const highPbValue = testHighRoe.methods.roeJustifiedPB.targetPB;
    expect(highPbValue).toBeGreaterThan(1.0);
  });

  it("should dynamically redistribute model weights correctly when any methods are unavailable", () => {
    // Both Graham and Residual Income unavailable due to negative EPS
    const res = EquityValuationModel.calculateEquityValuation({
      symbol: "TEST_F",
      currentPrice: 100,
      bvps: 50,
      eps: -1, // causes Graham and RI to disable
      beta: 1.0,
      sector: "Bank",
      debtRatio: null, // causes EV/BV to disable
      revGrowth: null,
      profitGrowth: null
    });

    // Only pbFairValue and roeJustifiedPB are active.
    // pbActiveWeight (0.30) + roeJustifiedWeight (0.25) = 0.55.
    // Excess 0.45 redistributed equally -> 0.45 / 2 = 0.225 added to each.
    // pbWeight = 0.30 + 0.225 = 0.525 (53% in UI rounded representation)
    // roeJustifiedWeight = 0.25 + 0.225 = 0.475 (48% in UI rounded representation)
    
    expect(res.methods.pbFairValue.available).toBe(true);
    expect(res.methods.roeJustifiedPB.available).toBe(true);
    expect(res.methods.grahamNumber.available).toBe(false);
    expect(res.methods.evBookValue.available).toBe(false);
    expect(res.methods.residualIncome.available).toBe(false);

    const pbW = (res.methods.pbFairValue as any).weight;
    const roeW = (res.methods.roeJustifiedPB as any).weight;
    const grahamW = (res.methods.grahamNumber as any).weight;
    const evW = (res.methods.evBookValue as any).weight;
    const riW = (res.methods.residualIncome as any).weight;

    expect(pbW + roeW + grahamW + evW + riW).toBe(100);
    expect(grahamW).toBe(0);
    expect(evW).toBe(0);
    expect(riW).toBe(0);
  });

  it("should reflect correct margin of safety signs", () => {
    // Fair value 120, current price 100 -> MoS should be positive (undervalued)
    const undervaluedRes = EquityValuationModel.calculateEquityValuation({
      symbol: "TEST_G",
      currentPrice: 10,
      bvps: 50,
      eps: 2,
      beta: 1.0,
      sector: "Textile"
    });
    expect(undervaluedRes.compositeMarginOfSafety).toBeGreaterThan(0);

    // Fair value 20, current price 100 -> MoS should be negative (overvalued)
    const overvaluedRes = EquityValuationModel.calculateEquityValuation({
      symbol: "TEST_H",
      currentPrice: 500,
      bvps: 10,
      eps: 0.1,
      beta: 1.5,
      sector: "Textile"
    });
    expect(overvaluedRes.compositeMarginOfSafety).toBeLessThan(0);
  });

  it("should return sector benchmarks fallbacks correctly for registration of unknown sectors", () => {
    const unknownBenchmark = getSectorBenchmark("Nuclear Space Tech Sector");
    expect(unknownBenchmark.sector).toBe("Miscellaneous");
    expect(unknownBenchmark.avgPB).toBe(1.60);
  });
});
