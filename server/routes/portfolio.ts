import { Router } from "express";
import { analyzePortfolio, ACTIVE_MACRO_SIGNALS } from "../services/portfolioAdvisor";
import { Holding } from "../../src/types";
import { calculateSectorExposure } from "../services/sectorExposure";
import { runStressTesting } from "../services/stressTester";
import { calculateTradingOpportunitySignal } from "../services/tradingSignal";
import { getStockHistory } from "../repositories/historicalRepository";
import { getStockBySymbol } from "../repositories/stockRepository";
import { calculateBlackLitterman } from "../services/blackLittermanOptimizer";
import { optimizePortfolio } from "../services/portfolioOptimizer";

const router = Router();


/**
 * GET /api/portfolio/macro-signals
 * Exposes current active macro conditions for Bangladesh markets
 */
router.get("/macro-signals", (req, res, next) => {
  try {
    return res.json(ACTIVE_MACRO_SIGNALS);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/portfolio/analyze
 * Computes portfolio-wide scores, indicators, macro sensitivity and actions
 */
router.post("/analyze", async (req, res, next) => {
  try {
    const { holdings, customMacro } = req.body;

    // Validate incoming parameters
    if (holdings !== undefined && !Array.isArray(holdings)) {
      return res.status(400).json({ error: "Parameter 'holdings' must be a valid array." });
    }

    const validatedHoldings: Holding[] = [];
    if (holdings) {
      for (const raw of holdings) {
        if (!raw.symbol || typeof raw.symbol !== "string") {
          return res.status(400).json({ error: "Each holding entry requires a valid string 'symbol'." });
        }
        validatedHoldings.push({
          id: raw.id || `h-${Math.random().toString(36).substr(2, 9)}`,
          symbol: raw.symbol.toUpperCase().trim(),
          quantity: typeof raw.quantity === "number" && raw.quantity > 0 ? raw.quantity : 0,
          buyPrice: typeof raw.buyPrice === "number" && raw.buyPrice > 0 ? raw.buyPrice : 0,
          purchaseDate: typeof raw.purchaseDate === "string" ? raw.purchaseDate : new Date().toISOString().split("T")[0]
        });
      }
    }

    const result = await analyzePortfolio(validatedHoldings, customMacro);
    return res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/portfolio/sector-exposure
 * Visualizes portfolio concentration across sectors
 */
router.post("/sector-exposure", (req, res, next) => {
  try {
    const { holdings } = req.body;
    if (!holdings || !Array.isArray(holdings)) {
      return res.status(400).json({ error: "Parameter 'holdings' is required and must be an array." });
    }
    const result = calculateSectorExposure(holdings);
    return res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/portfolio/stress-test
 * Runs macroeconomic event simulations on the portfolio
 */
router.post("/stress-test", (req, res, next) => {
  try {
    const { holdings } = req.body;
    if (!holdings || !Array.isArray(holdings)) {
      return res.status(400).json({ error: "Parameter 'holdings' is required and must be an array." });
    }
    const result = runStressTesting(holdings);
    return res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/portfolio/black-litterman
 * Computes Black-Litterman risk-adjusted allocation models
 */
router.post("/black-litterman", async (req, res, next) => {
  try {
    const { holdings, riskAversion, tau, maxPositionWeight } = req.body;

    if (!holdings || !Array.isArray(holdings)) {
      return res.status(400).json({ error: "Parameter 'holdings' is required and must be an array." });
    }

    if (holdings.length === 0) {
      return res.json({
        allocations: [],
        expectedPortfolioReturn: 0,
        expectedPortfolioRisk: 0,
        sharpeEstimate: 0,
        rebalanceRequired: false,
        diversificationNote: "Empty portfolio holdings. Add assets to perform risk-adjusted portfolio optimization.",
        generatedAt: new Date().toISOString()
      });
    }

    // 1. Map holdings to get shares, avgBuyPrice, currentPrice, and market weight
    const rawHoldings = holdings.map(h => {
      const symbol = h.symbol.toUpperCase().trim();
      const shares = typeof h.shares === "number" ? h.shares : (typeof h.quantity === "number" ? h.quantity : 0);
      const avgBuyPrice = typeof h.avgBuyPrice === "number" ? h.avgBuyPrice : (typeof h.buyPrice === "number" ? h.buyPrice : 0);
      
      const stock = getStockBySymbol(symbol);
      const currentPrice = stock?.price ?? avgBuyPrice ?? 10.0;
      const value = currentPrice * shares;

      return {
        symbol,
        shares,
        avgBuyPrice,
        currentPrice,
        value
      };
    });

    const totalPortfolioValue = rawHoldings.reduce((sum, h) => sum + h.value, 0);

    const inputsHoldings: Array<{
      symbol: string;
      marketWeight: number;
      finalScore: number;
      confidence: number;
    }> = [];

    const returnsHistory: Record<string, number[]> = {};

    for (const h of rawHoldings) {
      const marketWeight = totalPortfolioValue > 0 ? h.value / totalPortfolioValue : 1 / rawHoldings.length;

      // Call trading opportunity signal for finalScore and confidence
      let finalScore = 50;
      let confidence = 50;
      try {
        const signal = await calculateTradingOpportunitySignal(h.symbol);
        finalScore = Math.max(0, Math.min(100, Math.round(50 + signal.score * 5)));
        confidence = signal.confidence ?? 50;
      } catch (e) {
        console.warn(`[black-litterman-route] Could not compute AI signal for ${h.symbol}:`, e);
      }

      inputsHoldings.push({
        symbol: h.symbol,
        marketWeight,
        finalScore,
        confidence
      });

      // Load chronological close history from repository
      const histRes = getStockHistory(h.symbol);
      const rows = histRes.data || [];
      const dailyReturns: number[] = [];
      for (let i = 1; i < rows.length; i++) {
        const prev = rows[i - 1].close;
        const curr = rows[i].close;
        if (prev != null && prev > 0 && curr != null && curr > 0) {
          dailyReturns.push((curr - prev) / prev);
        }
      }
      returnsHistory[h.symbol] = dailyReturns;
    }

    const blResult = calculateBlackLitterman({
      holdings: inputsHoldings,
      returnsHistory,
      riskAversion: typeof riskAversion === "number" ? riskAversion : 2.5,
      tau: typeof tau === "number" ? tau : 0.05,
      maxPositionWeight: typeof maxPositionWeight === "number" ? maxPositionWeight : 0.25
    });

    return res.json(blResult);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/portfolio/optimize
 * Direct portfolio optimization service endpoint
 */
router.post("/optimize", (req, res, next) => {
  try {
    const { user_id, holdings, risk_profile, riskAppetite } = req.body;
    
    // Support both risk_profile and riskAppetite
    const finalProfile = (risk_profile || riskAppetite || "moderate").toLowerCase();
    
    // Run optimization solver
    const result = optimizePortfolio({
      user_id,
      holdings: holdings || [],
      risk_profile: finalProfile as any
    });
    
    return res.json(result);
  } catch (err) {
    next(err);
  }
});

export const PortfolioRouter = router;
