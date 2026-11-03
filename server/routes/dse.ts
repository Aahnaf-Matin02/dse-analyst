import { Router, Response, NextFunction } from "express";
import { defaultDseSyncService } from "../services/dse/dseSyncService";
import { DseUniverseManager } from "../services/dse/dseUniverse";
import { DseMarketDataManager } from "../services/dse/dseMarketData";
import { DseFinancialsManager } from "../services/dse/dseFinancials";
import { DseDisclosuresManager } from "../services/dse/dseDisclosures";
import { DseCorporateActionsManager } from "../services/dse/dseCorporateActions";
import { DseHistoricalDataManager } from "../services/dse/dseHistoricalData";
import { getAllStocks, getStockBySymbol, saveStocks } from "../repositories/stockRepository";
import { getGeminiStatus, hasGeminiApiKey, isGeminiAvailable } from "../services/geminiService";
import { loadLatestDseData, saveLatestDseData, saveDseSyncStatus, loadDseSyncStatus } from "../repositories/dseCacheRepository";
import { loadIndices } from "../repositories/marketRepository";
import { HistoryRepository } from "../repositories/historyRepository";
import { DSEScraper } from "../services/dseScraper";
import { defaultDseStorage } from "../services/storage/dseStorage";
import { StockData } from "../../src/types";

const router = Router();

// GET /api/dse/status - Official DSE connectivity and synchronization health
router.get("/status", (req, res, next) => {
  try {
    const universeCount = DseUniverseManager.getCount();
    const marketCount = DseMarketDataManager.getSnapshotCount();
    const universeSymbols = DseUniverseManager.getAllSymbols();
    const syncStatus = loadDseSyncStatus();
    const scraperStatus = DSEScraper.getStatus();
    const lastSyncTime = defaultDseSyncService.getLastSyncTime();

    // Live state strictly depends on the last scrape RESULT, not record counts
    const isLastScrapeSuccessful = (syncStatus?.status === "Success" || scraperStatus.status === "Success") &&
      (syncStatus?.source === "LiveScraped" || scraperStatus.source === "LiveScraped");

    const sourceStatus = isLastScrapeSuccessful
      ? "DSE_OFFICIAL"
      : (marketCount > 0 || universeCount > 0 ? "DSE_OFFICIAL_CACHE" : "LOCAL_DEVELOPMENT_FALLBACK");

    // 1. Real historical price coverage (% of universe tickers that have historical price data on disk/store)
    const historicalDataCoverage = HistoryRepository.computeCoverage(universeSymbols);

    // 2. Real stored disclosures and corporate actions count (null if data is not collected)
    const disclosureCount = DseDisclosuresManager.getTotalCount();
    const corporateActionCount = DseCorporateActionsManager.getTotalCount();

    // 3. Real financial data count (securities with actual populated fundamental metrics/statements, or null)
    const financialDataCount = DseFinancialsManager.getPopulatedCount();

    // 4. Stale records: compares each snapshot's trading date with the last expected trading day (Sun-Thu, Asia/Dhaka)
    const expectedTradingDay = DseMarketDataManager.getLastExpectedTradingDay();
    const staleRecords = DseMarketDataManager.getStaleSnapshotCount(expectedTradingDay);

    // 5. Auditable Data Quality Score Formula:
    // Total Quality Score (0-100) = Sum of 4 measurable components:
    // - Component A: Universe Coverage (max 25 pts) = min(25, (universeCount / 650 expected) * 25)
    // Auditable Data Quality Scoring (100-point composite model across 5 pillars):
    // - Component A: Universe Coverage (max 20 pts) = (universeCount / 650) * 20
    // - Component B: Valid Trading Metrics (max 20 pts) = (valid non-zero price & non-null volume / marketCount) * 20
    // - Component C: Sync Freshness (max 20 pts) = recency of last sync (<=1h: 20, <=6h: 16, <=24h: 12, <=48h: 8, >48h: 4, none: 0)
    // - Component D: Sector Mapping (max 20 pts) = (identified non-miscellaneous sector tickers / universeCount) * 20
    // - Component E: Historical Coverage (max 20 pts) = (historicalDataCoverage% / 100) * 20
    const universeCoverageScore = universeCount > 0
      ? Math.min(20, parseFloat(((universeCount / 650) * 20).toFixed(1)))
      : 0;

    const validMetricsCount = DseMarketDataManager.getValidMetricsCount();
    const validTradingMetricsScore = marketCount > 0
      ? parseFloat(((validMetricsCount / marketCount) * 20).toFixed(1))
      : 0;

    const lastSyncIso = syncStatus?.lastSuccessfulSync !== undefined
      ? syncStatus.lastSuccessfulSync
      : (lastSyncTime ? new Date(lastSyncTime).toISOString() : null);

    let syncFreshnessScore = 0;
    if (lastSyncIso) {
      const ageMs = Date.now() - new Date(lastSyncIso).getTime();
      if (ageMs <= 60 * 60 * 1000) syncFreshnessScore = 20;
      else if (ageMs <= 6 * 60 * 60 * 1000) syncFreshnessScore = 16;
      else if (ageMs <= 24 * 60 * 60 * 1000) syncFreshnessScore = 12;
      else if (ageMs <= 48 * 60 * 60 * 1000) syncFreshnessScore = 8;
      else syncFreshnessScore = 4;
    }

    let knownSectorCount = 0;
    const universeMap = DseUniverseManager.getUniverse();
    const effectiveUniverseTotal = Math.max(universeCount, Object.keys(universeMap).length);
    for (const sec of Object.values(universeMap)) {
      if (sec.sector && sec.sector !== "Miscellaneous" && sec.sector !== "Unknown" && sec.sector.trim().length > 0) {
        knownSectorCount++;
      }
    }
    const sectorMappingScore = effectiveUniverseTotal > 0
      ? parseFloat((Math.min(20, (knownSectorCount / effectiveUniverseTotal) * 20)).toFixed(1))
      : 0;

    const historicalCoverageScore = parseFloat((Math.min(20, (historicalDataCoverage / 100) * 20)).toFixed(1));

    const dataQualityScore = Math.min(100, Math.round(
      universeCoverageScore + validTradingMetricsScore + syncFreshnessScore + sectorMappingScore + historicalCoverageScore
    ));

    // Map sourceStatus to the frontend's expected enum strictly for the client source field
    const frontendSource = sourceStatus === "DSE_OFFICIAL"
      ? "LiveScraped"
      : (sourceStatus === "DSE_OFFICIAL_CACHE" ? "CachedFile" : "DefaultSeed");

    res.json({
      status: isLastScrapeSuccessful ? "Live" : (marketCount > 0 || universeCount > 0 ? "Cached" : "Seeded"),
      source: frontendSource,
      live: isLastScrapeSuccessful,
      connected: isLastScrapeSuccessful || (universeCount > 0 && marketCount > 0),
      activeEndpoint: "https://www.dse.com.bd",
      lastSuccessfulSync: lastSyncIso,
      lastAttemptTime: syncStatus?.lastAttemptTime || null,
      expectedTradingDay,
      universeCount,
      marketDataCount: marketCount,
      financialDataCount,
      historicalDataCoverage,
      disclosureCount,
      corporateActionCount,
      staleRecords,
      dataQualityScore,
      dataQualityBreakdown: {
        universeCoverage: universeCoverageScore,
        validTradingMetrics: validTradingMetricsScore,
        syncFreshness: syncFreshnessScore,
        sectorMapping: sectorMappingScore,
        historicalCoverage: historicalCoverageScore
      },
      storageTier: defaultDseStorage.getUniverseTier(),
      storageNote: defaultDseStorage.getStorageNote(),
      sourceStatus,
      aiStatus: getGeminiStatus(),
      geminiConfigured: hasGeminiApiKey(),
      geminiAvailable: isGeminiAvailable()
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/dse/data-quality - Comprehensive data quality and coverage audit
router.get("/data-quality", (req, res, next) => {
  try {
    const universe = DseUniverseManager.getUniverse();
    const symbols = Object.keys(universe);
    const universeCount = symbols.length;

    const snapshots = DseMarketDataManager.getAllLatestSnapshots();
    const marketCount = Object.keys(snapshots).length;

    const marketDataCoverage = universeCount > 0
      ? parseFloat(((marketCount / universeCount) * 100).toFixed(1))
      : 0;

    const profileCount = Object.values(universe).filter(u => u.companyName && u.companyName.trim().length > 0).length;
    const companyProfileCoverage = universeCount > 0
      ? parseFloat(((profileCount / universeCount) * 100).toFixed(1))
      : 0;

    const populatedFinancials = DseFinancialsManager.getPopulatedCount() || 0;
    const financialCoverage = universeCount > 0
      ? parseFloat(((populatedFinancials / universeCount) * 100).toFixed(1))
      : 0;

    const disclosures = DseDisclosuresManager.getTotalCount();
    const disclosureCoverage = disclosures !== null && universeCount > 0
      ? parseFloat((Math.min(100, (disclosures / universeCount) * 100)).toFixed(1))
      : null;

    const expectedTradingDay = DseMarketDataManager.getLastExpectedTradingDay();
    const staleRecords = DseMarketDataManager.getStaleSnapshotCount(expectedTradingDay);
    const syncStatus = loadDseSyncStatus();
    const lastSync = syncStatus?.lastSuccessfulSync || (defaultDseSyncService.getLastSyncTime() ? new Date(defaultDseSyncService.getLastSyncTime()).toISOString() : null);

    res.json({
      success: true,
      universeCount,
      marketDataCoverage,
      companyProfileCoverage,
      financialCoverage,
      disclosureCoverage,
      staleRecords,
      lastFullSync: lastSync,
      lastMarketSync: lastSync
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/dse/sync - Multi-type controlled synchronization protected by shared secret
router.post("/sync", async (req, res, next) => {
  try {
    const configuredSecret = process.env.SYNC_SECRET;
    const authHeader = req.headers["authorization"];
    const bearerToken = authHeader ? authHeader.replace(/^Bearer\s+/i, "") : null;
    const providedSecret = (req.headers["x-sync-secret"] as string) || bearerToken;

    if (!configuredSecret || providedSecret !== configuredSecret) {
      return res.status(401).json({
        error: "UNAUTHORIZED",
        message: "Protected synchronization endpoint. Valid SYNC_SECRET header (X-Sync-Secret or Bearer) required."
      });
    }

    const syncType = (req.query.type as string || "all").toLowerCase();

    let result: any;
    if (syncType === "universe") {
      result = await defaultDseSyncService.syncUniverse();
    } else if (syncType === "market") {
      result = await defaultDseSyncService.syncMarket();
    } else if (syncType === "company" && req.query.symbol) {
      const sym = String(req.query.symbol).toUpperCase();
      const ok = await defaultDseSyncService.syncCompany(sym);
      result = {
        success: ok,
        syncType: "company" as any,
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        recordsDiscovered: 1,
        recordsUpdated: ok ? 1 : 0,
        recordsInserted: 0,
        recordsFailed: ok ? 0 : 1,
        source: `https://www.dse.com.bd/company/${sym}`,
        errors: ok ? [] : [`Failed to sync company ${sym}`]
      };
    } else {
      result = await defaultDseSyncService.syncAll();
    }

    if (!result || !result.success || result.recordsDiscovered === 0) {
      const scraperRes = await DSEScraper.syncLiveDSEData(1, true);
      const isScrapeSuccess = scraperRes.success && scraperRes.live;
      result = {
        success: isScrapeSuccess,
        syncType: (req.query.type as any) || "all",
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        recordsDiscovered: scraperRes.parsedSymbols || 0,
        recordsUpdated: scraperRes.parsedSymbols || 0,
        recordsInserted: 0,
        recordsFailed: isScrapeSuccess ? 0 : 1,
        source: scraperRes.source,
        errors: isScrapeSuccess ? [] : [scraperRes.message || "Live scrape attempt failed"]
      };
    }

    const prevSyncStatus = loadDseSyncStatus();
    const now = new Date();
    const isLiveScrapeSuccess = result.success && result.source === "LiveScraped" && (result.recordsDiscovered > 0 || result.recordsUpdated > 0);

    saveDseSyncStatus({
      status: isLiveScrapeSuccess ? "Success" : (prevSyncStatus?.status || "Cached"),
      source: isLiveScrapeSuccess ? "LiveScraped" : (prevSyncStatus?.source || "CachedFile"),
      live: isLiveScrapeSuccess,
      parsedSymbols: isLiveScrapeSuccess ? result.recordsDiscovered : 0,
      cachedSymbols: result.recordsUpdated || prevSyncStatus?.cachedSymbols || 634,
      defaultSeedSymbols: 0,
      lastAttemptTime: now.toISOString(),
      lastSuccessfulSync: isLiveScrapeSuccess ? now.toISOString() : (prevSyncStatus?.lastSuccessfulSync || null),
      message: result.errors?.length ? result.errors.join("; ") : `Synchronization complete (${result.syncType || "all"}).`,
      diagnostics: {
        url: "https://www.dse.com.bd",
        httpStatus: isLiveScrapeSuccess ? 200 : 503,
        recordsDiscovered: result.recordsDiscovered || 0
      }
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/dse/live - Returns latest live state overview
router.get("/live", async (req, res, next) => {
  try {
    const result = await defaultDseSyncService.syncMarket();
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/dse/stocks - Get list of normalized DSE securities
router.get("/stocks", (req, res, next) => {
  try {
    const stocks = getAllStocks();
    res.json({
      count: stocks.length,
      stocks
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/dse/stocks/:symbol - Get single stock normalized info
router.get("/stocks/:symbol", (req, res, next) => {
  try {
    const symbol = req.params.symbol.toUpperCase().trim();
    const stock = getStockBySymbol(symbol);
    if (!stock) {
      return res.status(404).json({
        success: false,
        message: `Stock ticker "${symbol}" could not be found.`
      });
    }
    res.json(stock);
  } catch (err) {
    next(err);
  }
});

export const DSERouter = router;
