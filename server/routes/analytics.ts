import { Router, Request, Response } from "express";
import {
  getStockHistory,
  getIndexHistory,
  getAvailableHistorySymbols
} from "../repositories/historicalRepository";
import { loadStocks, getAllStocks } from "../repositories/stockRepository";
import {
  calculatePriceEnvelope,
  calculateComparativeMetrics,
  optimizePortfolio
} from "../services/analyticsService";
import { EquityValuationModel } from "../services/equityValuationModel";

export const AnalyticsRouter = Router();

// 1. GET /api/analytics/screener?days=540&benchmark=DSEX
AnalyticsRouter.get("/screener", (req: Request, res: Response) => {
  try {
    const days = req.query.days ? parseInt(req.query.days as string, 10) : 540;
    const benchmark = (req.query.benchmark as string) || "DSEX";

    const availableSymbols = getAvailableHistorySymbols();
    const stocksMap = loadStocks();
    const benchmarkHistory = getIndexHistory(benchmark as any, days);

    const screenerResults: any[] = [];

    availableSymbols.forEach(sym => {
      const stock = stocksMap[sym];
      // Skip if symbol doesn't exist in Stock database (inactive/delisted)
      if (!stock) return;

      const sHistObj = getStockHistory(sym, days);
      const sHist = sHistObj?.data || [];

      // Only aggregate if we have valid historical rows
      if (sHist.length === 0) return;

      // Price Envelope Trigger
      const envObj = calculatePriceEnvelope(sHist, 20, 5);
      const envPoints = envObj.data;
      const latestEnv = envPoints.length > 0 ? envPoints[envPoints.length - 1] : null;

      // Comparative stats vs Benchmark
      const comp = calculateComparativeMetrics(sHist, benchmarkHistory.data);

      screenerResults.push({
        symbol: sym,
        companyName: stock.name,
        sector: stock.sector || "Miscellaneous",
        close: latestEnv ? latestEnv.close : (stock.price || stock.ltp || 0),
        rating: comp?.rating || "Market Perform",
        excessReturn1Y: comp?.excessReturn1Y ?? null,
        stockReturn1Y: comp?.stockReturn1Y ?? null,
        beta: comp?.beta ?? null,
        correlation: comp?.correlation ?? null,
        volatility: comp?.volatility ?? null,
        maxDrawdown: comp?.maxDrawdown ?? null,
        signal: latestEnv ? latestEnv.signal : "Neutral",
        zone: latestEnv ? latestEnv.zone : "Upper Half"
      });
    });

    res.json(screenerResults);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to evaluate screener metric indicators: " + err.message });
  }
});

// 2. GET /api/analytics/:symbol?days=540&benchmark=DSEX&period=20&envelopePct=5
AnalyticsRouter.get("/:symbol", (req: Request, res: Response) => {
  try {
    const symbol = req.params.symbol.toUpperCase().trim();
    const days = req.query.days ? parseInt(req.query.days as string, 10) : 540;
    const benchmark = (req.query.benchmark as string) || "DSEX";
    const period = req.query.period ? parseInt(req.query.period as string, 10) : 20;
    const envelopePct = req.query.envelopePct ? parseFloat(req.query.envelopePct as string) : 5;

    if (!symbol) {
      return res.status(400).json({ error: "Ticker symbol parameter is required." });
    }

    // Load histories
    const stockHistory = getStockHistory(symbol, days);
    if (stockHistory.source === "NoHistoricalData" || stockHistory.data.length === 0) {
      return res.json({
        symbol,
        dataQuality: "InsufficientHistory",
        warnings: [`No historical Close/LTP records found in files for ticker ${symbol}.`],
        envelopeData: [],
        comparison: null
      });
    }

    const benchmarkHistory = getIndexHistory(benchmark as any, days);

    // 1. Calculate price envelopes
    const envelopeResult = calculatePriceEnvelope(stockHistory.data, period, envelopePct);

    // 2. Calculate comparative metrics vs benchmark
    const comparisonResult = calculateComparativeMetrics(stockHistory.data, benchmarkHistory.data);

    res.json({
      symbol,
      dataQuality: envelopeResult.dataQuality,
      warnings: envelopeResult.warnings,
      envelopeData: envelopeResult.data,
      comparison: comparisonResult
    });
  } catch (err: any) {
    res.status(500).json({ error: `Failed to load metrics for stock ${req.params.symbol}: ${err.message}` });
  }
});

// 3. POST /api/portfolio/optimize
AnalyticsRouter.post("/optimize", (req: Request, res: Response) => {
  try {
    const {
      selectedSymbols,
      riskProfile,
      capital,
      maxWeightPerStock,
      maxSectorExposure
    } = req.body;

    if (!selectedSymbols || !Array.isArray(selectedSymbols) || selectedSymbols.length === 0) {
      return res.status(400).json({ error: "Missing selectedSymbols list of strings inside payload." });
    }

    const cap = parseFloat(capital || "100000");
    if (isNaN(cap) || cap <= 0) {
      return res.status(400).json({ error: "A valid positive capital quantity is required." });
    }

    const risk = riskProfile || "Balanced";
    if (!["Conservative", "Balanced", "Aggressive"].includes(risk)) {
      return res.status(400).json({ error: "Invalid riskProfile parameter. Must be Conservative, Balanced or Aggressive." });
    }

    // Core data sources
    const stocksMap = loadStocks();
    const benchmarkHistory = getIndexHistory("DSEX", 365);

    const historyFetcher = (sym: string) => {
      return getStockHistory(sym, 365);
    };

    // Run Optimization
    const optimized = optimizePortfolio(
      selectedSymbols,
      stocksMap,
      historyFetcher,
      benchmarkHistory.data,
      risk,
      cap,
      maxWeightPerStock ? parseFloat(maxWeightPerStock) : 30,
      maxSectorExposure ? parseFloat(maxSectorExposure) : 40
    );

    res.json(optimized);
  } catch (err: any) {
    res.status(500).json({ error: "Portfolio optimizer failed: " + err.message });
  }
});

// 4. GET /api/analytics/valuation/:symbol
AnalyticsRouter.get("/valuation/:symbol", (req: Request, res: Response) => {
  try {
    const symbol = req.params.symbol.toUpperCase().trim();
    if (!symbol) {
      return res.status(400).json({ error: "Ticker symbol parameter is required." });
    }

    const stocksMap = loadStocks();
    const stock = stocksMap[symbol];
    if (!stock) {
      return res.status(404).json({ error: `Stock symbol '${symbol}' not found.` });
    }

    const stockHistory = getStockHistory(symbol, 365);
    const benchmarkHistory = getIndexHistory("DSEX", 365);
    let beta = 1.0;
    if (stockHistory.data && stockHistory.data.length > 0) {
      const comp = calculateComparativeMetrics(stockHistory.data, benchmarkHistory.data);
      beta = comp?.beta ?? 1.0;
    }

    const valuationResult = EquityValuationModel.calculateEquityValuation({
      symbol,
      currentPrice: stock.price || 0.0,
      bvps: stock.nav || 0.0,
      eps: stock.eps || 0.0,
      beta,
      sector: stock.sector || "Miscellaneous",
      debtRatio: stock.financials?.debtRatio || null,
      revGrowth: stock.revGrowth || 0.0,
      profitGrowth: stock.profitGrowth || 0.0,
      name: stock.name || "",
      divYield: stock.divYield || 0.0
    });

    res.json(valuationResult);
  } catch (err: any) {
    res.status(500).json({ error: `Failed to compile valuation matrix for ${req.params.symbol}: ${err.message}` });
  }
});
