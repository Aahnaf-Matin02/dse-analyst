import express from "express";
import compression from "compression";
import path from "path";
import { rateLimiter } from "./middleware/rateLimiter";
import { errorHandler } from "./middleware/errorHandler";
import { securityHeaders, corsAllowList } from "./middleware/securityHeaders";
import { authRateLimiter } from "./middleware/authRateLimiter";

// Sub-routers imports
import { AuthRouter } from "./routes/auth";
import { StocksRouter } from "./routes/stocks";
import { RevenueRouter } from "./routes/revenue";
import { AnalyticsRouter } from "./routes/analytics";
import { DividendsRouter } from "./routes/dividends";
import { GeminiRouter } from "./routes/gemini";
import { DSERouter } from "./routes/dse";
import { MarketRouter } from "./routes/market";
import { EducationRouter } from "./routes/education";
import { HistoryRouter } from "./routes/history";
import { PortfolioRouter } from "./routes/portfolio";
import { SignalsRouter } from "./routes/signals";
import { ScannerRouter } from "./routes/scanner";
import { ValuationRouter } from "./routes/valuation";
import { optimizePortfolio } from "./services/portfolioOptimizer";

export function createApp() {
  const app = express();

  // Trust first proxy hop behind Cloud Run reverse proxies
  app.set("trust proxy", 1);

  // 1. Core global Middlewares
  app.disable("x-powered-by");
  // gzip/deflate responses (JS bundle, JSON). Netlify's CDN already compresses function output.
  if (!process.env.NETLIFY) app.use(compression());
  app.use(securityHeaders);
  app.use(corsAllowList); // same-origin by default; was "Access-Control-Allow-Origin: *"
  app.use(express.json({ limit: "1mb" }));
  app.use(rateLimiter);

  // 2. Register modular REST sub-routers
  app.use("/api/auth", authRateLimiter, AuthRouter);
  app.use("/api/revenue", RevenueRouter);
  app.use("/api/stocks", StocksRouter);
  app.use("/api/analytics", AnalyticsRouter);
  app.use("/api/dividends", DividendsRouter);
  app.use("/api/gemini", GeminiRouter);
  app.use("/api/dse", DSERouter);
  app.use("/api/market", MarketRouter);

  // Direct /portfolio/optimize routing endpoint
  app.post("/portfolio/optimize", (req, res, next) => {
    try {
      const { user_id, holdings, risk_profile, riskAppetite } = req.body;
      const finalProfile = (risk_profile || riskAppetite || "moderate").toLowerCase();
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

  // Flat endpoint for direct /api/market-indices as required
  app.get("/api/market-indices", async (req, res, next) => {
    try {
      const { fetchAndValidateIndices } = await import("./routes/market");
      const data = await fetchAndValidateIndices();
      res.json({
        timestamp: data.indices.timestamp,
        dsex: {
          value: data.indices.DSEX.value,
          change: data.indices.DSEX.change,
          change_percent: data.indices.DSEX.changePercent
        },
        dses: {
          value: data.indices.DSES.value,
          change: data.indices.DSES.change,
          change_percent: data.indices.DSES.changePercent
        },
        ds30: {
          value: data.indices.DS30.value,
          change: data.indices.DS30.change,
          change_percent: data.indices.DS30.changePercent
        },
        status: data.status,
        source: data.indices?.source || "CachedFile",
        live: data.status === "LIVE",
        lastSuccessfulUpdate: data.lastSuccessfulUpdate
      });
    } catch (err) {
      next(err);
    }
  });
  app.use("/api/education", EducationRouter);
  app.use("/api/history", HistoryRouter);
  app.use("/api/portfolio", PortfolioRouter);
  app.use("/api/signals", SignalsRouter);
  app.use("/api/scanner", ScannerRouter);
  app.use("/api/valuation", ValuationRouter);

  // Serve the generated checklist HTML page publicly
  app.get("/checklist.html", (req, res) => {
    res.sendFile(path.join(process.cwd(), "data", "history", "imports", "download-checklist.html"));
  });

  // Unknown API paths get a JSON 404 instead of falling through to the SPA's index.html
  app.use("/api", (req, res) => {
    res.status(404).json({ error: "API route not found" });
  });

  // 3. Centralized fallback error management
  app.use(errorHandler as any);

  return app;
}
