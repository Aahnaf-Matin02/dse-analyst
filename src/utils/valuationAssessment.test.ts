import { describe, it, expect } from "vitest";
import { assessValuation } from "./valuationAssessment";

const sector = { name: "Telecom", medianPe: 12, medianPb: 2, medianDividendYield: 4, peersWithOfficialRatios: 5 };

describe("valuation reading", () => {
  it("leans inexpensive when P/E and P/B are well below the sector and yield is above", () => {
    const r = assessValuation({ valuation: { official: true, pe: 8, pb: 1.2, dividendYieldPct: 6 }, sector });
    expect(r.verdict).toBe("Looks inexpensive vs peers");
    expect(r.checks.map(c => c.lean)).toEqual(["cheaper", "cheaper", "cheaper"]);
  });

  it("treats values within ±20% of the median as in line", () => {
    const r = assessValuation({ valuation: { official: true, pe: 13, pb: 2.2, dividendYieldPct: 3.5 }, sector });
    expect(r.verdict).toBe("In line with peers");
  });

  it("refuses to judge without DSE-reported figures or with fewer than two comparisons", () => {
    expect(assessValuation({ valuation: { official: false, pe: 8, pb: 1, dividendYieldPct: 5 }, sector }).verdict).toBe("Not enough DSE-reported data");
    const oneCheck = assessValuation({ valuation: { official: true, pe: 30, pb: null, dividendYieldPct: null }, sector });
    expect(oneCheck.verdict).toBe("Not enough DSE-reported data");
    expect(oneCheck.checks).toHaveLength(1);
  });
});
