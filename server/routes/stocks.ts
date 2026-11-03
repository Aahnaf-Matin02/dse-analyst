import { Router, Response } from "express";
import { getAllStocks, getStockBySymbol, getMetadata } from "../repositories/stockRepository";
import { WatchlistRepository } from "../repositories/watchlistRepository";
import { authenticateToken, AuthenticatedRequest, requireEmailVerified } from "../middleware/auth";
import { verifyAdminSecret } from "../middleware/adminAuth";
import { DSE_COMPANIES } from "../../src/data/dseData";
import { HistoryRepository } from "../repositories/historyRepository";
import { getStockHistory, getAvailableHistorySymbols, getHistoryCoverage } from "../repositories/historicalRepository";
import { calculateTechnicalIndicators } from "../services/technicalIndicators";
import fs from "fs";
import path from "path";
import { exec } from "child_process";
import { DSEScraper } from "../services/dseScraper";
import { DseUniverseService } from "../services/dseUniverseService";
import { DataCoverageAuditService } from "../services/dataCoverageAudit";
import { DseFinancialsManager } from "../services/dse/dseFinancials";
import { DseShareholdingManager } from "../services/dse/dseShareholding";
import { DseCorporateActionsManager } from "../services/dse/dseCorporateActions";
import { DseDisclosuresManager } from "../services/dse/dseDisclosures";
import { DseMarketDataManager } from "../services/dse/dseMarketData";
import { defaultDseSyncService } from "../services/dse/dseSyncService";
import { computeStockAnalytics, range52wFor } from "../services/history/stockAnalytics";

const router = Router();

let websiteSymbolsCache: string[] | null = null;
/** The securities the website shows (data/history/source-map/website-symbols.json). */
function websiteSymbolList(): string[] {
  if (!websiteSymbolsCache) {
    try {
      const file = path.join(process.cwd(), "data", "history", "source-map", "website-symbols.json");
      websiteSymbolsCache = (JSON.parse(fs.readFileSync(file, "utf8")).symbols || []).map((s: string) => s.toUpperCase());
    } catch {
      websiteSymbolsCache = getAllStocks().map(s => s.symbol.toUpperCase());
    }
  }
  return websiteSymbolsCache!;
}

// Retrieve sector market caps aggregated directly from DSE_COMPANIES
router.get("/sectors/dse-market-cap", (req, res, next) => {
  try {
    const summaryPath = path.join(process.cwd(), "data", "history", "processed", "sector-research-summary.json");
    if (fs.existsSync(summaryPath)) {
      const fileContent = fs.readFileSync(summaryPath, "utf-8");
      const summary = JSON.parse(fileContent);
      const resMap: Record<string, number> = {};
      summary.sectors.forEach((sec: any) => {
        resMap[sec.name] = sec.totalMarketCap;
      });
      return res.json(resMap);
    }

    const sectorMap: Record<string, number> = {};

    Object.values(DSE_COMPANIES).forEach(s => {
      if (!s.sector) return;
      const secName = s.sector.trim();
      if (!sectorMap[secName]) {
        sectorMap[secName] = 0;
      }
      // Official market cap only; if missing do not estimate
      let cap = 0;
      if (typeof (s as any).marketCapNumber === "number") {
        cap = (s as any).marketCapNumber;
      } else if (typeof s.marketCap === "string") {
        const numMatch = s.marketCap.match(/([0-9.]+)\s*([BMK]?)/i);
        if (numMatch) {
          const val = parseFloat(numMatch[1]);
          const unit = (numMatch[2] || "").toUpperCase();
          cap = unit === "B" ? val * 1e9 : unit === "M" ? val * 1e6 : unit === "K" ? val * 1e3 : val;
        }
      }
      sectorMap[secName] += cap;
    });

    return res.json(sectorMap);
  } catch (err) {
    next(err);
  }
});

// Sector stats: Total market cap per sector
router.get("/sectors/market-cap", (req, res, next) => {
  try {
    const summaryPath = path.join(process.cwd(), "data", "history", "processed", "sector-research-summary.json");
    if (fs.existsSync(summaryPath)) {
      const fileContent = fs.readFileSync(summaryPath, "utf-8");
      const summary = JSON.parse(fileContent);
      return res.json({
        success: true,
        sectors: summary.sectors
      });
    }

    const stocks = getAllStocks();
    const sectorMap: Record<string, { name: string; totalMarketCap: number; count: number }> = {};

    stocks.forEach(s => {
      if (!s.sector) return;
      const secName = s.sector.trim();
      if (!sectorMap[secName]) {
        sectorMap[secName] = { name: secName, totalMarketCap: 0, count: 0 };
      }
      let cap = 0;
      if (typeof (s as any).marketCapNumber === "number") {
        cap = (s as any).marketCapNumber;
      } else if (typeof s.marketCap === "string") {
        const numMatch = s.marketCap.match(/([0-9.]+)\s*([BMK]?)/i);
        if (numMatch) {
          const val = parseFloat(numMatch[1]);
          const unit = (numMatch[2] || "").toUpperCase();
          cap = unit === "B" ? val * 1e9 : unit === "M" ? val * 1e6 : unit === "K" ? val * 1e3 : val;
        }
      }
      sectorMap[secName].totalMarketCap += cap;
      sectorMap[secName].count += 1;
    });

    const sectors = Object.values(sectorMap).sort((a, b) => b.totalMarketCap - a.totalMarketCap);
    return res.json({
      success: true,
      sectors
    });
  } catch (err) {
    next(err);
  }
});

// Real analytics from stored DSE history and official ratios (returns, risk, trend, liquidity, valuation vs sector)
router.get("/:symbol/analytics", (req, res, next) => {
  try {
    const symbol = req.params.symbol.toUpperCase().trim();
    if (!getStockBySymbol(symbol)) return res.status(404).json({ error: `Stock symbol '${symbol}' not found.` });
    const websiteSymbols = websiteSymbolList();
    const sectors = new Map(getAllStocks().map(s => [s.symbol.toUpperCase(), s.sector || null]));
    const peers = websiteSymbols.map(sym => ({ symbol: sym, sector: sectors.get(sym) ?? null }));
    if (!websiteSymbols.includes(symbol)) peers.push({ symbol, sector: sectors.get(symbol) ?? null });
    res.json(computeStockAnalytics(symbol, peers));
  } catch (err) {
    next(err);
  }
});

// Key stats: 52W High/Low + Avg Volume for a single symbol
router.get("/:symbol/stats", (req, res, next) => {
  try {
    const symbol = req.params.symbol.toUpperCase().trim();
    const stock = getStockBySymbol(symbol);

    if (!stock) {
      return res.status(404).json({ error: `Symbol '${symbol}' not found.` });
    }

    const snap = DseMarketDataManager.getLatestSnapshot(symbol);
    const history = getStockHistory(symbol, 365);
    const indicators = calculateTechnicalIndicators(history.data);
    // Same definition as the analytics panel: highest daily high / lowest daily low over the last 365 days
    const range = range52wFor(symbol);

    return res.json({
      symbol,
      week52High:  snap?.weekHigh52 ?? range?.high ?? indicators.high52W ?? null,
      week52Low:   snap?.weekLow52  ?? range?.low  ?? indicators.low52W  ?? null,
      avgVolume:   indicators.avgVolume20D ?? snap?.volume ?? null,
    });
  } catch (err) {
    next(err);
  }
});

// 1. Get all stocks
router.get("/", (req, res, next) => {
  try {
    const stocks = getAllStocks();
    const meta = getMetadata();
    
    // Inject metadata on individual elements so that both arrays and single objects carry sourcing info
    const enriched = stocks.map(stock => ({
      ...stock,
      source: meta.source,
      lastUpdated: meta.lastUpdated,
      isSimulation: meta.isSimulation
    }));

    res.json(enriched);
  } catch (err) {
    next(err);
  }
});

// 2. Search stock list endpoint (Backend search)
router.get("/search", (req, res, next) => {
  try {
    const query = typeof req.query.q === "string" ? req.query.q.toUpperCase().trim() : "";
    const stocks = getAllStocks();
    const meta = getMetadata();

    const filtered = stocks.filter(s => 
      s.symbol.toUpperCase().includes(query) || 
      s.name.toUpperCase().includes(query) ||
      s.sector.toUpperCase().includes(query)
    );

    const enriched = filtered.map(stock => ({
      ...stock,
      source: meta.source,
      lastUpdated: meta.lastUpdated,
      isSimulation: meta.isSimulation
    }));

    res.json(enriched);
  } catch (err) {
    next(err);
  }
});

// Admin endpoint for auditing historical dataset and pipeline logs
router.get("/historical/admin-stats", (req, res, next) => {
  try {
    // 1. Get available symbols and their coverage info
    const symbols = getAvailableHistorySymbols();
    const coverage: Record<string, any> = {};
    for (const sym of symbols) {
      const cov = getHistoryCoverage(sym);
      coverage[sym] = cov || { startDate: "N/A", endDate: "N/A", rows: 0 };
    }

    // 2. Read last import summary
    let importSummary = null;
    const summaryPath = path.join(process.cwd(), "data", "history", "processed", "history-summary.json");
    if (fs.existsSync(summaryPath)) {
      try {
        const fileContent = fs.readFileSync(summaryPath, "utf-8");
        importSummary = JSON.parse(fileContent);
      } catch (err) {
        console.warn("Failed to parse history-summary.json:", err);
      }
    }

    // 3. Read validation errors
    let validationErrors: string[] = [];
    let invalidRows: any[] = [];
    const errorsDir = path.join(process.cwd(), "data", "history", "errors");
    const latestErrorsLogPath = path.join(errorsDir, "latest-validation-errors.log");
    const latestInvalidRowsPath = path.join(errorsDir, "latest-invalid-rows.json");

    if (fs.existsSync(latestErrorsLogPath)) {
      try {
        const logs = fs.readFileSync(latestErrorsLogPath, "utf-8");
        validationErrors = logs.split(/\r?\n/).filter(Boolean);
      } catch (err) {
        console.warn("Failed to read latest-validation-errors.log:", err);
      }
    }

    if (fs.existsSync(latestInvalidRowsPath)) {
      try {
        const rawJson = fs.readFileSync(latestInvalidRowsPath, "utf-8");
        invalidRows = JSON.parse(rawJson);
      } catch (err) {
        console.warn("Failed to parse latest-invalid-rows.json:", err);
      }
    }

    // Load scraperStatus and coverageSummary dynamically
    let scraperStatus = null;
    try {
      const status = DSEScraper.getStatus();
      const activeEndpoint = status.diagnostics?.selectedUrl || "https://dse.com.bd/latest_share_price_all.php";
      const mappedStatus = status.source === "LiveScraped" ? "Live" : (status.source === "CachedFile" ? "Cached" : (status.source === "DefaultSeed" ? "Seeded" : "Error"));
      scraperStatus = {
        connected: status.live,
        activeEndpoint,
        lastSuccessfulSync: status.lastSuccessfulSync,
        parsedSymbols: status.parsedSymbols,
        status: mappedStatus
      };
    } catch (err) {
      console.warn("Failed to retrieve live scraper status:", err);
    }

    let coverageSummary = null;
    let coverageSummaryMtime = null;
    const coverageSummaryPath = path.join(process.cwd(), "data", "history", "processed", "coverage-summary.json");
    if (fs.existsSync(coverageSummaryPath)) {
      try {
        const fileContent = fs.readFileSync(coverageSummaryPath, "utf-8");
        coverageSummary = JSON.parse(fileContent);
        const stats = fs.statSync(coverageSummaryPath);
        coverageSummaryMtime = stats.mtime.toISOString();
      } catch (err) {
        console.warn("Failed to parse coverage-summary.json:", err);
      }
    }

    // Generate dynamic universe summary and coverage audit
    const coverageAudit = DataCoverageAuditService.generateAuditReport();
    const universeSummary = DseUniverseService.getCompleteUniverseList();

    res.json({
      coverage,
      importSummary,
      validationErrors,
      invalidRows,
      coverageAudit,
      universeSummary,
      scraperStatus,
      coverageSummary,
      coverageSummaryMtime
    });
  } catch (err) {
    next(err);
  }
});

// Trigger historical database repair job
router.post("/historical/repair-history", verifyAdminSecret, (req, res, next) => {
  try {
    const result = DataCoverageAuditService.runHistoricalRepairJob();
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// Trigger financials database repair job
router.post("/historical/repair-financials", verifyAdminSecret, (req, res, next) => {
  try {
    const result = DataCoverageAuditService.runFinancialsRepairJob();
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// Top Gainers on Dhaka Stock Exchange
router.get("/top-gainers", (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);
    const stocks = getAllStocks();
    const sorted = [...stocks]
      .filter(s => s.price > 0 && s.volume > 0)
      .sort((a, b) => b.changePercent - a.changePercent)
      .slice(0, limit);
    return res.json(sorted);
  } catch (err) {
    next(err);
  }
});

// Top Losers on Dhaka Stock Exchange
router.get("/top-losers", (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);
    const stocks = getAllStocks();
    const sorted = [...stocks]
      .filter(s => s.price > 0 && s.volume > 0)
      .sort((a, b) => a.changePercent - b.changePercent)
      .slice(0, limit);
    return res.json(sorted);
  } catch (err) {
    next(err);
  }
});

// 3. Get single stock details
router.get("/:symbol", async (req, res, next) => {
  try {
    const symbol = req.params.symbol.toUpperCase().trim();
    
    // Auto-sync company from official DSE page if missing snapshot or stale (>10 mins)
    const existingSnap = DseMarketDataManager.getLatestSnapshot(symbol);
    const snapAge = existingSnap?.retrievedAt ? Date.now() - new Date(existingSnap.retrievedAt).getTime() : Infinity;
    if (!existingSnap || snapAge > 10 * 60 * 1000) {
      await defaultDseSyncService.syncCompany(symbol).catch(err => {
        console.warn(`[StockDetail] Auto-sync warning for ${symbol}:`, err.message);
      });
    }

    const stock = getStockBySymbol(symbol);

    if (!stock) {
      return res.status(404).json({ error: `Stock symbol '${symbol}' not found on Dhaka Stock Exchange.` });
    }

    const meta = getMetadata();
    const reportedRatios = DseFinancialsManager.getReportedRatios(symbol);
    const statements = DseFinancialsManager.getFinancialStatements(symbol);
    const shareholding = DseShareholdingManager.getShareholding(symbol);
    const corporateActions = DseCorporateActionsManager.getCorporateActions(symbol);
    const disclosures = DseDisclosuresManager.getDisclosures(symbol);
    const snap = DseMarketDataManager.getLatestSnapshot(symbol);

    res.json({
      ...stock,
      companyName: stock.name,
      market: {
        lastPrice: stock.price,
        change: stock.change,
        changePercent: stock.changePercent,
        volume: stock.volume,
        trades: stock.trades,
        turnover: stock.volume * stock.price
      },
      week52High: snap?.weekHigh52 ?? (stock as any).week52High ?? null,
      week52Low: snap?.weekLow52 ?? (stock as any).week52Low ?? null,
      freeFloat: snap?.freeFloat ?? null,
      financials: statements.length > 0 ? statements : (stock.financials || null),
      ratios: reportedRatios || null,
      shareholding: shareholding.length > 0 ? shareholding : null,
      corporateActions: corporateActions.length > 0 ? corporateActions : [],
      disclosures: disclosures.length > 0 ? disclosures : [],
      dataSource: stock.isGeneratedFallback ? "LOCAL_DEVELOPMENT_FALLBACK" : "DSE_OFFICIAL",
      dataDate: meta.lastUpdated,
      retrievedAt: meta.lastUpdated,
      sourceUrl: `https://www.dse.com.bd/company/${symbol}`,
      source: meta.source,
      lastUpdated: meta.lastUpdated,
      isSimulation: meta.isSimulation
    });
  } catch (err) {
    next(err);
  }
});

// 4. Get stock charts
router.get("/:symbol/chart", (req, res, next) => {
  try {
    const symbol = req.params.symbol.toUpperCase().trim();
    const days = req.query.days ? parseInt(req.query.days as string, 10) : 60;
    
    const stock = getStockBySymbol(symbol);
    if (!stock) {
      return res.status(404).json({ error: `Stock symbol '${symbol}' not found.` });
    }

    const histResult = getStockHistory(symbol, days);
    const hasRealHistory = histResult && histResult.source !== "NoHistoricalData" && histResult.data.length > 0;

    if (hasRealHistory) {
      const raw = histResult.data.map(item => ({ ...item })) as any[];
      
      // Compute SMA/EMA/RSI indicators dynamically on real historical closing prices
      let gains = 0;
      let losses = 0;

      for (let i = 0; i < raw.length; i++) {
        if (i >= 20) {
          let sum = 0;
          for (let j = i - 20; j < i; j++) sum += raw[j].close;
          raw[i].sma20 = parseFloat((sum / 20).toFixed(2));
        } else {
          raw[i].sma20 = raw[i].close;
        }

        if (i >= 50) {
          let sum = 0;
          for (let j = i - 50; j < i; j++) sum += raw[j].close;
          raw[i].ema50 = parseFloat((sum / 50).toFixed(2));
        } else {
          raw[i].ema50 = raw[i].close;
        }

        // Real standard Wilder's RSI (14) from actual closing prices (NO pseudo-random / Math.sin values)
        if (i === 0) {
          raw[i].rsi = 50;
        } else if (i <= 14) {
          const diff = raw[i].close - raw[i - 1].close;
          if (diff >= 0) gains += diff;
          else losses += Math.abs(diff);
          if (i === 14) {
            const avgG = gains / 14;
            const avgL = losses / 14;
            raw[i].rsi = avgL === 0 ? 100 : parseFloat((100 - (100 / (1 + avgG / avgL))).toFixed(1));
          } else {
            raw[i].rsi = 50;
          }
        } else {
          const diff = raw[i].close - raw[i - 1].close;
          const curGain = diff >= 0 ? diff : 0;
          const curLoss = diff < 0 ? Math.abs(diff) : 0;
          gains = (gains * 13 + curGain) / 14;
          losses = (losses * 13 + curLoss) / 14;
          raw[i].rsi = losses === 0 ? 100 : parseFloat((100 - (100 / (1 + gains / losses))).toFixed(1));
        }
      }

      const rowsCount = histResult.coverage?.rows || raw.length;
      let warning: string | undefined = undefined;
      if (rowsCount < 50) {
        warning = `Only ${rowsCount} historical rows are available. Analysis confidence is limited.`;
      }

      return res.json({
        symbol: symbol,
        source: histResult.source,
        coverage: histResult.coverage,
        warning,
        data: raw
      });
    }


    return res.json({
      symbol: symbol,
      source: "NO_DATA",
      coverage: null,
      warning: "Official DSE historical data is unavailable for this security.",
      data: []
    });
  } catch (err) {
    next(err);
  }
});

// 5. Watchlist get operations
router.get("/watchlist/list", authenticateToken as any, (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const email = req.userEmail;
    if (!email) return res.status(401).json({ error: "Unauthorized session." });

    const watchSymbols = WatchlistRepository.getWatchlist(email);
    const meta = getMetadata();

    // Map watch symbols to actual stock data
    const list = watchSymbols.map(sym => {
      const stock = getStockBySymbol(sym);
      if (!stock) return null;
      return {
        ...stock,
        source: meta.source,
        lastUpdated: meta.lastUpdated,
        isSimulation: meta.isSimulation
      };
    }).filter(s => s !== null);

    res.json(list);
  } catch (err) {
    next(err);
  }
});

// 6. Watchlist add
router.post("/watchlist/add", authenticateToken as any, requireEmailVerified as any, (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const email = req.userEmail;
    const { symbol } = req.body;

    if (!email) return res.status(401).json({ error: "Unauthorized session." });
    if (!symbol) return res.status(400).json({ error: "Stock symbol parameter is required." });

    const stock = getStockBySymbol(symbol);
    if (!stock) {
      return res.status(404).json({ error: `Symbol '${symbol}' does not exist.` });
    }

    const updatedList = WatchlistRepository.addToWatchlist(email, symbol);
    res.json({ success: true, watchlist: updatedList });
  } catch (err) {
    next(err);
  }
});

// 7. Watchlist remove
router.post("/watchlist/remove", authenticateToken as any, requireEmailVerified as any, (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const email = req.userEmail;
    const { symbol } = req.body;

    if (!email) return res.status(401).json({ error: "Unauthorized session." });
    if (!symbol) return res.status(400).json({ error: "Stock symbol parameter is required." });

    const updatedList = WatchlistRepository.removeFromWatchlist(email, symbol);
    res.json({ success: true, watchlist: updatedList });
  } catch (err) {
    next(err);
  }
});

// 8. Refresh coverage-summary.json by executing investing-history import script
router.post("/historical/refresh-coverage", verifyAdminSecret, (req, res, next) => {
  try {
    exec("npx tsx scripts/import-investing-history.ts", (err: any, stdout: string, stderr: string) => {
      if (err) {
        console.error("Failed to run import-investing-history.ts script:", err, stderr);
        return res.status(500).json({ success: false, error: err.message, stderr });
      }
      res.json({ success: true, message: "Coverage summary successfully regenerated.", stdout });
    });
  } catch (err: any) {
    next(err);
  }
});

export const StocksRouter = router;
