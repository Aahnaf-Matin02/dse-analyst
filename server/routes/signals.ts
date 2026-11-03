import { Router } from "express";
import { calculateTradingOpportunitySignal } from "../services/tradingSignal";
import { planEntryExit } from "../services/entryExitPlanner";
import { calculateRiskReward } from "../services/riskRewardCalculator";
import { calculateRelativeVolume } from "../services/relativeVolume";
import { calculateBreakoutScore } from "../services/breakoutScorer";

const router = Router();

/**
 * GET /api/signals/trading/:symbol
 */
router.get("/trading/:symbol", async (req, res, next) => {
  try {
    const symbol = req.params.symbol.toUpperCase().trim();
    const result = await calculateTradingOpportunitySignal(symbol);
    return res.json(result);
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});

/**
 * GET /api/signals/entry-exit/:symbol
 */
router.get("/entry-exit/:symbol", async (req, res, next) => {
  try {
    const symbol = req.params.symbol.toUpperCase().trim();
    const result = await planEntryExit(symbol);
    return res.json(result);
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});

/**
 * GET /api/signals/risk-reward/:symbol
 */
router.get("/risk-reward/:symbol", async (req, res, next) => {
  try {
    const symbol = req.params.symbol.toUpperCase().trim();
    const result = await calculateRiskReward(symbol);
    return res.json(result);
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});

/**
 * GET /api/signals/relative-volume/:symbol
 */
router.get("/relative-volume/:symbol", async (req, res, next) => {
  try {
    const symbol = req.params.symbol.toUpperCase().trim();
    const result = await calculateRelativeVolume(symbol);
    return res.json(result);
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});

/**
 * GET /api/signals/breakout/:symbol
 */
router.get("/breakout/:symbol", async (req, res, next) => {
  try {
    const symbol = req.params.symbol.toUpperCase().trim();
    const result = await calculateBreakoutScore(symbol);
    return res.json(result);
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});

export const SignalsRouter = router;
