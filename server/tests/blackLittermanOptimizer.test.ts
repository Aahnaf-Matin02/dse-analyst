import { describe, it, expect } from "vitest";
import {
  calculateBlackLitterman,
  projectToConstrainedSimplex,
  solveMeanVariance
} from "../services/blackLittermanOptimizer";
import { BLInputs } from "../../src/types";

describe("Black-Litterman Portfolio Optimization System Tests", () => {
  // Test 1: Simplex Projection
  describe("projectToConstrainedSimplex", () => {
    it("should project an arbitrary vector onto the sum constraint simplex with individual bounds", () => {
      const y = [0.4, 0.5, 0.1, 0.8];
      const maxWeight = 0.3;
      const targetSum = 1.0;
      const projected = projectToConstrainedSimplex(y, maxWeight, targetSum);

      // Verify the sum of weights is targetSum
      const sum = projected.reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(targetSum, 8);

      // Verify bounds
      for (const w of projected) {
        expect(w).toBeGreaterThanOrEqual(0);
        expect(w).toBeLessThanOrEqual(maxWeight);
      }
    });
  });

  // Test 2: Mean-Variance Optimization PGD Solver
  describe("solveMeanVariance", () => {
    it("should solve constrained mean-variance optimization problem correctly", () => {
      const ER = [0.15, 0.12, 0.08];
      const Sigma = [
        [0.04, 0.012, 0.008],
        [0.012, 0.03, 0.006],
        [0.008, 0.006, 0.02]
      ];
      const delta = 2.5;
      const maxPositionWeight = 0.5;
      const targetSum = 1.0;

      const weights = solveMeanVariance(ER, Sigma, delta, maxPositionWeight, targetSum);

      const sum = weights.reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(targetSum, 6);

      for (const w of weights) {
        expect(w).toBeGreaterThanOrEqual(0);
        expect(w).toBeLessThanOrEqual(maxPositionWeight);
      }
    });
  });

  // Test 3: Black-Litterman calculations
  describe("calculateBlackLitterman Calculations", () => {
    // Generate returns history mock (>=30 daily entries)
    const generateReturns = (symbol: string, mu: number, sigma: number, count = 40): number[] => {
      // Simple pseudo-random return series
      const returns: number[] = [];
      let seed = symbol.charCodeAt(0) + symbol.charCodeAt(1);
      for (let i = 0; i < count; i++) {
        // Simple LCG pseudo-random normal proxy
        seed = (seed * 9301 + 49297) % 233280;
        const rand = seed / 233280;
        returns.push(mu + sigma * (rand - 0.5));
      }
      return returns;
    };

    const returnsHistory: Record<string, number[]> = {
      GP: generateReturns("GP", 0.0005, 0.015),
      BATBC: generateReturns("BATBC", 0.0002, 0.012),
      BEXIMCO: generateReturns("BEXIMCO", -0.0004, 0.02),
      // FEW: has insufficient history (<30 points)
      SHORT: generateReturns("SHORT", 0.001, 0.01, 15)
    };

    it("should process and compute equilibrium and blended returns successfully", () => {
      const inputs: BLInputs = {
        holdings: [
          { symbol: "GP", marketWeight: 0.5, finalScore: 80, confidence: 70 }, // bullish, high confidence
          { symbol: "BATBC", marketWeight: 0.3, finalScore: 50, confidence: 50 }, // neutral, moderate confidence
          { symbol: "BEXIMCO", marketWeight: 0.1, finalScore: 20, confidence: 90 }, // bearish, high confidence
          { symbol: "SHORT", marketWeight: 0.1, finalScore: 90, confidence: 80 } // insufficient points, should be held at current weight
        ],
        returnsHistory,
        riskAversion: 2.5,
        tau: 0.05,
        maxPositionWeight: 0.4
      };

      const result = calculateBlackLitterman(inputs);

      expect(result.allocations).toBeDefined();
      expect(result.allocations.length).toBe(4);

      // Verify SHORT has insufficient history, kept at current weight (0.1) as specified
      const shortAlloc = result.allocations.find(a => a.symbol === "SHORT");
      expect(shortAlloc).toBeDefined();
      expect(shortAlloc?.recommendedWeight).toBeCloseTo(0.1, 4);
      expect(shortAlloc?.rationale).toContain("Insufficient return history");

      // Verify recommended weights sum to 1.0 (or ultra close)
      const totalRecommendedWeight = result.allocations.reduce((sum, a) => sum + a.recommendedWeight, 0);
      expect(totalRecommendedWeight).toBeCloseTo(1.0, 3);

      // Verify no active asset recommendation violates the maxPositionWeight configuration
      for (const alloc of result.allocations) {
        if (alloc.symbol !== "SHORT") {
          expect(alloc.recommendedWeight).toBeLessThanOrEqual(0.4);
          expect(alloc.recommendedWeight).toBeGreaterThanOrEqual(0);
        }
      }

      // View return Q_i = 0 when finalScore = 50 (neutral) for BATBC
      const batbcAlloc = result.allocations.find(a => a.symbol === "BATBC");
      expect(batbcAlloc?.viewReturn).toBe(0);

      // View return Q_i positive when finalScore > 50 (GP)
      const gpAlloc = result.allocations.find(a => a.symbol === "GP");
      expect(gpAlloc?.viewReturn).toBeGreaterThan(0);

      // View return Q_i negative when finalScore < 50 (BEXIMCO)
      const beximcoAlloc = result.allocations.find(a => a.symbol === "BEXIMCO");
      expect(beximcoAlloc?.viewReturn).toBeLessThan(0);
    });

    it("should handle the edge case with 0 holdings gracefully", () => {
      const inputs: BLInputs = {
        holdings: [],
        returnsHistory: {}
      };

      const result = calculateBlackLitterman(inputs);

      expect(result.allocations).toEqual([]);
      expect(result.expectedPortfolioReturn).toBe(0);
      expect(result.expectedPortfolioRisk).toBe(0);
      expect(result.sharpeEstimate).toBe(0);
      expect(result.rebalanceRequired).toBe(false);
      expect(result.diversificationNote).toContain("No holdings");
    });
  });
});
