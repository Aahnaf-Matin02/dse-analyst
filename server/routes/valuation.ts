import { Router, Request, Response } from "express";
import { loadStocks } from "../repositories/stockRepository";
import { getStockHistory, getIndexHistory } from "../repositories/historicalRepository";
import { calculateComparativeMetrics } from "../services/analyticsService";
import { EquityValuationModel } from "../services/equityValuationModel";

export const ValuationRouter = Router();

// In-memory cache representing Redis/database TTL 1 hour
interface CacheEntry {
  data: any;
  expiry: number;
}
const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

ValuationRouter.get("/:symbol", (req: Request, res: Response) => {
  try {
    const symbol = req.params.symbol.toUpperCase().trim();
    if (!symbol) {
      return res.status(400).json({ error: "Ticker symbol parameter is required." });
    }

    // 1. Check Cache
    const now = Date.now();
    const cached = cache.get(symbol);
    if (cached && cached.expiry > now) {
      return res.json(cached.data);
    }

    // 2. Fetch stock data from repositories
    const stocksMap = loadStocks();
    const stock = stocksMap[symbol];

    if (!stock) {
      return res.status(404).json({ error: `Stock ticker '${symbol}' not found in DSE records.` });
    }

    const currentPrice = stock.price || stock.ltp || 1;
    const bvps = stock.nav;
    const eps = stock.eps;
    const sector = stock.sector || "Miscellaneous";
    const debtRatio = stock.financials?.debtRatio ?? null;
    const revGrowth = stock.revGrowth ?? null;
    const profitGrowth = stock.profitGrowth ?? null;
    const name = stock.name || symbol;

    // 3. Unprocessable state if NAV/Book Value matches zero (422 error validation rule)
    if (bvps === null || bvps === undefined || bvps <= 0) {
      return res.status(422).json({
        error: `Book value (NAV) is zero or unavailable for stock ${symbol}. Enterprise Book Value analysis is impossible.`,
        code: "NAV_UNAVAILABLE"
      });
    }

    // 4. Derive Beta dynamically from 365 Days historical DSEX ratios
    let beta = 1.0;
    try {
      const stockHist = getStockHistory(symbol, 365)?.data || [];
      const dsexHist = getIndexHistory("DSEX", 365)?.data || [];
      if (stockHist.length > 0 && dsexHist.length > 0) {
        const metrics = calculateComparativeMetrics(stockHist, dsexHist);
        if (metrics?.beta && !isNaN(metrics.beta)) {
          beta = metrics.beta;
        }
      }
    } catch (err: any) {
      console.warn(`[valuation] Dynamic beta calculation bypassed for ${symbol}. Error: ${err.message}`);
    }

    // 5. Calculate Valuation Result
    const result = EquityValuationModel.calculateEquityValuation({
      symbol,
      currentPrice,
      bvps,
      eps,
      beta,
      sector,
      debtRatio,
      revGrowth,
      profitGrowth,
      name,
      financials: stock.financials,
      divYield: stock.divYield
    });

    // 6. Cache write
    cache.set(symbol, {
      data: result,
      expiry: now + CACHE_TTL_MS
    });

    res.json(result);
  } catch (err: any) {
    console.error(`[valuation] Critical valuation compile error for ${req.params.symbol}:`, err);
    res.status(500).json({ error: `Internal calculator error compiled during dynamic valuation: ${err.message}` });
  }
});
