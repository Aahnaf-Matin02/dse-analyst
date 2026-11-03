import { spawn } from "node:child_process";

async function runServer() {
  const express = (await import("express")).default;
  const path = (await import("path")).default;
  const dotenv = (await import("dotenv")).default;
  dotenv.config();

  const { createApp } = await import("./server/app");
  const { DSEScraper } = await import("./server/services/dseScraper");
  const { DataCoverageAuditService } = await import("./server/services/dataCoverageAudit");

  const app = createApp();
  const PORT = Number(process.env.PORT) || 3000;

  // Set up Vite middleware or serve static spa contents
  if (process.env.NODE_ENV !== "production") {
    console.log("[Express] Launching dev proxy with server-side Hot-Reloading...");
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("[Express] Serving optimized SPA statics out of dist...");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      if (req.path.startsWith("/api/")) {
        return res.status(404).json({ error: "API route not found" });
      }
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // Set up background scraping worker
  DSEScraper.syncLiveDSEData(1)
    .then((result: any) => {
      console.log(`[DSE Scraper] Startup synchronization completed. Source: ${result?.source ?? "Live"}`);
    })
    .catch((err) => {
      console.error("[DSE Scraper] Startup synchronization failure:", err);
    });

  // Controlled periodic synchronization with minimum intervals and throttling (only in non-Netlify environment)
  if (!process.env.NETLIFY && process.env.NODE_ENV !== "test") {
    const SYNC_INTERVAL_MS = 5 * 60 * 1000; // Controlled 5-minute synchronization interval
    setInterval(() => {
      // Live price + index feed (drives the LIVE / disconnected status)
      DSEScraper.syncLiveDSEData(1).catch((err: any) => {
        console.warn("[DSE Scraper] Interval refresh warning:", err?.message || err);
      });
      import("./server/services/dse/dseSyncService").then(({ defaultDseSyncService }) => {
        defaultDseSyncService.syncMarket().catch((err) => {
          console.warn("[DSE Sync] Controlled interval sync warning:", err?.message || err);
        });
      });
    }, SYNC_INTERVAL_MS);
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Express] Brokerage AI Analyst container initialized. Accessible externally on port ${PORT}`);
  });
}

if (!process.execArgv.some(a => a.includes("tsx")) && !process.env._BOOTSTRAPPED_WITH_TSX) {
  process.env._BOOTSTRAPPED_WITH_TSX = "1";
  const child = spawn(process.execPath, ["--import", "tsx", ...process.argv.slice(1)], {
    stdio: "inherit",
    env: process.env
  });
  child.on("exit", (code) => process.exit(code ?? 0));
} else {
  runServer().catch((err) => {
    console.error("[Express] Critical failure during server launch process:", err);
  });
}
