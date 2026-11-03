import fs from "fs";
import path from "path";

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

// Memory cache to prevent duplicate file parsing and processing
const processedCache = new Map<string, CleanBar[]>();

/**
 * Checks for missing dates, duplicate entries, invalid rows,
 * and performs dynamic corporate action adjustments (splits, bonuses, etc.)
 */
export const HistoricalDataService = {
  /**
   * Clears the memory cache
   */
  clearCache(): void {
    processedCache.clear();
  },

  /**
   * Standardizes date formats to YYYY-MM-DD
   */
  normalizeDate(dateStr: string): string | null {
    if (!dateStr) return null;
    const clean = dateStr.trim().replace(/^"|"$/g, "");
    const d = new Date(clean);
    if (isNaN(d.getTime())) return null;
    
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  },

  /**
   * Processes, validates, gap-fills, and split-adjusts a raw bar list.
   */
  cleanAndValidateHistory(symbol: string, rawBars: any[]): CleanBar[] {
    const sym = symbol.toUpperCase().trim();
    if (rawBars.length === 0) return [];

    // 1. Remove duplicate dates and parse values
    const uniqueBarsMap = new Map<string, CleanBar>();
    for (const raw of rawBars) {
      if (!raw.date) continue;
      const date = this.normalizeDate(raw.date);
      if (!date) continue;

      const close = parseFloat(raw.close ?? raw.ltp ?? 0);
      if (close <= 0 || isNaN(close)) continue;

      const open = parseFloat(raw.open ?? close);
      const high = parseFloat(raw.high ?? close);
      const low = parseFloat(raw.low ?? close);
      const volume = parseInt(raw.volume ?? "0", 10);

      const parsed: CleanBar = {
        date,
        symbol: sym,
        open: isNaN(open) || open <= 0 ? close : open,
        high: isNaN(high) || high <= 0 || high < Math.min(open, close) ? close : high,
        low: isNaN(low) || low <= 0 || low > Math.max(open, close) ? close : low,
        close,
        volume: isNaN(volume) ? 0 : volume,
        source: raw.source || "Default"
      };

      // Ensure high is highest and low is lowest
      parsed.high = Math.max(parsed.open, parsed.close, parsed.high);
      parsed.low = Math.min(parsed.open, parsed.close, parsed.low);

      uniqueBarsMap.set(date, parsed);
    }

    // 2. Sort chronologically ascending
    let sortedBars = Array.from(uniqueBarsMap.values()).sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    if (sortedBars.length === 0) return [];

    // 3. Detect and Fill missing trading days (gops/holidays)
    // In Bangladesh, the standard trading week is Sunday - Thursday.
    // Friday and Saturday are weekends.
    const filledBars: CleanBar[] = [];
    for (let i = 0; i < sortedBars.length; i++) {
      const current = sortedBars[i];
      if (filledBars.length === 0) {
        filledBars.push(current);
        continue;
      }

      const prev = filledBars[filledBars.length - 1];
      const prevDate = new Date(prev.date);
      const currDate = new Date(current.date);
      
      const diffTime = currDate.getTime() - prevDate.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

      // If gap is wider than 1 day, fill in the intermediate business days
      if (diffDays > 1) {
        const loopDate = new Date(prevDate);
        for (let d = 1; d < diffDays; d++) {
          loopDate.setDate(loopDate.getDate() + 1);
          const dayOfWeek = loopDate.getDay();
          // Friday (5) and Saturday (6) are standard weekend days in Bangladesh, skip them
          if (dayOfWeek !== 5 && dayOfWeek !== 6) {
            const filledDateStr = loopDate.toISOString().split("T")[0];
            filledBars.push({
              date: filledDateStr,
              symbol: sym,
              open: prev.close,
              high: prev.close,
              low: prev.close,
              close: prev.close,
              volume: 0,
              source: "GapFilled"
            });
          }
        }
      }
      filledBars.push(current);
    }

    // 4. Dynamic Stock Split/Bonus Share/Corporate Actions Adjustment Backwards
    // Detects artificial drops where price drops by more than ~15% in a single day
    // without normal market cause (indicating a corporate adjustment).
    // Adjusts historical records prior to that session backwards dynamically.
    for (let i = filledBars.length - 1; i >= 1; i--) {
      const curr = filledBars[i];
      const prev = filledBars[i - 1];

      if (prev.close > 10 && curr.close / prev.close < 0.82) {
        // Price dropped by > 18%. This is highly indicative of a split, stock dividend, or rights issue
        const ratioRaw = prev.close / curr.close;
        let adjustmentFactor = ratioRaw;

        // Standardize to common DSE ratios
        if (Math.abs(ratioRaw - 10.0) < 1.0) {
          adjustmentFactor = 10.0; // 10-for-1 split
        } else if (Math.abs(ratioRaw - 2.0) < 0.25) {
          adjustmentFactor = 2.0;  // 1:1 bonus / 100% stock dividend
        } else if (Math.abs(ratioRaw - 1.5) < 0.15) {
          adjustmentFactor = 1.5;  // 1:2 bonus / 50% stock dividend
        } else if (Math.abs(ratioRaw - 1.2) < 0.1) {
          adjustmentFactor = 1.2;  // 1:5 bonus / 20% stock dividend
        } else if (Math.abs(ratioRaw - 1.1) < 0.05) {
          adjustmentFactor = 1.1;  // 1:10 bonus / 10% stock dividend
        } else if (Math.abs(ratioRaw - 1.05) < 0.03) {
          adjustmentFactor = 1.05; // 5% stock dividend
        }

        // Apply backward adjustment for all historical bars older than this index
        for (let j = 0; j < i; j++) {
          filledBars[j].open /= adjustmentFactor;
          filledBars[j].high /= adjustmentFactor;
          filledBars[j].low /= adjustmentFactor;
          filledBars[j].close /= adjustmentFactor;
          filledBars[j].volume *= adjustmentFactor;

          // Round prices for presentation
          filledBars[j].open = parseFloat(filledBars[j].open.toFixed(2));
          filledBars[j].high = parseFloat(filledBars[j].high.toFixed(2));
          filledBars[j].low = parseFloat(filledBars[j].low.toFixed(2));
          filledBars[j].close = parseFloat(filledBars[j].close.toFixed(2));
          filledBars[j].volume = Math.round(filledBars[j].volume);
          filledBars[j].source = `${filledBars[j].source}_Adjusted_${adjustmentFactor.toFixed(2)}`;
        }
      }
    }

    return filledBars;
  },

  /**
   * Retrieves clean historical data on-the-fly for any stock symbol.
   * Auto loads from either clean stock file, imported investing raw dataset, or dse raw exports.
   */
  getValidatedHistory(symbol: string, daysLimit?: number): CleanBar[] {
    const sym = symbol.toUpperCase().trim();
    const cacheKey = `${sym}_${daysLimit || "MAX"}`;

    if (processedCache.has(cacheKey)) {
      return processedCache.get(cacheKey)!;
    }

    // Try finding files across possible source directories
    const safeSym = sym.replace(/\(/g, "_").replace(/\)/g, ""); // AMCL(PRAN) -> AMCL_PRAN
    const dseCleanPath = path.join(process.cwd(), "data", "history", "stocks", `${sym}.csv`);
    const dseSafePath = path.join(process.cwd(), "data", "history", "stocks", `${safeSym}.csv`);
    const investingImportPath = path.join(process.cwd(), "data", "history", "imports", "investing", "stocks", `${sym}.csv`);
    const investingSafePath = path.join(process.cwd(), "data", "history", "imports", "investing", "stocks", `${safeSym}.csv`);
    const dseDirectImportPath = path.join(process.cwd(), "data", "history", "imports", "dse-history.csv");

    let rawBars: any[] = [];
    let fileSource = "None";

    // Scenario A: Check clean stocks file first (has metadata columns)
    const activeCleanPath = fs.existsSync(dseSafePath) ? dseSafePath : (fs.existsSync(dseCleanPath) ? dseCleanPath : null);
    if (activeCleanPath) {
      try {
        const fileContent = fs.readFileSync(activeCleanPath, "utf-8");
        rawBars = this.parseCSV(fileContent, sym);
        fileSource = "DSEClean";
      } catch (err) {
        console.warn(`[HistoricalDataService] Failed to parse dseCleanPath for ${sym}:`, err);
      }
    }

    // Scenario B: If empty/not found, import directly from raw Investing.com Manual Export CSV
    const activeInvestingPath = fs.existsSync(investingSafePath) ? investingSafePath : (fs.existsSync(investingImportPath) ? investingImportPath : null);
    if (rawBars.length === 0 && activeInvestingPath) {
      try {
        const fileContent = fs.readFileSync(activeInvestingPath, "utf-8");
        rawBars = this.parseCSV(fileContent, sym);
        fileSource = "InvestingRaw";
      } catch (err) {
        console.warn(`[HistoricalDataService] Failed to parse investingImportPath for ${sym}:`, err);
      }
    }

    // Scenario C: If still empty, search the master dse-history.csv file
    if (rawBars.length === 0 && fs.existsSync(dseDirectImportPath)) {
      try {
        const fileContent = fs.readFileSync(dseDirectImportPath, "utf-8");
        rawBars = this.parseCSV(fileContent, sym).filter((b: any) => b.symbol === sym);
        fileSource = "DSEDirectImport";
      } catch (err) {
        console.warn(`[HistoricalDataService] Failed to parse dseDirectImportPath for ${sym}:`, err);
      }
    }

    // Clean, validate, gap-fill, and split-adjust the bars
    const cleanBars = this.cleanAndValidateHistory(sym, rawBars);

    // Read paths must not write into data/history: a write-back here created files in a non-standard
    // format on ordinary GET requests. Persisting cleaned history is the import scripts' job.

    // Slice based on requested days
    const result = daysLimit ? cleanBars.slice(-daysLimit) : cleanBars;
    processedCache.set(cacheKey, result);
    return result;
  },

  /**
   * Helper to parse general CSV formats with headers dynamically
   */
  parseCSV(content: string, symbol: string): any[] {
    const lines = content.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (lines.length <= 1) return [];

    const headers = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g, "").toLowerCase());
    const dateIdx = headers.findIndex(h => h === "date" || h === "timestamp");
    const openIdx = headers.findIndex(h => h === "open" || h === "open_price");
    const highIdx = headers.findIndex(h => h === "high" || h === "high_price");
    const lowIdx = headers.findIndex(h => h === "low" || h === "low_price");
    const closeIdx = headers.findIndex(h => h === "close" || h === "price" || h === "close_price" || h === "last_traded_price" || h === "ltp");
    const volIdx = headers.findIndex(h => h === "volume" || h === "vol." || h === "vol" || h === "total_volume");
    const symbolIdx = headers.findIndex(h => h === "trading code" || h === "symbol" || h === "ticker");

    const bars: any[] = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      const cols = this.parseCSVLine(line);
      if (cols.length < Math.min(3, headers.length)) continue;

      const rowDate = dateIdx !== -1 ? cols[dateIdx] : cols[0];
      const rowCloseStr = closeIdx !== -1 ? cols[closeIdx] : cols[4] || cols[1];
      const rowOpenStr = openIdx !== -1 ? cols[openIdx] : cols[1];
      const rowHighStr = highIdx !== -1 ? cols[highIdx] : cols[2];
      const rowLowStr = lowIdx !== -1 ? cols[lowIdx] : cols[3];

      let volVal = 0;
      if (volIdx !== -1) {
        const volStr = cols[volIdx]?.toUpperCase() || "";
        if (volStr.endsWith("K")) volVal = parseFloat(volStr.slice(0, -1)) * 1000;
        else if (volStr.endsWith("M")) volVal = parseFloat(volStr.slice(0, -1)) * 1000000;
        else if (volStr.endsWith("B")) volVal = parseFloat(volStr.slice(0, -1)) * 1000000000;
        else volVal = parseFloat(volStr.replace(/,/g, ""));
      }

      bars.push({
        date: rowDate,
        symbol: symbolIdx !== -1 ? cols[symbolIdx]?.toUpperCase().trim() : symbol,
        open: parseFloat(rowOpenStr?.replace(/,/g, "") || "0"),
        high: parseFloat(rowHighStr?.replace(/,/g, "") || "0"),
        low: parseFloat(rowLowStr?.replace(/,/g, "") || "0"),
        close: parseFloat(rowCloseStr?.replace(/,/g, "") || "0"),
        volume: isNaN(volVal) ? 0 : volVal,
        source: "CSV"
      });
    }

    return bars;
  },

  /**
   * Honors quoted commas inside CSV lines
   */
  parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  }
};
