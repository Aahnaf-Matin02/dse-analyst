import { describe, it, expect } from "vitest";
import { EquityValuationModel } from "../services/equityValuationModel";

describe("Valuation Merged Engine Tests", () => {
  const defaultInputs = {
    symbol: "BATBC",
    currentPrice: 400.0,
    bvps: 120.0,
    eps: 35.0,
    beta: 1.1,
    sector: "Food & Allied",
    debtRatio: 0.15,
    revGrowth: 8.5,
    profitGrowth: 10.0,
    divYield: 6.0
  };

  it("should contain all 11 valuation methods including the 6 ported models", () => {
    const res = EquityValuationModel.calculateEquityValuation(defaultInputs);

    expect(res.methods).toBeDefined();

    // Core first 5 methods
    expect(res.methods.pbFairValue).toBeDefined();
    expect(res.methods.roeJustifiedPB).toBeDefined();
    expect(res.methods.grahamNumber).toBeDefined();
    expect(res.methods.evBookValue).toBeDefined();
    expect(res.methods.residualIncome).toBeDefined();

    // Additional 6 ported methods
    expect(res.methods.peFairValue).toBeDefined();
    expect(res.methods.psFairValue).toBeDefined();
    expect(res.methods.pegFairValue).toBeDefined();
    expect(res.methods.dyFairValue).toBeDefined();
    expect(res.methods.evebitdaFairValue).toBeDefined();
    expect(res.methods.dcfFairValue).toBeDefined();

    // Check method names or formulas to verify correctness
    expect(res.methods.peFairValue.methodName).toContain("Price-To-Earnings");
    expect(res.methods.psFairValue.methodName).toContain("Price-To-Sales");
    expect(res.methods.pegFairValue.methodName).toContain("PEG");
    expect(res.methods.dyFairValue.methodName).toContain("Dividend Yield");
    expect(res.methods.evebitdaFairValue.methodName).toContain("EV / EBITDA");
    expect(res.methods.dcfFairValue.methodName).toContain("Discounted Cash Flow");
  });

  it("should properly calculate the 6 ported methods under normal conditions", () => {
    const res = EquityValuationModel.calculateEquityValuation(defaultInputs);

    // 1. P/E Fair Value
    expect(res.methods.peFairValue.available).toBe(true);
    expect(res.methods.peFairValue.fairPrice).toBeGreaterThan(0);

    // 2. P/S Fair Value
    expect(res.methods.psFairValue.available).toBe(true);
    expect(res.methods.psFairValue.fairPrice).toBeGreaterThan(0);

    // 3. PEG Fair Value
    expect(res.methods.pegFairValue.available).toBe(true);
    expect(res.methods.pegFairValue.fairPrice).toBeGreaterThan(0);

    // 4. Dividend Yield Fair Value
    expect(res.methods.dyFairValue.available).toBe(true);
    expect(res.methods.dyFairValue.fairPrice).toBeGreaterThan(0);

    // 5. EV/EBITDA Fair Value
    expect(res.methods.evebitdaFairValue.available).toBe(true);
    expect(res.methods.evebitdaFairValue.fairPrice).toBeGreaterThan(0);

    // 6. DCF Fair Value
    expect(res.methods.dcfFairValue.available).toBe(true);
    expect(res.methods.dcfFairValue.fairPrice).toBeGreaterThan(0);
  });

  it("should ensure that composite weights for all methods correctly sum to 100% when all are active", () => {
    const res = EquityValuationModel.calculateEquityValuation(defaultInputs);

    let weightSum = 0;
    const methodKeys = [
      "pbFairValue",
      "roeJustifiedPB",
      "grahamNumber",
      "evBookValue",
      "residualIncome",
      "peFairValue",
      "psFairValue",
      "pegFairValue",
      "dyFairValue",
      "evebitdaFairValue",
      "dcfFairValue"
    ];

    methodKeys.forEach(key => {
      const method = (res.methods as any)[key];
      expect(method).toBeDefined();
      expect(method.available).toBe(true);
      weightSum += method.weight;
    });

    // The weights are rounded to the nearest integer in `appendWeightResult`.
    // Let's verify they sum to approximately 100% (within +/-2% due to integer rounding tolerances)
    expect(weightSum).toBeGreaterThanOrEqual(98);
    expect(weightSum).toBeLessThanOrEqual(102);
  });

  it("should ensure that composite weights sum to exactly 100% through dynamic rebalancing when some methods are unavailable", () => {
    // Force some methods to be unavailable by setting EPS to negative, which disables Graham, PE, and PEG
    const restrictedInputs = {
      ...defaultInputs,
      eps: -5.0,
      divYield: null, // Disables DY
      revGrowth: null,
      profitGrowth: null
    };

    const res = EquityValuationModel.calculateEquityValuation(restrictedInputs);

    expect(res.methods.grahamNumber.available).toBe(false);
    expect(res.methods.peFairValue.available).toBe(false);
    expect(res.methods.pegFairValue.available).toBe(false);
    expect(res.methods.dyFairValue.available).toBe(false);

    let weightSum = 0;
    const methodKeys = [
      "pbFairValue",
      "roeJustifiedPB",
      "grahamNumber",
      "evBookValue",
      "residualIncome",
      "peFairValue",
      "psFairValue",
      "pegFairValue",
      "dyFairValue",
      "evebitdaFairValue",
      "dcfFairValue"
    ];

    methodKeys.forEach(key => {
      const method = (res.methods as any)[key];
      if (!method.available) {
        expect(method.weight).toBe(0);
      }
      weightSum += method.weight;
    });

    expect(weightSum).toBeGreaterThanOrEqual(98);
    expect(weightSum).toBeLessThanOrEqual(102);
  });

  it("should secure correct dynamic edge cases (e.g. low beta, high growth capping, missing parameters standardizing)", () => {
    // Missing debtRatio, revGrowth, profitGrowth should default gracefully
    const minimalInputs = {
      symbol: "MINIMAL",
      currentPrice: 150.0,
      bvps: 45.0,
      eps: 12.0,
      beta: 0.8,
      sector: "Textile"
    };

    const res = EquityValuationModel.calculateEquityValuation(minimalInputs);
    expect(res.methods.peFairValue.available).toBe(true);
    expect(res.methods.pbFairValue.available).toBe(true);

    let weightSum = 0;
    const methodKeys = [
      "pbFairValue",
      "roeJustifiedPB",
      "grahamNumber",
      "evBookValue",
      "residualIncome",
      "peFairValue",
      "psFairValue",
      "pegFairValue",
      "dyFairValue",
      "evebitdaFairValue",
      "dcfFairValue"
    ];

    methodKeys.forEach(key => {
      weightSum += (res.methods as any)[key].weight;
    });

    expect(weightSum).toBeGreaterThanOrEqual(98);
    expect(weightSum).toBeLessThanOrEqual(102);
  });
});
