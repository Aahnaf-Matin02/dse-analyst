/**
 * Rule-based valuation reading from DSE-reported EPS / NAV / dividend yield and sector medians
 * (GET /api/stocks/:symbol/analytics). No AI, no estimates: a check without data is skipped.
 * It compares the stock with its sector; it is not a buy/sell recommendation.
 */
export type Lean = "cheaper" | "pricier" | "in line";
export interface ValuationCheck { name: string; value: string; benchmark: string; lean: Lean; explanation: string }
export interface ValuationReading {
  verdict: "Looks inexpensive vs peers" | "Looks expensive vs peers" | "In line with peers" | "Not enough DSE-reported data";
  tone: "up" | "down" | "neutral" | "none";
  checks: ValuationCheck[];
  /** The stock's own DSE-reported ratios, shown even when no sector comparison is possible */
  figures: { name: string; value: string; explanation: string }[];
  summary: string;
}

interface Inputs {
  valuation: { official: boolean; pe: number | null; pb: number | null; dividendYieldPct: number | null; earningsYieldPct?: number | null };
  sector: { name: string | null; medianPe: number | null; medianPb: number | null; medianDividendYield: number | null; peersWithOfficialRatios: number };
}

const BAND = 0.2; // within ±20% of the sector median counts as "in line"
const lean = (value: number, median: number, lowerIsCheaper = true): Lean =>
  value < median * (1 - BAND) ? (lowerIsCheaper ? "cheaper" : "pricier")
    : value > median * (1 + BAND) ? (lowerIsCheaper ? "pricier" : "cheaper") : "in line";

export function assessValuation({ valuation: v, sector: s }: Inputs): ValuationReading {
  const checks: ValuationCheck[] = [];
  const sector = s.name ?? "its sector";
  const figures: ValuationReading["figures"] = !v.official ? [] : [
    v.pe !== null && { name: "P/E", value: `${v.pe.toFixed(1)}×`, explanation: `Price ÷ earnings per share: investors pay ${v.pe.toFixed(1)} taka for each taka of yearly profit.` },
    v.earningsYieldPct != null && { name: "Earnings yield", value: `${v.earningsYieldPct.toFixed(1)}%`, explanation: "Earnings per share ÷ price, the inverse of P/E: profit earned for each 100 taka paid." },
    v.pb !== null && { name: "P/B", value: `${v.pb.toFixed(2)}×`, explanation: v.pb < 1 ? "Price ÷ net assets per share (NAV): below 1, the share costs less than the company's net assets per share." : "Price ÷ net assets per share (NAV): how many taka are paid for each taka of net assets." },
    v.dividendYieldPct !== null && { name: "Dividend yield", value: `${v.dividendYieldPct.toFixed(2)}%`, explanation: "Yearly cash dividend ÷ price." },
  ].filter(Boolean) as ValuationReading["figures"];
  if (v.official && v.pe !== null && s.medianPe !== null) {
    const l = lean(v.pe, s.medianPe);
    checks.push({
      name: "Price / earnings (P/E)", value: `${v.pe.toFixed(1)}×`, benchmark: `${sector} median ${s.medianPe.toFixed(1)}×`, lean: l,
      explanation: `Investors pay ${v.pe.toFixed(1)} taka for each taka of yearly profit, against ${s.medianPe.toFixed(1)} for a typical ${sector} company.`,
    });
  }
  if (v.official && v.pb !== null && s.medianPb !== null) {
    const l = v.pb < 1 ? "cheaper" : lean(v.pb, s.medianPb);
    checks.push({
      name: "Price / book value (P/B)", value: `${v.pb.toFixed(2)}×`, benchmark: `${sector} median ${s.medianPb.toFixed(2)}×`, lean: l,
      explanation: v.pb < 1
        ? "The share trades below the company's net assets per share (NAV)."
        : `The share costs ${v.pb.toFixed(2)} times its net assets per share, against ${s.medianPb.toFixed(2)} for the sector.`,
    });
  }
  if (v.official && v.dividendYieldPct !== null && s.medianDividendYield !== null && s.medianDividendYield > 0) {
    const l = lean(v.dividendYieldPct, s.medianDividendYield, false);
    checks.push({
      name: "Dividend yield", value: `${v.dividendYieldPct.toFixed(2)}%`, benchmark: `${sector} median ${s.medianDividendYield.toFixed(2)}%`, lean: l,
      explanation: "A higher yield means more cash dividend for each taka paid for the share.",
    });
  }

  if (checks.length < 2) {
    return {
      verdict: "Not enough DSE-reported data", tone: "none", checks, figures,
      summary: !v.official
        ? "EPS and NAV from DSE's company page have not been collected for this company, so it is not compared."
        : `No sector comparison yet: sector medians need at least 3 ${sector} companies with DSE-reported figures, and ${s.peersWithOfficialRatios === 1 ? "only 1 has" : `${s.peersWithOfficialRatios} have`} them. The company's own figures are below.`,
    };
  }
  const cheaper = checks.filter(c => c.lean === "cheaper").length;
  const pricier = checks.filter(c => c.lean === "pricier").length;
  const verdict = cheaper > pricier ? "Looks inexpensive vs peers" : pricier > cheaper ? "Looks expensive vs peers" : "In line with peers";
  return {
    verdict, tone: verdict === "Looks inexpensive vs peers" ? "up" : verdict === "Looks expensive vs peers" ? "down" : "neutral", checks, figures,
    summary: `${cheaper} of ${checks.length} measures point cheaper and ${pricier} pricier than the ${sector} median (within ±20% counts as in line).`,
  };
}
