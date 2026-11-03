import fs from "fs";
import path from "path";

/**
 * Single definition of how daily price history is stored:
 *   data/history/stocks/<SAFE_SYMBOL>.csv   header: date,open,high,low,close,volume,source
 * Values are stored exactly as reported by the source (unadjusted). Nothing here creates,
 * interpolates or estimates rows.
 */

export const HISTORY_HEADER = "date,open,high,low,close,volume,source";

/** Real sources only, in order of preference when two sources disagree about the same date. */
export const SOURCE_PREFERENCE = ["DSE_OFFICIAL", "LankaBD", "InvestingCSV"] as const;
export type HistorySourceLabel = (typeof SOURCE_PREFERENCE)[number];
export const ALLOWED_SOURCES: readonly string[] = SOURCE_PREFERENCE;

export interface HistoryBar {
  date: string; // YYYY-MM-DD
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  source: HistorySourceLabel;
}

export function historyRoot(baseDir = process.cwd()): string {
  return path.join(baseDir, "data", "history");
}

/**
 * Filesystem/URL-safe name for a DSE trading code. Keeps plain codes unchanged and maps the few
 * codes with special characters: AMCL(PRAN) -> AMCL_PRAN, KAY&QUE -> KAY_QUE.
 */
export function safeSymbolFileName(symbol: string): string {
  return symbol
    .trim()
    .toUpperCase()
    .replace(/\)/g, "")
    .replace(/[^A-Z0-9.-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

export function stockHistoryPath(symbol: string, baseDir = process.cwd()): string {
  return path.join(historyRoot(baseDir), "stocks", `${safeSymbolFileName(symbol)}.csv`);
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Returns why a row is invalid, or null if it is acceptable. Never repairs values.
 * `officialTradingDays`: dates on which DSE itself reports a market-wide session — DSE holds rare
 * make-up sessions on Saturdays, which must not be rejected as "weekend" rows.
 */
export function validateBar(bar: Partial<HistoryBar> & { date?: string }, officialTradingDays?: Set<string>): string | null {
  if (!bar.date || !ISO_DATE.test(bar.date) || isNaN(new Date(bar.date + "T00:00:00Z").getTime())) return "invalid date";
  const nums = [bar.open, bar.high, bar.low, bar.close];
  if (nums.some(v => typeof v !== "number" || !Number.isFinite(v))) return "missing or non-numeric price";
  const [open, high, low, close] = nums as number[];
  if (open <= 0 || high <= 0 || low <= 0 || close <= 0) return "price <= 0 (DSE reports 0 when a security did not trade)";
  if (high < low) return "high below low";
  if (high < Math.max(open, close) - 1e-9) return "high below open/close";
  if (low > Math.min(open, close) + 1e-9) return "low above open/close";
  if (typeof bar.volume !== "number" || !Number.isFinite(bar.volume) || bar.volume < 0) return "volume < 0 or missing";
  const dow = new Date(bar.date + "T00:00:00Z").getUTCDay(); // 5 = Fri, 6 = Sat
  if ((dow === 5 || dow === 6) && !(officialTradingDays && officialTradingDays.has(bar.date))) return "Friday/Saturday date that is not an official DSE session";
  if (!bar.source || !ALLOWED_SOURCES.includes(bar.source)) return `unknown source label "${bar.source ?? ""}"`;
  return null;
}

export function parseHistoryFile(content: string): HistoryBar[] {
  const lines = content.split(/\r?\n/).filter(l => l.trim() !== "");
  if (lines.length === 0) return [];
  if (lines[0].trim() !== HISTORY_HEADER) throw new Error(`Unexpected history header: "${lines[0].trim()}"`);
  return lines.slice(1).map(line => {
    const [date, open, high, low, close, volume, source] = line.split(",");
    return { date, open: Number(open), high: Number(high), low: Number(low), close: Number(close), volume: Number(volume), source: source as HistorySourceLabel };
  });
}

export function serializeHistoryFile(bars: HistoryBar[]): string {
  const sorted = [...bars].sort((a, b) => a.date.localeCompare(b.date));
  return [HISTORY_HEADER, ...sorted.map(b => [b.date, b.open, b.high, b.low, b.close, b.volume, b.source].join(","))].join("\n") + "\n";
}

export function readStockHistory(symbol: string, baseDir = process.cwd()): HistoryBar[] {
  const file = stockHistoryPath(symbol, baseDir);
  if (!fs.existsSync(file)) return [];
  return parseHistoryFile(fs.readFileSync(file, "utf8"));
}

export interface MergeConflict {
  symbol: string;
  date: string;
  kept: HistoryBar;
  discarded: HistoryBar;
  reason: string;
}

const rank = (s: string) => {
  const i = SOURCE_PREFERENCE.indexOf(s as HistorySourceLabel);
  return i === -1 ? Number.MAX_SAFE_INTEGER : i;
};
const sameValues = (a: HistoryBar, b: HistoryBar) =>
  a.open === b.open && a.high === b.high && a.low === b.low && a.close === b.close && a.volume === b.volume;

/**
 * Merge rows by date. On a conflict the more authoritative source wins
 * (DSE_OFFICIAL > LankaBD > InvestingCSV); every disagreement is reported.
 */
export function mergeBars(symbol: string, existing: HistoryBar[], incoming: HistoryBar[]): { merged: HistoryBar[]; conflicts: MergeConflict[]; added: number } {
  const byDate = new Map<string, HistoryBar>(existing.map(b => [b.date, b]));
  const conflicts: MergeConflict[] = [];
  let added = 0;
  for (const bar of incoming) {
    const cur = byDate.get(bar.date);
    if (!cur) { byDate.set(bar.date, bar); added++; continue; }
    if (cur.source === bar.source && sameValues(cur, bar)) continue;
    const winner = rank(bar.source) < rank(cur.source) ? bar : rank(bar.source) > rank(cur.source) ? cur : bar; // same source: newer download wins
    const loser = winner === bar ? cur : bar;
    if (!sameValues(cur, bar)) {
      conflicts.push({ symbol, date: bar.date, kept: winner, discarded: loser, reason: winner.source === loser.source ? "same source re-downloaded with different values (newer kept)" : `${winner.source} preferred over ${loser.source}` });
    }
    byDate.set(bar.date, winner);
  }
  return { merged: [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date)), conflicts, added };
}

/** Close-to-close moves larger than `threshold` (default 20%): likely dividends/bonus/rights/splits in unadjusted data. */
export function findDiscontinuities(symbol: string, bars: HistoryBar[], threshold = 0.2) {
  const out: { symbol: string; from: string; to: string; prevClose: number; close: number; change: number }[] = [];
  const sorted = [...bars].sort((a, b) => a.date.localeCompare(b.date));
  for (let i = 1; i < sorted.length; i++) {
    const p = sorted[i - 1], c = sorted[i];
    const change = c.close / p.close - 1;
    if (Math.abs(change) > threshold) out.push({ symbol, from: p.date, to: c.date, prevClose: p.close, close: c.close, change: Number(change.toFixed(4)) });
  }
  return out;
}
