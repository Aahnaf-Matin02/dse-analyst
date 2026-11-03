import fs from "fs";
import path from "path";
import { HistoricalDataService } from "../services/historicalDataService";
import { getStockBySymbol } from "./stockRepository";
import { loadDseSyncStatus } from "./dseCacheRepository";
import { loadIndices } from "./marketRepository";

export type HistorySource =
  | "DSE_OFFICIAL"
  | "LankaBD"
  | "InvestingCSV"
  | "LiveDseSnapshot"
  | "ImportedHistoricalCSV"
  | "NoHistoricalData";

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
    // Serverless bundles (Netlify) are read-only: reads must still work, and a later write reports its own error
    try { fs.mkdirSync(dirPath, { recursive: true }); } catch { /* read-only filesystem */ }
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

    // Rows exactly as stored. "ycp"/"change" are relative to the previous stored session's close
    // (null for the first row) — not the same day's open.
    const mappedRows: HistoryRow[] = validatedBars.map((b, i) => {
      const prevClose = i > 0 ? validatedBars[i - 1].close : null;
      const change = prevClose !== null ? parseFloat((b.close - prevClose).toFixed(2)) : null;
      const changePercent = prevClose ? parseFloat((((b.close - prevClose) / prevClose) * 100).toFixed(2)) : null;
      return {
        date: b.date,
        symbol: sym,
        open: b.open,
        high: b.high,
        low: b.low,
        close: b.close,
        ltp: b.close,
        ycp: prevClose,
        change,
        changePercent,
        volume: b.volume,
        value: null, // turnover is not stored in the history files
        trade: null,
        source: b.source as HistorySource,
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

    // Append DSE's latest reported index value for its own session date if that day isn't stored yet.
    // Gaps between the stored history and that session are left as gaps — never interpolated.
    try {
      const idxCache = loadIndices() as any;
      const data = idxCache[sym as "DSEX" | "DS30" | "DSES"];
      const sessionDate: string | null = idxCache?.session?.sessionDate ?? null;
      if (data && data.value > 0 && sessionDate && !dataSliced.some(r => r.date === sessionDate)) {
        dataSliced.push({
          date: sessionDate,
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
          snapshotType: "EOD",
          lastUpdated: new Date().toISOString()
        });
      }
    } catch (e) {
      console.warn("[historicalRepository] Appending latest index value failed:", e);
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
