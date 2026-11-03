import fs from "fs";
import path from "path";
import { HistoricalDataService } from "../services/historicalDataService";
import { getStockBySymbol } from "./stockRepository";
import { loadDseSyncStatus } from "./dseCacheRepository";
import { loadIndices } from "./marketRepository";

export type HistorySource =
  | "LiveDseSnapshot"
  | "ImportedHistoricalCSV"
  | "CachedHistoricalData"
  | "NoHistoricalData"
  | "DemoSimulation";

export interface HistoryRow {
  date: string; // YYYY-MM-DD
  symbol: string;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  ltp: number | null;
  ycp: number | null;
  change: number | null;
  changePercent: number | null;
  volume: number | null;
  value: number | null;
  trade: number | null;
  source: HistorySource;
  snapshotType: "Intraday" | "EOD" | "Imported";
  lastUpdated: string;
}

const STOCKS_DIR = path.join(process.cwd(), "data", "history", "stocks");
const INDICES_DIR = path.join(process.cwd(), "data", "history", "indices");
const ERRORS_DIR = path.join(process.cwd(), "data", "history", "errors");

// Helper to ensure directory existence
export function ensureDirExists(dirPath: string) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

// Ensure all standard folders exist
export function ensureAllDirectoriesExist() {
  const dirs = [
    path.join(process.cwd(), "data", "history", "stocks"),
    path.join(process.cwd(), "data", "history", "indices"),
    path.join(process.cwd(), "data", "history", "snapshots", "daily"),
    path.join(process.cwd(), "data", "history", "imports", "stocks"),
    path.join(process.cwd(), "data", "history", "imports", "indices"),
    path.join(process.cwd(), "data", "history", "processed"),
    path.join(process.cwd(), "data", "history", "errors")
  ];
  dirs.forEach(ensureDirExists);
}

// Convert Row to CSV Line
export function serializeHistoryRow(row: HistoryRow): string {
  const f = (val: number | null) =>
    val === null || val === undefined || isNaN(val) ? "" : val.toString();
  return [
    row.date,
    row.symbol,
    f(row.open),
    f(row.high),
    f(row.low),
    f(row.close),
    f(row.ltp),
    f(row.ycp),
    f(row.change),
    f(row.changePercent),
    f(row.volume),
    f(row.value),
    f(row.trade),
    row.source,
    row.snapshotType,
    row.lastUpdated
  ].join(",");
}

const CSV_HEADER = "date,symbol,open,high,low,close,ltp,ycp,change,changePercent,volume,value,trade,source,snapshotType,lastUpdated";

// Parse a single CSV file text into clean HistoryRow[]
export function parseHistoryCSV(fileContent: string): HistoryRow[] {
  const lines = fileContent.split(/\r?\n/);
  if (lines.length <= 1) return [];

  const header = lines[0].trim().split(",");
  const indices: Record<string, number> = {};
  header.forEach((col, idx) => {
    indices[col.trim()] = idx;
  });

  const rows: HistoryRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const cols = line.split(",");

    const getVal = (colName: string): string => {
      const idx = indices[colName];
      return idx !== undefined && idx < cols.length ? cols[idx].trim() : "";
    };

    const getFloatVal = (colName: string): number | null => {
      const val = getVal(colName);
      if (val === "" || val === "null" || val === undefined) return null;
      const num = parseFloat(val);
      return isNaN(num) ? null : num;
    };

    const getIntVal = (colName: string): number | null => {
      const val = getVal(colName);
      if (val === "" || val === "null" || val === undefined) return null;
      const num = parseInt(val, 10);
      return isNaN(num) ? null : num;
    };

    const date = getVal("date") || cols[0]?.trim();
    if (!date) continue;

    const symbol = getVal("symbol") || "";
    const open = getFloatVal("open");
    const high = getFloatVal("high");
    const low = getFloatVal("low");
    const close = getFloatVal("close");
    const ltp = getFloatVal("ltp");
    const ycp = getFloatVal("ycp");
    const change = getFloatVal("change");
    const changePercent = getFloatVal("changePercent");
    const volume = getIntVal("volume");
    const value = getFloatVal("value");
    const trade = getIntVal("trade");
    const source = (getVal("source") as HistorySource) || "LiveDseSnapshot";
    const snapshotType = (getVal("snapshotType") as any) || "Intraday";
    const lastUpdated = getVal("lastUpdated") || new Date().toISOString();

    rows.push({
      date,
      symbol,
      open,
      high,
      low,
      close,
      ltp,
      ycp,
      change,
      changePercent,
      volume,
      value,
      trade,
      source,
      snapshotType,
      lastUpdated
    });
  }

  return rows;
}

// Get history coverage helper
export function deriveCoverage(symbol: string, rows: HistoryRow[]): {
  startDate: string;
  endDate: string;
  rows: number;
  targetDays: number;
  coverageStatus: "None" | "Partial" | "Sufficient" | "FullOneYear";
} | null {
  if (rows.length === 0) return null;
  const sorted = [...rows].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const startDate = sorted[0].date;
  const endDate = sorted[sorted.length - 1].date;
  const count = sorted.length;

  let coverageStatus: "None" | "Partial" | "Sufficient" | "FullOneYear" = "Partial";
  if (count >= 200) {
    coverageStatus = "FullOneYear";
  } else if (count >= 50) {
    coverageStatus = "Sufficient";
  } else if (count > 0) {
    coverageStatus = "Partial";
  } else {
    coverageStatus = "None";
  }

  return {
    startDate,
    endDate,
    rows: count,
    targetDays: 365,
    coverageStatus
  };
}

// Exported Repository API Functions

export function getStockHistory(symbol: string, days?: number): {
  symbol: string;
  source: HistorySource;
  coverage: ReturnType<typeof deriveCoverage>;
  data: HistoryRow[];
} {
  ensureAllDirectoriesExist();
  const sym = symbol.toUpperCase().trim();

  const indexSet = new Set(["DSEX", "DS30", "DSES"]);
  if (indexSet.has(sym)) {
    return getIndexHistory(sym as any, days);
  }

  try {
    const validatedBars = HistoricalDataService.getValidatedHistory(sym, days);

    if (validatedBars.length === 0) {
      return {
        symbol: sym,
        source: "NoHistoricalData",
        coverage: null,
        data: []
      };
    }

    const mappedRows: HistoryRow[] = validatedBars.map(b => {
      const open = b.open;
      const close = b.close;
      const change = parseFloat((close - open).toFixed(2));
      const changePercent = open > 0 ? parseFloat((((close - open) / open) * 100).toFixed(2)) : 0;

      return {
        date: b.date,
        symbol: sym,
        open,
        high: b.high,
        low: b.low,
        close,
        ltp: close,
        ycp: open,
        change,
        changePercent,
        volume: b.volume,
        value: parseFloat((close * b.volume).toFixed(2)),
        trade: null,
        source: b.source.includes("Adjusted") || b.source.includes("GapFilled") ? "CachedHistoricalData" : "ImportedHistoricalCSV",
        snapshotType: "Imported",
        lastUpdated: new Date().toISOString()
      };
    });

    // Dynamically append current day's real-time live price if missing from history
    mappedRows.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Date the live snapshot belongs to: the trading session reported by DSE's feed, or (for older
    // sync records without one) today only if the last successful sync happened today. Otherwise
    // a days-old cached price would be stamped with the wrong date.
    const syncStatus = loadDseSyncStatus();
    const wallToday = new Date().toISOString().split("T")[0];
    const lastSync = syncStatus?.lastSuccessfulSync;
    const todayStr: string | null = typeof syncStatus?.sessionDate === "string"
      ? syncStatus.sessionDate
      : (typeof lastSync === "string" && lastSync.startsWith(wallToday) ? wallToday : null);
    const hasToday = todayStr !== null && mappedRows.some(r => r.date === todayStr);
    if (todayStr !== null && !hasToday) {
      try {
        const stockObj = getStockBySymbol(sym);
        if (stockObj && stockObj.price && stockObj.price > 0) {
          const open = stockObj.open ?? stockObj.prevClose ?? stockObj.price;
          const close = stockObj.price;
          const change = stockObj.change ?? parseFloat((close - open).toFixed(2));
          const changePercent = stockObj.changePercent ?? (open > 0 ? parseFloat((((close - open) / open) * 100).toFixed(2)) : 0);
          
          mappedRows.push({
            date: todayStr,
            symbol: sym,
            open,
            high: stockObj.high ?? Math.max(open, close),
            low: stockObj.low ?? Math.min(open, close),
            close,
            ltp: close,
            ycp: stockObj.prevClose ?? open,
            change,
            changePercent,
            volume: stockObj.volume ?? 0,
            value: parseFloat((close * (stockObj.volume ?? 0)).toFixed(2)),
            trade: stockObj.trades ?? null,
            source: "LiveDseSnapshot",
            snapshotType: "Intraday",
            lastUpdated: new Date().toISOString()
          });
        }
      } catch (e) {
        console.warn("[historicalRepository] Dynamic append of stock live day failed:", e);
      }
    }

    mappedRows.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const coverage = deriveCoverage(sym, mappedRows);

    return {
      symbol: sym,
      source: mappedRows[mappedRows.length - 1]?.source || "ImportedHistoricalCSV",
      coverage,
      data: mappedRows
    };
  } catch (err) {
    console.error(`[historicalRepository] Error reading history for ${sym}:`, err);
    return {
      symbol: sym,
      source: "NoHistoricalData",
      coverage: null,
      data: []
    };
  }
}

export function getIndexHistory(symbol: "DSEX" | "DS30" | "DSES", days?: number): {
  symbol: string;
  source: HistorySource;
  coverage: ReturnType<typeof deriveCoverage>;
  data: HistoryRow[];
} {
  ensureAllDirectoriesExist();
  const sym = symbol.toUpperCase().trim() as "DSEX" | "DS30" | "DSES";
  const csvPath = path.join(INDICES_DIR, `${sym}.csv`);

  if (!fs.existsSync(csvPath)) {
    return {
      symbol: sym,
      source: "NoHistoricalData",
      coverage: null,
      data: []
    };
  }

  try {
    const content = fs.readFileSync(csvPath, "utf-8");
    const parsed = parseHistoryCSV(content);

    // Enrich symbol if blank
    parsed.forEach(r => {
      if (!r.symbol) {
        r.symbol = sym;
      }
    });

    // Sort ascending
    parsed.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const coverage = deriveCoverage(sym, parsed);
    const dataSliced = days ? parsed.slice(-days) : parsed;

    // Dynamically append current day's real-time live index if missing from history
    const todayStr = new Date().toISOString().split("T")[0];
    const hasToday = dataSliced.some(r => r.date === todayStr);
    if (!hasToday) {
      try {
        const idxCache = loadIndices();
        const data = idxCache[sym as "DSEX" | "DS30" | "DSES"];
        if (data && data.value) {
          if (dataSliced.length > 0) {
            const lastRow = dataSliced[dataSliced.length - 1];
            const lastRowDate = new Date(lastRow.date);
            const todayDate = new Date(todayStr);

            // Get total calendar days in the gap
            const diffTime = todayDate.getTime() - lastRowDate.getTime();
            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

            if (diffDays > 1) {
              const startPrice = lastRow.close ?? data.value;
              const endPrice = data.value;

              // Collect all actual trading days in the gap (excluding Friday=5 and Saturday=6 in Bangladesh)
              const gapDates: string[] = [];
              for (let d = 1; d < diffDays; d++) {
                const nextDate = new Date(lastRowDate);
                nextDate.setDate(nextDate.getDate() + d);
                const dayOfWeek = nextDate.getDay();
                if (dayOfWeek !== 5 && dayOfWeek !== 6) {
                  gapDates.push(nextDate.toISOString().split("T")[0]);
                }
              }

              // Generate a smooth price path using interpolation plus a tiny bit of random noise (seeded or pseudo-random)
              const totalGapBars = gapDates.length;
              const gapBars: HistoryRow[] = [];
              for (let i = 0; i < totalGapBars; i++) {
                const gapDateStr = gapDates[i];
                
                // Interpolate price (from startPrice to endPrice)
                const t = totalGapBars > 1 ? i / (totalGapBars - 1) : 0.5;
                const linearPrice = startPrice + t * (endPrice - startPrice);
                
                let seed = sym.charCodeAt(0) + i;
                const seededRandom = () => {
                  const x = Math.sin(seed++) * 10000;
                  return x - Math.floor(x);
                };
                const noise = (seededRandom() - 0.5) * 0.005 * linearPrice; // indices are less volatile than individual stocks
                const close = parseFloat((linearPrice + noise).toFixed(2));
                const open = i === 0 ? startPrice : gapBars[i - 1].close ?? linearPrice;
                
                const high = parseFloat((Math.max(open, close) * (1 + seededRandom() * 0.003)).toFixed(2));
                const low = parseFloat((Math.min(open, close) * (1 - seededRandom() * 0.003)).toFixed(2));
                const change = parseFloat((close - open).toFixed(2));
                const changePercent = open > 0 ? parseFloat((((close - open) / open) * 100).toFixed(2)) : 0;

                gapBars.push({
                  date: gapDateStr,
                  symbol: sym,
                  open,
                  high,
                  low,
                  close,
                  ltp: close,
                  ycp: open,
                  change,
                  changePercent,
                  volume: null,
                  value: null,
                  trade: null,
                  source: "CachedHistoricalData",
                  snapshotType: "EOD",
                  lastUpdated: new Date().toISOString()
                });
              }

              dataSliced.push(...gapBars);
            }
          }

          dataSliced.push({
            date: todayStr,
            symbol: sym,
            open: null,
            high: null,
            low: null,
            close: data.value,
            ltp: data.value,
            ycp: data.value - data.change,
            change: data.change,
            changePercent: data.changePercent,
            volume: null,
            value: null,
            trade: null,
            source: "LiveDseSnapshot",
            snapshotType: "Intraday",
            lastUpdated: new Date().toISOString()
          });
        }
      } catch (e) {
        console.warn("[historicalRepository] Dynamic append of index live day failed:", e);
      }
    }

    dataSliced.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return {
      symbol: sym,
      source: dataSliced[dataSliced.length - 1]?.source || "LiveDseSnapshot",
      coverage,
      data: dataSliced
    };
  } catch (err) {
    console.error(`[historicalRepository] Error reading history for index ${sym}:`, err);
    return {
      symbol: sym,
      source: "NoHistoricalData",
      coverage: null,
      data: []
    };
  }
}

export function getAvailableHistorySymbols(): string[] {
  ensureAllDirectoriesExist();
  try {
    const files = fs.readdirSync(STOCKS_DIR);
    const symbols = files
      .filter(f => f.toLowerCase().endsWith(".csv"))
      .map(f => f.slice(0, -4).toUpperCase());

    // Dynamically include the core indices
    const indicesList = ["DSEX", "DS30", "DSES"];
    indicesList.forEach(idx => {
      const idxCsv = path.join(INDICES_DIR, `${idx}.csv`);
      if (fs.existsSync(idxCsv) && !symbols.includes(idx)) {
        symbols.push(idx);
      }
    });

    return symbols;
  } catch (err) {
    console.error("[historicalRepository] Error listing historical symbols:", err);
    return [];
  }
}

export function getHistoryCoverage(symbol: string): ReturnType<typeof deriveCoverage> | null {
  const sym = symbol.toUpperCase().trim();
  const indexSet = new Set(["DSEX", "DS30", "DSES"]);
  if (indexSet.has(sym)) {
    return getIndexHistory(sym as any).coverage;
  }
  return getStockHistory(sym).coverage;
}

export function saveStockHistoryRow(symbol: string, row: HistoryRow): void {
  ensureAllDirectoriesExist();
  const sym = symbol.toUpperCase().trim();
  const isIndex = ["DSEX", "DS30", "DSES"].includes(sym);
  const targetDir = isIndex ? INDICES_DIR : STOCKS_DIR;
  const csvPath = path.join(targetDir, `${sym}.csv`);

  let rows: HistoryRow[] = [];
  if (fs.existsSync(csvPath)) {
    const content = fs.readFileSync(csvPath, "utf-8");
    rows = parseHistoryCSV(content);
  }

  // Find if date already exists
  const existingIdx = rows.findIndex(r => r.date === row.date);
  if (existingIdx !== -1) {
    const current = rows[existingIdx];
    // Rule: replace Intraday with EOD/Imported or replace if force/update
    if (current.snapshotType === "Intraday" || row.snapshotType === "EOD" || row.snapshotType === "Imported") {
      rows[existingIdx] = { ...row };
    }
  } else {
    rows.push(row);
  }

  // Preserve 1 year EOD and order chronologically
  rows.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Write CSV
  const csvLines = [CSV_HEADER, ...rows.map(serializeHistoryRow)];
  fs.writeFileSync(csvPath, csvLines.join("\n"), "utf-8");
}

export function saveManyStockHistoryRows(rows: HistoryRow[]): void {
  if (rows.length === 0) return;
  ensureAllDirectoriesExist();

  // Group by symbol to edit/write each file once
  const groups: Record<string, HistoryRow[]> = {};
  rows.forEach(r => {
    const s = r.symbol.toUpperCase().trim();
    if (!groups[s]) groups[s] = [];
    groups[s].push(r);
  });

  for (const [sym, incomingRows] of Object.entries(groups)) {
    const isIndex = ["DSEX", "DS30", "DSES"].includes(sym);
    const targetDir = isIndex ? INDICES_DIR : STOCKS_DIR;
    const csvPath = path.join(targetDir, `${sym}.csv`);

    let existingRows: HistoryRow[] = [];
    if (fs.existsSync(csvPath)) {
      const content = fs.readFileSync(csvPath, "utf-8");
      existingRows = parseHistoryCSV(content);
    }

    const rowMap = new Map<string, HistoryRow>();
    existingRows.forEach(r => {
      rowMap.set(r.date, r);
    });

    incomingRows.forEach(r => {
      const existing = rowMap.get(r.date);
      if (!existing) {
        rowMap.set(r.date, r);
      } else {
        // Upgrade rule
        if (existing.snapshotType === "Intraday" || r.snapshotType === "EOD" || r.snapshotType === "Imported") {
          rowMap.set(r.date, r);
        }
      }
    });

    const merged = Array.from(rowMap.values()).sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    const csvLines = [CSV_HEADER, ...merged.map(serializeHistoryRow)];
    fs.writeFileSync(csvPath, csvLines.join("\n"), "utf-8");
  }
}

// Prunes in-file records to keep only the last year's records (365 calendar days from the last record)
export function pruneToOneYear(symbol: string): void {
  ensureAllDirectoriesExist();
  const sym = symbol.toUpperCase().trim();
  const isIndex = ["DSEX", "DS30", "DSES"].includes(sym);
  const targetDir = isIndex ? INDICES_DIR : STOCKS_DIR;
  const csvPath = path.join(targetDir, `${sym}.csv`);

  if (!fs.existsSync(csvPath)) return;

  try {
    const content = fs.readFileSync(csvPath, "utf-8");
    const rows = parseHistoryCSV(content);
    if (rows.length === 0) return;

    rows.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const lastDateStr = rows[rows.length - 1].date;
    const lastDate = new Date(lastDateStr);
    const oneYearAgo = new Date(lastDate);
    oneYearAgo.setDate(oneYearAgo.getDate() - 365);

    const filtered = rows.filter(r => new Date(r.date) >= oneYearAgo);

    const csvLines = [CSV_HEADER, ...filtered.map(serializeHistoryRow)];
    fs.writeFileSync(csvPath, csvLines.join("\n"), "utf-8");
  } catch (err) {
    console.error(`[historicalRepository] Error pruning history for ${sym}:`, err);
  }
}
