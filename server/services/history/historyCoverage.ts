import fs from "fs";
import path from "path";

/**
 * Coverage of real daily history for the securities the website shows, read from the summary the
 * backfill loader writes after every load (data/history/processed/coverage-summary.json).
 */
export interface HistoryCoverageReport {
  websiteSymbols: number;
  withHistory: number;
  coveragePercent: number;
  sources: Record<string, number>;
  firstDate: string | null;
  lastDate: string | null;
  yearsOfHistory: { lessThan1: number; oneToThree: number; threeToFive: number; fivePlus: number; missing: number };
  adjusted: false;
  note: string;
  summaryGeneratedAt: string | null;
}

let cached: { mtimeMs: number; report: HistoryCoverageReport } | null = null;

export function getHistoryCoverageReport(baseDir = process.cwd()): HistoryCoverageReport {
  const summaryFile = path.join(baseDir, "data", "history", "processed", "coverage-summary.json");
  const symbolsFile = path.join(baseDir, "data", "history", "source-map", "website-symbols.json");
  const note = "Daily prices are unadjusted: dividends, bonus shares, rights issues and splits are not adjusted for.";
  let websiteSymbols = 0;
  try { websiteSymbols = JSON.parse(fs.readFileSync(symbolsFile, "utf8")).symbols?.length ?? 0; } catch { /* missing list */ }

  const empty: HistoryCoverageReport = {
    websiteSymbols, withHistory: 0, coveragePercent: 0, sources: {}, firstDate: null, lastDate: null,
    yearsOfHistory: { lessThan1: 0, oneToThree: 0, threeToFive: 0, fivePlus: 0, missing: websiteSymbols },
    adjusted: false, note, summaryGeneratedAt: null,
  };
  if (!fs.existsSync(summaryFile)) return empty;
  const mtimeMs = fs.statSync(summaryFile).mtimeMs;
  if (cached && cached.mtimeMs === mtimeMs) return cached.report;

  try {
    const summary = JSON.parse(fs.readFileSync(summaryFile, "utf8"));
    const entries = Object.values(summary.symbols || {}) as any[];
    const withRows = entries.filter(e => e.rows > 0);
    const sources: Record<string, number> = {};
    const buckets = { lessThan1: 0, oneToThree: 0, threeToFive: 0, fivePlus: 0, missing: 0 };
    let firstDate: string | null = null, lastDate: string | null = null;
    for (const e of entries) {
      if (!(e.rows > 0)) { buckets.missing++; continue; }
      for (const [s, n] of Object.entries(e.sources || {})) sources[s] = (sources[s] || 0) + (n as number);
      if (!firstDate || e.firstDate < firstDate) firstDate = e.firstDate;
      if (!lastDate || e.lastDate > lastDate) lastDate = e.lastDate;
      if (e.years < 1) buckets.lessThan1++; else if (e.years < 3) buckets.oneToThree++; else if (e.years < 5) buckets.threeToFive++; else buckets.fivePlus++;
    }
    const total = websiteSymbols || entries.length;
    const report: HistoryCoverageReport = {
      websiteSymbols: total, withHistory: withRows.length,
      coveragePercent: total ? Number(((withRows.length / total) * 100).toFixed(1)) : 0,
      sources, firstDate, lastDate, yearsOfHistory: buckets, adjusted: false, note,
      summaryGeneratedAt: summary.generatedAt ?? null,
    };
    cached = { mtimeMs, report };
    return report;
  } catch {
    return empty;
  }
}
