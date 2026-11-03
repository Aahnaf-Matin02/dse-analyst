import fs from "fs";
import path from "path";

export interface HistoricalBar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  sma20?: number;
  ema50?: number;
  rsi?: number;
}

export const HistoryRepository = {
  getHistoricalData(symbol: string): { source: "HistoricalData" | "NoHistoricalData"; data: HistoricalBar[] } {
    const sym = symbol.toUpperCase().trim();
    const safeSym = sym.replace(/[()]/g, "_");
    const jsonPath = path.join(process.cwd(), "data", "history", `${sym}.json`);
    const csvPath = path.join(process.cwd(), "data", "history", `${sym}.csv`);
    const stocksCsvPath = path.join(process.cwd(), "data", "history", "stocks", `${sym}.csv`);
    const stocksSafeCsvPath = path.join(process.cwd(), "data", "history", "stocks", `${safeSym}.csv`);

    let rawData: HistoricalBar[] = [];

    // 1. Try JSON history
    try {
      if (fs.existsSync(jsonPath)) {
        const content = fs.readFileSync(jsonPath, "utf-8");
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed)) {
          rawData = parsed;
        }
      }
    } catch (err) {
      console.warn(`[HistoryRepository] Failed to read JSON history for ${sym}:`, err);
    }

    // 2. Try CSV history if JSON is empty/not present
    if (rawData.length === 0) {
      try {
        const targetCsv = fs.existsSync(stocksSafeCsvPath)
          ? stocksSafeCsvPath
          : (fs.existsSync(stocksCsvPath) ? stocksCsvPath : (fs.existsSync(csvPath) ? csvPath : null));

        if (targetCsv) {
          const content = fs.readFileSync(targetCsv, "utf-8");
          const lines = content.split(/\r?\n/);
          
          let startIndex = 0;
          if (lines.length > 0 && lines[0].toLowerCase().includes("date")) {
            startIndex = 1;
          }

          for (let i = startIndex; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            const cols = line.split(",");
            if (cols.length >= 6) {
              const date = cols[0].trim();
              const open = parseFloat(cols[1]);
              const high = parseFloat(cols[2]);
              const low = parseFloat(cols[3]);
              const close = parseFloat(cols[4]);
              const volume = parseInt(cols[5], 10);

              if (date && !isNaN(open) && !isNaN(high) && !isNaN(low) && !isNaN(close)) {
                rawData.push({ 
                  date, 
                  open: parseFloat(open.toFixed(2)), 
                  high: parseFloat(high.toFixed(2)), 
                  low: parseFloat(low.toFixed(2)), 
                  close: parseFloat(close.toFixed(2)), 
                  volume: isNaN(volume) ? 0 : volume 
                });
              }
            }
          }
        }
      } catch (err) {
        console.warn(`[HistoryRepository] Failed to read CSV history for ${sym}:`, err);
      }
    }

    if (rawData.length > 0) {
      // Sort chronologically (ascending order of date)
      rawData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      return { source: "HistoricalData", data: rawData };
    }

    return { source: "NoHistoricalData", data: [] };
  },

  computeCoverage(universeSymbols: string[]): number {
    if (!universeSymbols || universeSymbols.length === 0) return 0;
    let withHistory = 0;
    for (const sym of universeSymbols) {
      const safeSym = sym.replace(/[()]/g, "_");
      const candidates = [
        path.join(process.cwd(), "data", "history", `${sym}.json`),
        path.join(process.cwd(), "data", "history", `${sym}.csv`),
        path.join(process.cwd(), "data", "history", "stocks", `${sym}.csv`),
        path.join(process.cwd(), "data", "history", "stocks", `${safeSym}.csv`),
        path.join(process.cwd(), "data", "history", "stocks", `${sym}.json`),
        path.join(process.cwd(), "data", "history", "stocks", `${safeSym}.json`),
        path.join(process.cwd(), "data", "dse", "historical", `${sym}.json`)
      ];
      if (candidates.some(p => fs.existsSync(p))) {
        withHistory++;
      }
    }
    return parseFloat(((withHistory / universeSymbols.length) * 100).toFixed(1));
  }
};
