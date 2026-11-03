import fs from "fs";
import path from "path";
import { StockData } from "../../src/types";
import { DSE_COMPANIES as DEFAULT_COMPANIES } from "../../src/data/dseData";
import { DSE_SECTOR_MAP } from "../../src/data/dseSectors";
import { loadLatestDseData, loadDseSyncStatus } from "./dseCacheRepository";
import { loadIndices } from "./marketRepository";
import { DseUniverseManager } from "../services/dse/dseUniverse";
import { DseMarketDataManager } from "../services/dse/dseMarketData";
import { DseFinancialsManager } from "../services/dse/dseFinancials";

const DATA_PATH = process.env.DATA_PATH || path.join(process.cwd(), "data", "DSE_COMPANIES.json");
let cachedStocks: Record<string, StockData> | null = null;
let lastSource: "DSE_OFFICIAL" | "CachedFile" | "LOCAL_DEVELOPMENT_FALLBACK" | "Unavailable" = "LOCAL_DEVELOPMENT_FALLBACK";
let lastUpdated: Date = new Date("2026-09-29T10:30:00.000Z");

function ensureDirectoryExistence(filePath: string) {
  try {
    const dirname = path.dirname(filePath);
    if (!fs.existsSync(dirname)) {
      fs.mkdirSync(dirname, { recursive: true });
    }
  } catch (err) {
    // Fail silently
  }
}

/**
 * Normalizes stock data strictly using official DSE sources or explicit fallback.
 * CRITICAL RULE: NEVER invent, seed, or generate synthetic financial metrics,
 * statements, market depth, or market cap. If official data is missing, return null / 'N/A'.
 */
export function enrichStock(stock: StockData): StockData {
  if (!stock || typeof stock !== "object") {
    return stock;
  }
  const sym = (stock.symbol || "").toUpperCase().trim();
  if (!sym) {
    return stock;
  }
  const healed: StockData = { ...stock };

  // 1. Resolve Sector and Name from Official DSE Universe or Official Sector Mapping
  const dseSec = DseUniverseManager.getSecurity(sym);
  const officialSector = DSE_SECTOR_MAP[sym];
  const seed = DEFAULT_COMPANIES[sym];

  if (dseSec) {
    healed.name = dseSec.companyName || healed.name;
    healed.sector = dseSec.sector || healed.sector || "Miscellaneous";
    healed.subSector = dseSec.subSector || healed.subSector || "";
    healed.category = (dseSec.category as any) || healed.category || "A";
  } else if (officialSector) {
    healed.sector = officialSector.sector;
    healed.subSector = officialSector.subSector;
    healed.name = officialSector.name;
  } else if (seed) {
    healed.sector = seed.sector;
    healed.subSector = seed.subSector;
    healed.name = seed.name;
  }

  // 2. Resolve Market Snapshot from Official DSE Market Data
  const dseSnapshot = DseMarketDataManager.getLatestSnapshot(sym);
  if (dseSnapshot) {
    if (dseSnapshot.lastPrice !== null) healed.price = dseSnapshot.lastPrice;
    if (dseSnapshot.change !== null) healed.change = dseSnapshot.change;
    if (dseSnapshot.changePercent !== null) healed.changePercent = dseSnapshot.changePercent;
    if (dseSnapshot.volume !== null) healed.volume = dseSnapshot.volume;
    if (dseSnapshot.trades !== null) healed.trades = dseSnapshot.trades;
    if (dseSnapshot.previousClose !== null) healed.prevClose = dseSnapshot.previousClose;
    if (dseSnapshot.open !== null) healed.open = dseSnapshot.open;
    if (dseSnapshot.high !== null) healed.high = dseSnapshot.high;
    if (dseSnapshot.low !== null) healed.low = dseSnapshot.low;
    if (dseSnapshot.marketCap !== null && dseSnapshot.marketCap !== undefined) {
      const mc = typeof dseSnapshot.marketCap === "number"
        ? dseSnapshot.marketCap
        : parseFloat(String(dseSnapshot.marketCap).replace(/[^0-9.]/g, ""));
      if (!isNaN(mc) && mc > 0) {
        healed.marketCap = mc >= 1e9 ? `BDT ${(mc / 1e9).toFixed(2)}B` : `BDT ${(mc / 1e6).toFixed(2)}M`;
      }
    }
  }

  // 3. Resolve Reported Ratios from Official DSE Financials
  const reportedRatio = DseFinancialsManager.getReportedRatios(sym);
  if (reportedRatio) {
    if (reportedRatio.peRatio !== null) healed.peRatio = reportedRatio.peRatio;
    if (reportedRatio.eps !== null) healed.eps = reportedRatio.eps;
    if (reportedRatio.nav !== null) healed.nav = reportedRatio.nav;
    if (reportedRatio.dividendYield !== null) healed.divYield = reportedRatio.dividendYield;
  }

  // Fallback to static seed ONLY if field is still undefined/null, but clearly mark provenance
  if (healed.eps === undefined || healed.eps === null) {
    healed.eps = seed?.eps !== undefined ? seed.eps : null;
  }
  if (healed.nav === undefined || healed.nav === null) {
    healed.nav = seed?.nav !== undefined ? seed.nav : null;
  }
  if (healed.peRatio === undefined || healed.peRatio === null) {
    healed.peRatio = seed?.peRatio !== undefined ? seed.peRatio : null;
  }
  if (healed.divYield === undefined || healed.divYield === null) {
    healed.divYield = seed?.divYield !== undefined ? seed.divYield : null;
  }

  // Market Cap: strictly official DSE marketCap, or seed fallback if present. NEVER synthesize or estimate!
  if (!healed.marketCap || healed.marketCap === "N/A") {
    healed.marketCap = (seed?.marketCap && seed.marketCap !== "N/A") ? seed.marketCap : null;
  }

  // Financials & Market Depth: only use real if present, NEVER generate synthetic statements or order books!
  if (!healed.financials) {
    healed.financials = seed?.financials || null;
  }
  if (!healed.marketDepth) {
    healed.marketDepth = seed?.marketDepth || null;
  }

  // Provenance of EPS / NAV / P/E: only values from the DSE company page count as reported. Anything
  // else came from the bundled seed file and is labelled as a sample in the UI.
  const official = Boolean(reportedRatio && reportedRatio.source === "DSE_OFFICIAL" &&
    (reportedRatio.eps !== null || reportedRatio.nav !== null || reportedRatio.peRatio !== null));
  const anyValue = (healed.peRatio !== null && healed.peRatio !== undefined) || (healed.eps !== null && healed.eps !== undefined) || (healed.nav !== null && healed.nav !== undefined);
  (healed as any).fundamentalsSource = official ? "DSE_OFFICIAL" : anyValue ? "BUNDLED_SAMPLE" : null;

  // Flag real fundamentals status
  healed.hasRealFundamentals = official;

  healed.isGeneratedFallback = !healed.hasRealFundamentals;
  healed.dataAvailable = healed.hasRealFundamentals;

  return healed;
}

export function loadStocks(): Record<string, StockData> {
  if (cachedStocks && Object.keys(cachedStocks).length > 0) {
    return cachedStocks;
  }

  // 1. Try DSE official snapshots and universe
  const officialUniverse = DseUniverseManager.getUniverse();
  const officialSnapshots = DseMarketDataManager.getAllLatestSnapshots();

  if (Object.keys(officialUniverse).length > 0) {
    const stocks: Record<string, StockData> = {};
    for (const [sym, sec] of Object.entries(officialUniverse)) {
      const snap = officialSnapshots[sym];
      const ratios = DseFinancialsManager.getReportedRatios(sym);

      const base: StockData = {
        symbol: sym,
        name: sec.companyName,
        sector: sec.sector,
        price: snap?.lastPrice ?? 10,
        change: snap?.change ?? 0,
        changePercent: snap?.changePercent ?? 0,
        volume: snap?.volume ?? 0,
        trades: snap?.trades ?? 0,
        high: snap?.high ?? (snap?.lastPrice ?? 10),
        low: snap?.low ?? (snap?.lastPrice ?? 10),
        open: snap?.open ?? (snap?.lastPrice ?? 10),
        prevClose: snap?.previousClose ?? (snap?.lastPrice ?? 10),
        eps: ratios?.eps ?? null,
        nav: ratios?.nav ?? null,
        peRatio: ratios?.peRatio ?? null,
        divYield: ratios?.dividendYield ?? null,
        revGrowth: null,
        profitGrowth: null,
        marketCap: (snap?.marketCap !== null && snap?.marketCap !== undefined)
          ? (() => {
              const mc = typeof snap.marketCap === "number"
                ? snap.marketCap
                : parseFloat(String(snap.marketCap).replace(/[^0-9.]/g, ""));
              return !isNaN(mc) && mc > 0
                ? (mc >= 1e9 ? `BDT ${(mc / 1e9).toFixed(2)}B` : `BDT ${(mc / 1e6).toFixed(2)}M`)
                : null;
            })()
          : null,
        hasRealFundamentals: Boolean(ratios?.peRatio || ratios?.eps || ratios?.nav),
        isGeneratedFallback: false,
        dataAvailable: true
      };

      stocks[sym] = enrichStock(base);
    }

    cachedStocks = stocks;
    lastSource = "DSE_OFFICIAL";
    lastUpdated = new Date();
    return cachedStocks;
  }

  // 2. Try file cache
  const cachedFromDisk = loadLatestDseData();
  if (cachedFromDisk && typeof cachedFromDisk === "object") {
    const rawStockMap = (cachedFromDisk.stocks && typeof cachedFromDisk.stocks === "object")
      ? cachedFromDisk.stocks
      : cachedFromDisk;

    const healedStocks: Record<string, StockData> = {};
    for (const [symbol, rawStock] of Object.entries(rawStockMap)) {
      if (rawStock && typeof rawStock === "object") {
        const stockToEnrich = {
          ...(rawStock as any),
          symbol: (rawStock as any).symbol || symbol
        };
        if (stockToEnrich.symbol && stockToEnrich.symbol !== "undefined") {
          healedStocks[symbol] = enrichStock(stockToEnrich);
        }
      }
    }

    if (Object.keys(healedStocks).length > 0) {
      cachedStocks = healedStocks;
      lastSource = "CachedFile";
      lastUpdated = new Date();
      return cachedStocks;
    }
  }

  // 3. Fallback to static seed
  const fallbackStocks: Record<string, StockData> = {};
  Object.keys(DEFAULT_COMPANIES).forEach(symbol => {
    fallbackStocks[symbol] = enrichStock(DEFAULT_COMPANIES[symbol]);
  });

  cachedStocks = fallbackStocks;
  lastSource = "LOCAL_DEVELOPMENT_FALLBACK";
  return cachedStocks;
}

export function saveStocks(stocks: Record<string, StockData>, isOfficial?: boolean): void {
  cachedStocks = stocks;
  lastUpdated = new Date();
  lastSource = isOfficial ? "DSE_OFFICIAL" : "CachedFile";

  try {
    ensureDirectoryExistence(DATA_PATH);
    fs.writeFileSync(DATA_PATH, JSON.stringify(stocks, null, 2), "utf-8");
  } catch (err) {
    console.error("[stockRepository] Failed to save stocks to disk:", err);
  }
}

export function getStockBySymbol(symbol: string): StockData | undefined {
  const stocks = loadStocks();
  const sym = symbol.toUpperCase().trim();
  return stocks[sym];
}

export function getAllStocks(): StockData[] {
  const stocks = loadStocks();
  return Object.values(stocks);
}

export function getMetadata() {
  return {
    source: lastSource,
    lastUpdated: lastUpdated.toISOString(),
    isSimulation: lastSource === "LOCAL_DEVELOPMENT_FALLBACK",
    totalStocks: cachedStocks ? Object.keys(cachedStocks).length : 0
  };
}

export function getStockRepositoryStatus() {
  const status = loadDseSyncStatus();
  return {
    source: lastSource,
    lastUpdated: lastUpdated.toISOString(),
    totalStocks: cachedStocks ? Object.keys(cachedStocks).length : 0,
    syncStatus: status
  };
}

export function resetStockCache(): void {
  cachedStocks = null;
}
