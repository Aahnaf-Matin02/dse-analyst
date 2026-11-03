import fs from "fs";
import path from "path";
import { HistoryBar, readStockHistory, stockHistoryPath } from "./historyFiles";

/**
 * Analytics computed only from real, stored data:
 *  - daily OHLCV from data/history/stocks (DSE official day-end archive, unadjusted)
 *  - DSEX closes from data/history/indices/DSEX.csv (DSE market summary archive)
 *  - EPS / NAV / dividend yield from data/dse/financials/<SYM>_ratios.json (DSE company page)
 *  - fiscal-year EPS / net profit from data/dse/financials/<SYM>_statements.json (DSE company page)
 * Anything that cannot be computed is null, never estimated.
 */

export const SESSIONS_PER_YEAR = 240; // DSE held 239–240 sessions a year in the stored archive

export interface PeriodReturn { key: string; label: string; from: string; to: string; pct: number; dsexPct: number | null; }

export interface StockAnalytics {
  symbol: string;
  asOf: string | null;
  history: { source: "DSE_OFFICIAL"; firstDate: string; lastDate: string; sessions: number; adjusted: false } | null;
  lastClose: number | null;
  returns: PeriodReturn[];
  relative: { date: string; stock: number; dsex: number | null }[]; // both rebased to 100 at the start of the last 1Y window
  range52w: { high: number; highDate: string; low: number; lowDate: string; positionPct: number; fromHighPct: number; fromLowPct: number } | null;
  risk: {
    volatilityPct: number | null; volatilityPercentile: number | null;
    maxDrawdownPct: number | null; drawdownPeak: string | null; drawdownTrough: string | null;
    beta: number | null; correlation: number | null; window: string | null;
  };
  trend: { sma50: number | null; sma200: number | null; vsSma50Pct: number | null; vsSma200Pct: number | null };
  liquidity: {
    avgVolume20: number | null; avgValue20Bdt: number | null;
    tradedSessionsPct: number | null; tradedSessions: number | null; marketSessions: number | null;
    liquidityPercentile: number | null;
  };
  marketRank: { return1yPercentile: number | null; universe: number };
  valuation: {
    official: boolean; ratioDate: string | null; sourceUrl: string | null;
    eps: number | null; nav: number | null; pe: number | null; pb: number | null; earningsYieldPct: number | null; dividendYieldPct: number | null;
  };
  sector: {
    name: string | null; peers: number; peersWithOfficialRatios: number;
    medianPe: number | null; medianPb: number | null; medianDividendYield: number | null; medianReturn1y: number | null;
    pePercentile: number | null; return1yPercentile: number | null;
  };
  earnings: { fiscalYear: number; eps: number | null; netProfit: number | null }[];
  flaggedMoves: { from: string; to: string; changePct: number }[];
  notes: string[];
}

// ── pure helpers (exported for tests) ────────────────────────────────────────────────────────────
const r2 = (n: number) => Math.round(n * 100) / 100;

export function median(values: number[]): number | null {
  const v = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!v.length) return null;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

/** Share of values strictly below `value`, as 0–100. */
export function percentile(value: number, population: number[]): number | null {
  const pop = population.filter(Number.isFinite);
  if (!pop.length || !Number.isFinite(value)) return null;
  return Math.round((pop.filter(v => v < value).length / pop.length) * 100);
}

const addDays = (date: string, n: number) => new Date(new Date(date + "T00:00:00Z").getTime() + n * 86400000).toISOString().slice(0, 10);

/** Last bar on or before `date`. */
function barOnOrBefore(bars: { date: string; close: number }[], date: string) {
  let lo = 0, hi = bars.length - 1, found = -1;
  while (lo <= hi) { const mid = (lo + hi) >> 1; if (bars[mid].date <= date) { found = mid; lo = mid + 1; } else hi = mid - 1; }
  return found >= 0 ? bars[found] : null;
}

/** Close-to-close return over a calendar window ending at the last bar; null when history does not reach back. */
export function periodReturn(bars: { date: string; close: number }[], startDate: string): { from: string; to: string; pct: number } | null {
  if (bars.length < 2 || bars[0].date > startDate) return null;
  const start = barOnOrBefore(bars, startDate);
  const end = bars[bars.length - 1];
  if (!start || start.date === end.date || start.close <= 0) return null;
  return { from: start.date, to: end.date, pct: r2((end.close / start.close - 1) * 100) };
}

export function dailyReturns(bars: { date: string; close: number }[]): Map<string, number> {
  const out = new Map<string, number>();
  for (let i = 1; i < bars.length; i++) out.set(bars[i].date, Math.log(bars[i].close / bars[i - 1].close));
  return out;
}

export function annualizedVolatility(bars: { date: string; close: number }[]): number | null {
  const r = [...dailyReturns(bars).values()];
  if (r.length < 20) return null;
  const mean = r.reduce((a, b) => a + b, 0) / r.length;
  const variance = r.reduce((a, b) => a + (b - mean) ** 2, 0) / (r.length - 1);
  return r2(Math.sqrt(variance) * Math.sqrt(SESSIONS_PER_YEAR) * 100);
}

export function maxDrawdown(bars: { date: string; close: number }[]) {
  if (bars.length < 2) return null;
  let peak = bars[0], worst = 0, worstPeak = bars[0], worstTrough = bars[0];
  for (const b of bars) {
    if (b.close > peak.close) peak = b;
    const dd = b.close / peak.close - 1;
    if (dd < worst) { worst = dd; worstPeak = peak; worstTrough = b; }
  }
  return { pct: r2(worst * 100), peak: worstPeak.date, trough: worstTrough.date };
}

/** Beta and correlation of daily log returns on dates where both the stock and the index have a session. */
export function betaVsIndex(stock: { date: string; close: number }[], index: { date: string; close: number }[]) {
  const s = dailyReturns(stock), m = dailyReturns(index);
  const pairs: [number, number][] = [];
  for (const [d, rs] of s) { const rm = m.get(d); if (rm !== undefined) pairs.push([rs, rm]); }
  if (pairs.length < 60) return null;
  const ms = pairs.reduce((a, p) => a + p[0], 0) / pairs.length, mm = pairs.reduce((a, p) => a + p[1], 0) / pairs.length;
  let cov = 0, vs = 0, vm = 0;
  for (const [a, b] of pairs) { cov += (a - ms) * (b - mm); vs += (a - ms) ** 2; vm += (b - mm) ** 2; }
  if (vm === 0 || vs === 0) return null;
  return { beta: r2(cov / vm), correlation: r2(cov / Math.sqrt(vs * vm)), sessions: pairs.length };
}

const sma = (bars: { close: number }[], n: number) => bars.length >= n ? bars.slice(-n).reduce((a, b) => a + b.close, 0) / n : null;

// ── data access (cached by file modification time) ───────────────────────────────────────────────
function readIndexCloses(baseDir: string, name: string): { date: string; close: number }[] {
  const file = path.join(baseDir, "data", "history", "indices", `${name}.csv`);
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, "utf8").split(/\r?\n/).slice(1).filter(Boolean)
    .map(l => { const c = l.split(","); return { date: c[0], close: Number(c[4]) }; })
    .filter(r => r.close > 0);
}

function readJson<T>(file: string): T | null { try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return null; } }

interface Ratios { eps: number | null; nav: number | null; dividendYield: number | null; period?: string; sourceUrl?: string; source?: string; retrievedAt?: string }
function officialRatios(baseDir: string, symbol: string): Ratios | null {
  const r = readJson<Ratios>(path.join(baseDir, "data", "dse", "financials", `${symbol}_ratios.json`));
  return r && r.source === "DSE_OFFICIAL" ? r : null;
}

interface UniverseStats { symbol: string; vol: number | null; ret1y: number | null; avgValue20: number | null; lastClose: number | null; }
let universeCache: { key: string; stats: Map<string, UniverseStats>; marketSessions: string[] } | null = null;

/** Per-symbol stats for every website security with history; recomputed when the coverage summary changes. */
function universe(baseDir: string, symbols: string[]) {
  const summary = path.join(baseDir, "data", "history", "processed", "coverage-summary.json");
  const key = `${baseDir}|${fs.existsSync(summary) ? fs.statSync(summary).mtimeMs : 0}|${symbols.length}`;
  if (universeCache?.key === key) return universeCache;
  const stats = new Map<string, UniverseStats>();
  for (const sym of symbols) {
    const bars = readStockHistory(sym, baseDir);
    if (bars.length < 2) continue;
    const last = bars[bars.length - 1];
    const yearBars = bars.filter(b => b.date > addDays(last.date, -365));
    const recent = bars.slice(-20);
    stats.set(sym, {
      symbol: sym,
      vol: annualizedVolatility(yearBars),
      ret1y: periodReturn(bars, addDays(last.date, -365))?.pct ?? null,
      avgValue20: recent.length ? recent.reduce((a, b) => a + b.close * b.volume, 0) / recent.length : null,
      lastClose: last.close,
    });
  }
  const dsex = readIndexCloses(baseDir, "DSEX");
  universeCache = { key, stats, marketSessions: dsex.map(d => d.date) };
  return universeCache;
}

/** Highest daily high / lowest daily low of the given bars, with the last close's position in that range. */
function rangeOf(yearBars: HistoryBar[]): StockAnalytics["range52w"] {
  if (yearBars.length < 2) return null;
  const lastClose = yearBars[yearBars.length - 1].close;
  const hi = yearBars.reduce((a, b) => (b.high > a.high ? b : a)), lo = yearBars.reduce((a, b) => (b.low < a.low ? b : a));
  return {
    high: hi.high, highDate: hi.date, low: lo.low, lowDate: lo.date,
    positionPct: hi.high > lo.low ? r2(((lastClose - lo.low) / (hi.high - lo.low)) * 100) : 50,
    fromHighPct: r2((lastClose / hi.high - 1) * 100), fromLowPct: r2((lastClose / lo.low - 1) * 100),
  };
}

/** 52-week range from stored daily bars (last 365 days up to the latest session). */
export function range52wFor(symbol: string, baseDir = process.cwd()): StockAnalytics["range52w"] {
  const bars = readStockHistory(symbol.toUpperCase().trim(), baseDir);
  if (!bars.length) return null;
  const start = addDays(bars[bars.length - 1].date, -365);
  return rangeOf(bars.filter(b => b.date > start));
}

export interface PeerInfo { symbol: string; sector: string | null }

export function computeStockAnalytics(symbol: string, peers: PeerInfo[], baseDir = process.cwd()): StockAnalytics {
  const sym = symbol.toUpperCase().trim();
  const bars: HistoryBar[] = fs.existsSync(stockHistoryPath(sym, baseDir)) ? readStockHistory(sym, baseDir) : [];
  const dsex = readIndexCloses(baseDir, "DSEX");
  const notes: string[] = ["Prices are not adjusted for dividends, bonus or rights issues; returns include those price drops."];
  const sectorName = peers.find(p => p.symbol === sym)?.sector ?? null;
  const uni = universe(baseDir, peers.map(p => p.symbol));
  const ratios = officialRatios(baseDir, sym);

  const last = bars[bars.length - 1];
  const lastClose = last?.close ?? null;
  const asOf = last?.date ?? null;

  // Returns vs DSEX
  const returns: PeriodReturn[] = [];
  if (last) {
    const windows: [string, string, string][] = [
      ["1M", "1 month", addDays(last.date, -30)], ["3M", "3 months", addDays(last.date, -91)],
      ["6M", "6 months", addDays(last.date, -182)], ["YTD", "Year to date", `${Number(last.date.slice(0, 4)) - 1}-12-31`],
      ["1Y", "1 year", addDays(last.date, -365)], ["MAX", `Since ${bars[0].date}`, bars[0].date],
    ];
    for (const [key, label, start] of windows) {
      const r = periodReturn(bars, start);
      if (!r) continue;
      const startIdx = barOnOrBefore(dsex, r.from), endIdx = barOnOrBefore(dsex, r.to);
      const dsexPct = startIdx && endIdx && startIdx.date !== endIdx.date ? r2((endIdx.close / startIdx.close - 1) * 100) : null;
      returns.push({ key, label, from: r.from, to: r.to, pct: r.pct, dsexPct });
    }
  }

  // Relative performance (rebased to 100) over the last year, one point per stock session
  const yearStart = last ? addDays(last.date, -365) : "";
  const yearBars = bars.filter(b => b.date > yearStart);
  const base = yearBars[0], dsexBase = base ? barOnOrBefore(dsex, base.date) : null;
  const relative = base ? yearBars.map(b => {
    const d = barOnOrBefore(dsex, b.date);
    return { date: b.date, stock: r2((b.close / base.close) * 100), dsex: d && dsexBase ? r2((d.close / dsexBase.close) * 100) : null };
  }) : [];

  const range52w = rangeOf(yearBars);

  // Risk
  const vol = annualizedVolatility(yearBars);
  const allVols = [...uni.stats.values()].map(s => s.vol).filter((v): v is number => v !== null);
  const dd = maxDrawdown(yearBars);
  const dsexYear = dsex.filter(d => d.date > yearStart);
  const b = betaVsIndex(yearBars, dsexYear);

  // Trend
  const s50 = sma(bars, 50), s200 = sma(bars, 200);

  // Liquidity: traded sessions vs market sessions over the last year
  // Window = the last 365 days of the market, so a security that stopped trading still shows its gap
  const marketLast = uni.marketSessions[uni.marketSessions.length - 1];
  const marketYearStart = marketLast ? addDays(marketLast, -365) : "";
  const marketYear = marketLast ? uni.marketSessions.filter(d => d > marketYearStart) : [];
  const tradedInMarketYear = bars.filter(b => b.date > marketYearStart).length;
  const recent = bars.slice(-20);
  const avgValue20 = recent.length ? recent.reduce((a, x) => a + x.close * x.volume, 0) / recent.length : null;
  const allValues = [...uni.stats.values()].map(s => s.avgValue20).filter((v): v is number => v !== null);
  if (marketYear.length && tradedInMarketYear < marketYear.length) {
    notes.push(`Traded on ${tradedInMarketYear} of ${marketYear.length} DSE sessions in the last year; days without trades are left out, not filled in.`);
  }

  // Valuation (official EPS / NAV only), priced at the last stored close
  const eps = ratios?.eps ?? null, nav = ratios?.nav ?? null;
  const pe = eps && eps > 0 && lastClose ? r2(lastClose / eps) : null;
  const pb = nav && nav > 0 && lastClose ? r2(lastClose / nav) : null;
  if (!ratios) notes.push("EPS and NAV have not been fetched from this company's DSE page yet, so valuation ratios are not shown.");
  else if (eps !== null && eps <= 0) notes.push("EPS is zero or negative, so P/E is not meaningful.");

  // Sector peers: valuation only from peers with official ratios; returns from peers' stored history
  const sectorPeers = sectorName ? peers.filter(p => p.sector === sectorName) : [];
  const peerPe: number[] = [], peerPb: number[] = [], peerDy: number[] = [], peerRet: number[] = [];
  let withRatios = 0;
  for (const p of sectorPeers) {
    const st = uni.stats.get(p.symbol);
    if (st?.ret1y != null) peerRet.push(st.ret1y);
    const pr = officialRatios(baseDir, p.symbol);
    if (!pr || !st?.lastClose) continue;
    withRatios++;
    if (pr.eps && pr.eps > 0) peerPe.push(st.lastClose / pr.eps);
    if (pr.nav && pr.nav > 0) peerPb.push(st.lastClose / pr.nav);
    if (pr.dividendYield != null && Number.isFinite(pr.dividendYield)) peerDy.push(pr.dividendYield);
  }
  const ret1y = returns.find(r => r.key === "1Y")?.pct ?? null;
  const allRet = [...uni.stats.values()].map(s => s.ret1y).filter((v): v is number => v !== null);

  // Fiscal-year earnings from DSE statements
  const statements = readJson<{ fiscalYear: number; eps: number | null; netProfit: number | null; source?: string; periodType?: string }[]>(
    path.join(baseDir, "data", "dse", "financials", `${sym}_statements.json`)) || [];
  const earnings = statements
    .filter(s => s.source === "DSE_OFFICIAL" && (s.periodType ?? "Annual") === "Annual" && (s.eps !== null || s.netProfit !== null))
    .map(s => ({ fiscalYear: s.fiscalYear, eps: s.eps, netProfit: s.netProfit }))
    .sort((a, z) => a.fiscalYear - z.fiscalYear);

  // Large one-day moves flagged by the loader (possible corporate actions)
  const disc = readJson<{ items: { symbol: string; from: string; to: string; change: number }[] }>(
    path.join(baseDir, "data", "history", "processed", "discontinuities.json"));
  const flaggedMoves = (disc?.items || []).filter(i => i.symbol === sym).map(i => ({ from: i.from, to: i.to, changePct: r2(i.change * 100) }));

  return {
    symbol: sym, asOf,
    history: bars.length ? { source: "DSE_OFFICIAL", firstDate: bars[0].date, lastDate: last.date, sessions: bars.length, adjusted: false } : null,
    lastClose, returns, relative, range52w,
    risk: {
      volatilityPct: vol, volatilityPercentile: vol !== null ? percentile(vol, allVols) : null,
      maxDrawdownPct: dd?.pct ?? null, drawdownPeak: dd?.peak ?? null, drawdownTrough: dd?.trough ?? null,
      beta: b?.beta ?? null, correlation: b?.correlation ?? null, window: yearBars.length ? `${yearBars[0].date} to ${asOf}` : null,
    },
    trend: {
      sma50: s50 !== null ? r2(s50) : null, sma200: s200 !== null ? r2(s200) : null,
      vsSma50Pct: s50 && lastClose ? r2((lastClose / s50 - 1) * 100) : null,
      vsSma200Pct: s200 && lastClose ? r2((lastClose / s200 - 1) * 100) : null,
    },
    liquidity: {
      avgVolume20: recent.length ? Math.round(recent.reduce((a, x) => a + x.volume, 0) / recent.length) : null,
      avgValue20Bdt: avgValue20 !== null ? Math.round(avgValue20) : null,
      tradedSessionsPct: marketYear.length ? r2(Math.min(100, (tradedInMarketYear / marketYear.length) * 100)) : null,
      tradedSessions: marketYear.length ? tradedInMarketYear : null, marketSessions: marketYear.length || null,
      liquidityPercentile: avgValue20 !== null ? percentile(avgValue20, allValues) : null,
    },
    marketRank: { return1yPercentile: ret1y !== null ? percentile(ret1y, allRet) : null, universe: uni.stats.size },
    valuation: {
      official: !!ratios, ratioDate: ratios?.period ?? null, sourceUrl: ratios?.sourceUrl ?? null,
      eps, nav, pe, pb, earningsYieldPct: pe ? r2(100 / pe) : null, dividendYieldPct: ratios?.dividendYield != null ? r2(ratios.dividendYield) : null,
    },
    sector: {
      name: sectorName, peers: sectorPeers.length, peersWithOfficialRatios: withRatios,
      medianPe: peerPe.length >= 3 ? r2(median(peerPe)!) : null, medianPb: peerPb.length >= 3 ? r2(median(peerPb)!) : null,
      medianDividendYield: peerDy.length >= 3 ? r2(median(peerDy)!) : null, medianReturn1y: peerRet.length >= 3 ? r2(median(peerRet)!) : null,
      pePercentile: pe !== null && peerPe.length >= 3 ? percentile(pe, peerPe) : null,
      return1yPercentile: ret1y !== null && peerRet.length >= 3 ? percentile(ret1y, peerRet) : null,
    },
    earnings, flaggedMoves, notes,
  };
}
