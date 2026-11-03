import { Router, Request, Response } from "express";
import fs from "fs";
import path from "path";
import {
  captureDailyDseSnapshot,
  rebuildStockHistoryFromSnapshots
} from "../services/dseSnapshotService";
import {
  getStockHistory,
  getHistoryCoverage,
  getAvailableHistorySymbols,
  ensureAllDirectoriesExist,
  saveManyStockHistoryRows,
  HistoryRow
} from "../repositories/historicalRepository";
import { getAllStocks } from "../repositories/stockRepository";
import { verifyAdminSecret } from "../middleware/adminAuth";

export const HistoryRouter = Router();

const STOCKS_DIR = path.join(process.cwd(), "data", "history", "stocks");
const DAILY_DIR = path.join(process.cwd(), "data", "history", "snapshots", "daily");


// GET /api/history/summary
HistoryRouter.get("/summary", (req: Request, res: Response) => {
  ensureAllDirectoriesExist();
  try {
    const stockFiles = fs.existsSync(STOCKS_DIR) ? fs.readdirSync(STOCKS_DIR).filter(f => f.toLowerCase().endsWith(".csv")) : [];
    const snapshots = fs.existsSync(DAILY_DIR) ? fs.readdirSync(DAILY_DIR).filter(f => f.toLowerCase().endsWith(".json")) : [];

    let totalRows = 0;
    stockFiles.forEach(f => {
      try {
        const content = fs.readFileSync(path.join(STOCKS_DIR, f), "utf-8");
        const lines = content.split(/\r?\n/).filter(line => line.trim().length > 0);
        // Exclude header line
        if (lines.length > 1) {
          totalRows += (lines.length - 1);
        }
      } catch (e) {}
    });

    let lastSnapshotDate = "N/A";
    if (snapshots.length > 0) {
      // Sort snapshots list to find the latest
      const sorted = snapshots.map(s => s.slice(0, -5)).sort();
      lastSnapshotDate = sorted[sorted.length - 1];
    }

    const dseStocks = getAllStocks();
    const coverageSymbols = getAvailableHistorySymbols();
    const missingSymbols = dseStocks.filter(s => !coverageSymbols.includes(s.symbol)).map(s => s.symbol);

    res.json({
      totalStocksWithHistory: stockFiles.length,
      totalHistoricalRows: totalRows,
      coverageBySymbolCount: coverageSymbols.length,
      missingSymbolsCount: missingSymbols.length,
      missingSymbols,
      lastSnapshotDate,
      totalDailySnapshotsCount: snapshots.length,
      storageMode: "local-file-system"
    });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to load history summary: " + err.message });
  }
});

// GET /api/history/stocks
HistoryRouter.get("/stocks", (req: Request, res: Response) => {
  ensureAllDirectoriesExist();
  try {
    const symbols = getAvailableHistorySymbols();
    const resultList = symbols.map(sym => {
      const cov = getHistoryCoverage(sym);
      return {
        symbol: sym,
        coverage: cov
      };
    });
    res.json(resultList);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to retrieve historical stocks: " + err.message });
  }
});

// GET /api/history/stocks/:symbol
HistoryRouter.get("/stocks/:symbol", (req: Request, res: Response) => {
  const symbol = req.params.symbol;
  const daysQuery = req.query.days ? parseInt(req.query.days as string, 10) : 365;

  if (!symbol) {
    return res.status(400).json({ error: "Missing stock symbol parameter." });
  }

  try {
    const historyResult = getStockHistory(symbol, daysQuery);
    if (historyResult.source === "NoHistoricalData") {
      return res.json({
        symbol: symbol.toUpperCase(),
        source: "NoHistoricalData",
        coverage: null,
        data: []
      });
    }

    res.json({
      symbol: historyResult.symbol,
      source: historyResult.source,
      coverage: historyResult.coverage,
      data: historyResult.data
    });
  } catch (err: any) {
    res.status(500).json({ error: `Failed to loaded stock history for ${symbol}: ${err.message}` });
  }
});

// GET /api/history/stocks/:symbol/coverage
HistoryRouter.get("/stocks/:symbol/coverage", (req: Request, res: Response) => {
  const symbol = req.params.symbol;
  if (!symbol) {
    return res.status(400).json({ error: "Missing stock symbol parameter." });
  }

  try {
    const coverage = getHistoryCoverage(symbol);
    res.json({
      symbol: symbol.toUpperCase(),
      coverage
    });
  } catch (err: any) {
    res.status(500).json({ error: `Failed to fetch coverage for ${symbol}: ${err.message}` });
  }
});

// GET /api/history/:symbol/coverage
HistoryRouter.get("/:symbol/coverage", (req: Request, res: Response) => {
  const symbol = req.params.symbol;
  if (!symbol) {
    return res.status(400).json({ error: "Missing symbol parameter." });
  }

  try {
    const coverage = getHistoryCoverage(symbol);
    if (!coverage) {
      return res.json({
        coverageStatus: "None",
        firstDate: null,
        lastDate: null,
        rowCount: 0
      });
    }
    res.json({
      coverageStatus: coverage.coverageStatus,
      firstDate: coverage.startDate || null,
      lastDate: coverage.endDate || null,
      rowCount: coverage.rows || 0
    });
  } catch (err: any) {
    res.status(500).json({ error: `Failed to fetch coverage for ${symbol}: ${err.message}` });
  }
});

// POST /api/history/capture
HistoryRouter.post("/capture", verifyAdminSecret, async (req: Request, res: Response) => {
  const snapshotType = req.body.snapshotType || "EOD";
  const force = req.body.force ?? true;

  try {
    const captureResult = await captureDailyDseSnapshot({ snapshotType, force });
    if (!captureResult.success) {
      return res.status(400).json(captureResult);
    }
    res.json(captureResult);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/history/rebuild
HistoryRouter.post("/rebuild", verifyAdminSecret, async (req: Request, res: Response) => {
  try {
    const rebuildResult = await rebuildStockHistoryFromSnapshots();
    res.json(rebuildResult);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/history/import (Run past CSV processing backfill manually)
HistoryRouter.post("/import", verifyAdminSecret, async (req: Request, res: Response) => {
  try {
    // We will trigger a run of the importer script if it is packaged as a module, or describe instructions.
    // Let's implement the backfill trigger directly inside this POST route so that the UI can call it!
    const summaryPath = path.join(process.cwd(), "data", "history", "processed", "one-year-history-summary.json");
    if (fs.existsSync(summaryPath)) {
      const summary = JSON.parse(fs.readFileSync(summaryPath, "utf-8"));
      return res.json({
        success: true,
        message: "Parsed past 1-year imported data backfill summary from server storage.",
        summary
      });
    }

    res.json({
      success: true,
      message: "CSV processing backfill system is available. Trigger import script via 'npm run import:one-year-history'."
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/history/bulk-import - Bulk endpoint for importing full historical OHLCV archives
const ipRequests = new Map<string, number[]>();
const symbolLocks = new Set<string>();

HistoryRouter.post("/bulk-import", verifyAdminSecret, async (req: Request, res: Response) => {
  ensureAllDirectoriesExist();
  const startTime = Date.now();
  const clientIp = req.ip || req.socket.remoteAddress || "unknown";

  // Rate limiting check
  const now = Date.now();
  const times = ipRequests.get(clientIp) || [];
  const recentTimes = times.filter(t => now - t < 60000);
  if (recentTimes.length >= 5) {
    return res.status(429).json({
      success: false,
      error: "Too many bulk import requests. Rate limit of 5 per minute exceeded."
    });
  }
  recentTimes.push(now);
  ipRequests.set(clientIp, recentTimes);

  const payload = req.body;
  
  // Validation layer
  const { validateBulkImport } = await import("../validators/bulkImportValidator");
  const validationResult = validateBulkImport(payload);

  if (!validationResult.valid) {
    return res.status(400).json({
      success: false,
      errors: validationResult.errors
    });
  }

  const typedPayload = payload as { symbol: string; rows: any[] };
  const symUpper = typedPayload.symbol.toUpperCase().trim();

  // Symbol lock checking
  if (symbolLocks.has(symUpper)) {
    return res.status(409).json({
      success: false,
      error: `Conflict: An import is busy or currently in progress for symbol '${symUpper}'.`
    });
  }

  symbolLocks.add(symUpper);

  try {
    // Load existing history to calculate stats
    const existingResult = getStockHistory(symUpper);
    const existingMap = new Map<string, HistoryRow>();
    if (existingResult && Array.isArray(existingResult.data)) {
      existingResult.data.forEach(r => {
        existingMap.set(r.date, r);
      });
    }

    let inserted = 0;
    let updated = 0;
    let skipped = 0;

    const historyRowsToSave: HistoryRow[] = typedPayload.rows.map(row => {
      const existing = existingMap.get(row.date);
      if (!existing) {
        inserted++;
      } else {
        const isIdentical =
          existing.open === row.open &&
          existing.high === row.high &&
          existing.low === row.low &&
          existing.close === row.close &&
          existing.volume === row.volume;
        if (isIdentical) {
          skipped++;
        } else {
          updated++;
        }
      }

      return {
        date: row.date,
        symbol: symUpper,
        open: row.open,
        high: row.high,
        low: row.low,
        close: row.close,
        ltp: row.close,
        ycp: row.open,
        change: row.close - row.open,
        changePercent: row.open > 0 ? ((row.close - row.open) / row.open) * 100 : 0,
        volume: row.volume,
        value: row.close * row.volume,
        trade: null,
        source: "ImportedHistoricalCSV",
        snapshotType: "Imported",
        lastUpdated: new Date().toISOString()
      };
    });

    // Save rows (processed in single file grouping transaction in repository)
    saveManyStockHistoryRows(historyRowsToSave);

    const duration = Date.now() - startTime;
    console.log(`[BULK IMPORT SUCCESS] Symbol: ${symUpper}, Count: ${typedPayload.rows.length}, Inserted: ${inserted}, Updated: ${updated}, Skipped: ${skipped}, Duration: ${duration}ms, IP: ${clientIp}`);

    return res.json({
      symbol: symUpper,
      inserted,
      updated,
      skipped,
      errors: [] as { row: number; reason: string }[]
    });

  } catch (err: any) {
    const duration = Date.now() - startTime;
    console.error(`[BULK IMPORT EXCEPTION] Symbol: ${symUpper}, Error: ${err.message}, Duration: ${duration}ms, IP: ${clientIp}`);
    return res.status(500).json({
      error: "Internal server error performing historical bulk import.",
      details: err.message
    });
  } finally {
    symbolLocks.delete(symUpper);
  }
});

