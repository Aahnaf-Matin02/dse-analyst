import { Router } from "express";
import { scanOpportunities } from "../services/opportunityScanner";
import { scanDangers } from "../services/dangerScanner";

const router = Router();

/**
 * GET /api/scanner/opportunities
 * Query params: sector? · minScore? (default 10) · limit? (default 20)
 */
router.get("/opportunities", async (req, res, next) => {
  try {
    const sector = req.query.sector ? String(req.query.sector).trim() : undefined;
    const minScore = req.query.minScore ? Number(req.query.minScore) : 10;
    const limit = req.query.limit ? Number(req.query.limit) : 20;

    let list = await scanOpportunities();

    if (sector) {
      list = list.filter(item => item.sector.toLowerCase() === sector.toLowerCase());
    }

    list = list.filter(item => item.opportunityScore >= minScore);

    return res.json(list.slice(0, limit));
  } catch (err: any) {
    next(err);
  }
});

/**
 * GET /api/scanner/dangers
 * Query params: sector? · minScore? (default 10) · limit? (default 20)
 */
router.get("/dangers", async (req, res, next) => {
  try {
    const sector = req.query.sector ? String(req.query.sector).trim() : undefined;
    const minScore = req.query.minScore ? Number(req.query.minScore) : 10;
    const limit = req.query.limit ? Number(req.query.limit) : 20;

    let list = await scanDangers();

    if (sector) {
      list = list.filter(item => item.sector.toLowerCase() === sector.toLowerCase());
    }

    list = list.filter(item => item.dangerScore >= minScore);

    return res.json(list.slice(0, limit));
  } catch (err: any) {
    next(err);
  }
});

export const ScannerRouter = router;
