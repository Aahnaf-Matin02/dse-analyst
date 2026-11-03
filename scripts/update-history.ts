/**
 * Daily incremental history update (same code the server runs after market close).
 *
 *   npm run update:history
 *
 * Fetches only DSE sessions after the latest stored date, then reloads data/history with full
 * validation. Exit codes: 0 updated / nothing new, 2 stopped by the source (403/429/challenge/layout),
 * 3 another update holds the lock, 1 other failure.
 */
import { runIncrementalUpdate } from "../server/services/history/historyIncremental";

runIncrementalUpdate("cli").then(r => {
  console.log(`${r.outcome}: ${r.message}`);
  if (r.result?.load) console.log("load:", JSON.stringify(r.result.load));
  process.exitCode = r.ok ? 0 : r.outcome === "stopped" ? 2 : r.outcome === "locked" ? 3 : 1;
});
