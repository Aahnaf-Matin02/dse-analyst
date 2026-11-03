import fs from "fs";
import path from "path";
import { DSEScraper } from "./dseScraper";
import { getAllStocks } from "../repositories/stockRepository";
import { loadIndices } from "../repositories/marketRepository";
import {
  ensureAllDirectoriesExist,
  HistoryRow,
  HistorySource,
  saveManyStockHistoryRows,
  getStockHistory,
  getHistoryCoverage,
  pruneToOneYear,
  getAvailableHistorySymbols
} from "../repositories/historicalRepository";

const DAILY_SNAPSHOTS_DIR = path.join(process.cwd(), "data", "history", "snapshots", "daily");

// Capture full daily snapshot from active live elements
export async function captureDailyDseSnapshot(options?: {
  snapshotType?: "Intraday" | "EOD";
  force?: boolean;
}): Promise<{ success: boolean; date?: string; totalSymbols?: number; message: string }> {
  ensureAllDirectoriesExist();

  // 1. Trigger live scraping (forced to bypass cache TTL if forced)
  const syncResult = await DSEScraper.syncLiveDSEData(0, options?.force ?? true);
  const status = DSEScraper.getStatus();

  // 2. Strict compliance guard: Only save snapshot if source is LiveScraped
  if (status.source !== "LiveScraped" || !syncResult.live) {
    return {
      success: false,
      message: `Failed to capture snapshot: Live DSE was unreachable or returned cached fallback data. Current Status: ${status.status}, Source: ${status.source}`
    };
  }

  const now = new Date();
  const dateStr = now.toISOString().split("T")[0];
  const snapshotPath = path.join(DAILY_SNAPSHOTS_DIR, `${dateStr}.json`);

  const stocks = getAllStocks();
  const indices = loadIndices();

  // Create Snapshot Data
  const snapshotData = {
    date: dateStr,
    source: "LiveDseSnapshot" as HistorySource,
    snapshotType: options?.snapshotType || "EOD",
    capturedAt: now.toISOString(),
    totalSymbols: stocks.length,
    stocks: stocks.map(s => ({
      symbol: s.symbol,
      ltp: s.price,
      open: s.open,
      high: s.high,
      low: s.low,
      ycp: s.prevClose,
      change: s.change,
      changePercent: s.changePercent,
      volume: s.volume,
      value: null, // Value isn't stored directly inside compiled stock models
      trade: s.trades
    })),
    indices: {
      DSEX: indices.DSEX,
      DS30: indices.DS30,
      DSES: indices.DSES
    }
  };

  // 3. Save snapshot json file
  fs.writeFileSync(snapshotPath, JSON.stringify(snapshotData, null, 2), "utf-8");

  // 4. Transform into HistoryRow layout
  const rows: HistoryRow[] = stocks.map(s => ({
    date: dateStr,
    symbol: s.symbol,
    open: s.open ?? null,
    high: s.high ?? null,
    low: s.low ?? null,
    close: s.price ?? null, // LTP represents final close
    ltp: s.price ?? null,
    ycp: s.prevClose ?? null,
    change: s.change ?? null,
    changePercent: s.changePercent ?? null,
    volume: s.volume ?? null,
    value: null,
    trade: s.trades ?? null,
    source: "LiveDseSnapshot",
    snapshotType: options?.snapshotType || "EOD",
    lastUpdated: now.toISOString()
  }));

  // Append Indices Row for completeness
  const indexRows: HistoryRow[] = [];
  ["DSEX", "DS30", "DSES"].forEach(ind => {
    const data = (indices as any)[ind];
    if (data) {
      indexRows.push({
        date: dateStr,
        symbol: ind,
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
        snapshotType: options?.snapshotType || "EOD",
        lastUpdated: now.toISOString()
      });
    }
  });

  // 5. Append/Write Rows using HistoryRepository functions
  saveManyStockHistoryRows([...rows, ...indexRows]);

  // 6. Prune to the last 1 year (365 days)
  pruneHistoryOlderThanOneYear();

  return {
    success: true,
    date: dateStr,
    totalSymbols: stocks.length,
    message: `Captured daily snapshot for ${dateStr} enclosing ${stocks.length} stocks and 3 indices.`
  };
}

export function appendSnapshotToStockHistory(snapshot: any): void {
  if (!snapshot || !snapshot.date || !Array.isArray(snapshot.stocks)) return;

  const date = snapshot.date;
  const source = snapshot.source || "LiveDseSnapshot";
  const snapshotType = snapshot.snapshotType || "EOD";
  const capturedAt = snapshot.capturedAt || new Date().toISOString();

  const rows: HistoryRow[] = snapshot.stocks.map((s: any) => ({
    date,
    symbol: s.symbol,
    open: s.open ?? null,
    high: s.high ?? null,
    low: s.low ?? null,
    close: s.close ?? s.ltp ?? null,
    ltp: s.ltp ?? null,
    ycp: s.ycp ?? null,
    change: s.change ?? null,
    changePercent: s.changePercent ?? null,
    volume: s.volume ?? null,
    value: s.value ?? null,
    trade: s.trade ?? null,
    source,
    snapshotType,
    lastUpdated: capturedAt
  }));

  // append indices as well if present
  if (snapshot.indices) {
    Object.values(snapshot.indices).forEach((idxObj: any) => {
      if (idxObj && idxObj.symbol) {
        rows.push({
          date,
          symbol: idxObj.symbol,
          open: null,
          high: null,
          low: null,
          close: idxObj.value,
          ltp: idxObj.value,
          ycp: idxObj.value - (idxObj.change || 0),
          change: idxObj.change || null,
          changePercent: idxObj.changePercent || null,
          volume: null,
          value: null,
          trade: null,
          source,
          snapshotType,
          lastUpdated: capturedAt
        });
      }
    });
  }

  saveManyStockHistoryRows(rows);
}

// Rebuild per-stock files from all daily snapshots stored on disk
export async function rebuildStockHistoryFromSnapshots(): Promise<{ success: boolean; snapshotsProcessed: number; rowsAppended: number }> {
  ensureAllDirectoriesExist();

  if (!fs.existsSync(DAILY_SNAPSHOTS_DIR)) {
    return { success: true, snapshotsProcessed: 0, rowsAppended: 0 };
  }

  const files = fs.readdirSync(DAILY_SNAPSHOTS_DIR).filter(f => f.endsWith(".json"));
  let rowsAppended = 0;

  const allRowsToSave: HistoryRow[] = [];

  for (const file of files) {
    try {
      const content = fs.readFileSync(path.join(DAILY_SNAPSHOTS_DIR, file), "utf-8");
      const snapshot = JSON.parse(content);

      if (snapshot && Array.isArray(snapshot.stocks)) {
        const date = snapshot.date || file.slice(0, -5);
        const source = snapshot.source || "LiveDseSnapshot";
        const snapshotType = snapshot.snapshotType || "EOD";
        const capturedAt = snapshot.capturedAt || new Date().toISOString();

        snapshot.stocks.forEach((s: any) => {
          allRowsToSave.push({
            date,
            symbol: s.symbol,
            open: s.open ?? null,
            high: s.high ?? null,
            low: s.low ?? null,
            close: s.close ?? s.ltp ?? null,
            ltp: s.ltp ?? null,
            ycp: s.ycp ?? null,
            change: s.change ?? null,
            changePercent: s.changePercent ?? null,
            volume: s.volume ?? null,
            value: s.value ?? null,
            trade: s.trade ?? null,
            source,
            snapshotType,
            lastUpdated: capturedAt
          });
        });

        if (snapshot.indices) {
          Object.values(snapshot.indices).forEach((idxObj: any) => {
            if (idxObj && idxObj.symbol) {
              allRowsToSave.push({
                date,
                symbol: idxObj.symbol,
                open: null,
                high: null,
                low: null,
                close: idxObj.value,
                ltp: idxObj.value,
                ycp: idxObj.value - (idxObj.change || 0),
                change: idxObj.change || null,
                changePercent: idxObj.changePercent || null,
                volume: null,
                value: null,
                trade: null,
                source,
                snapshotType,
                lastUpdated: capturedAt
              });
            }
          });
        }
      }
    } catch (err) {
      console.error(`[dseSnapshotService] Error processing snapshot file ${file}:`, err);
    }
  }

  if (allRowsToSave.length > 0) {
    saveManyStockHistoryRows(allRowsToSave);
    rowsAppended = allRowsToSave.length;
  }

  return {
    success: true,
    snapshotsProcessed: files.length,
    rowsAppended
  };
}

export function getOneYearStockHistory(symbol: string) {
  return getStockHistory(symbol, 365);
}

export function getHistoryCoverageStatus(symbol: string) {
  return getHistoryCoverage(symbol);
}

export function pruneHistoryOlderThanOneYear(symbol?: string): void {
  ensureAllDirectoriesExist();
  if (symbol) {
    pruneToOneYear(symbol);
  } else {
    // Prune everything
    const symbols = getAvailableHistorySymbols();
    symbols.forEach(pruneToOneYear);
    // Also prune indices
    ["DSEX", "DS30", "DSES"].forEach(pruneToOneYear);
  }
}
