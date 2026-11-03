import fs from "fs";
import { readStockHistory, validateBar, HistoryBar, stockHistoryPath } from "./history/historyFiles";

export interface CleanBar {
  date: string; // YYYY-MM-DD
  symbol: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  source: string;
}

// Parsed files are cached per process; the file's mtime is part of the key so reloads pick up new data
const cache = new Map<string, { mtimeMs: number; bars: CleanBar[] }>();

/**
 * Read-only access to stored daily history. Returns exactly the stored rows (sorted, de-duplicated).
 * It never fills gaps, never adjusts for corporate actions, never repairs values and never writes.
 * Rows that fail validation are skipped here; the loader quarantines them with a reason.
 */
export const HistoricalDataService = {
  clearCache(): void {
    cache.clear();
  },

  getValidatedHistory(symbol: string, daysLimit?: number): CleanBar[] {
    const sym = symbol.toUpperCase().trim();
    const file = stockHistoryPath(sym);
    if (!fs.existsSync(file)) return [];
    const mtimeMs = fs.statSync(file).mtimeMs;
    let entry = cache.get(sym);
    if (!entry || entry.mtimeMs !== mtimeMs) {
      let bars: HistoryBar[] = [];
      try {
        bars = readStockHistory(sym);
      } catch (err) {
        console.warn(`[HistoricalDataService] Unreadable history for ${sym}:`, (err as Error).message);
        return [];
      }
      const byDate = new Map<string, CleanBar>();
      // Weekend dates are only stored by the loader when DSE held an official session, so accept them here
      const officialWeekend = new Set(bars.map(b => b.date));
      for (const b of bars) {
        if (validateBar(b, officialWeekend) === null) byDate.set(b.date, { ...b, symbol: sym });
      }
      entry = { mtimeMs, bars: [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date)) };
      cache.set(sym, entry);
    }
    return daysLimit ? entry.bars.slice(-daysLimit) : entry.bars;
  },
};
