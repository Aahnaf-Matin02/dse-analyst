/**
 * Backfill daily price history from the official DSE day-end archive.
 *
 *   npm run backfill:history                         # fetch pending months (default 6 per run), then load
 *   npm run backfill:history -- --max-windows 12     # more months per run
 *   npm run backfill:history -- --load-only          # rebuild data/history from saved raw files only
 *   npm run backfill:history -- --from 2021-10-01 --to 2026-10-05
 *
 * The fetching and loading code lives in server/services/history/dseArchive.ts.
 */
import { fetchWindows, loadIntoHistory, dhakaToday } from "../server/services/history/dseArchive";
import { acquireLock, releaseLock } from "../server/services/history/historyIncremental";

export {
  setRoot, setFetcher, setDelay, monthWindows, extractDayEndTable, extractMarketSummaries, fetchWindows, loadIntoHistory,
} from "../server/services/history/dseArchive";

function arg(name: string): string | undefined { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : undefined; }
const flag = (name: string) => process.argv.includes(`--${name}`);

// ── main ─────────────────────────────────────────────────────────────────────────────────────────
async function main() {
  const from = arg("from") || "2021-10-01";
  const to = arg("to") || dhakaToday();
  const maxWindows = Number(arg("max-windows") || 6);
  if (!acquireLock()) {
    console.error("Another history update or backfill is running (data/history/processed/.history-update.lock). Not starting.");
    process.exitCode = 3;
    return;
  }
  try { await run(from, to, maxWindows); } finally { releaseLock(); }
}

async function run(from: string, to: string, maxWindows: number) {
  if (!flag("load-only")) {
    try {
      await fetchWindows(from, to, maxWindows);
    } catch (err) {
      console.error(`STOPPED: ${(err as Error).message}`);
      console.error("Progress up to the last finished window is saved; re-run later to resume.");
      process.exitCode = 2;
    }
  }
  const summary = loadIntoHistory();
  console.log("load:", JSON.stringify(summary));
}

if (process.argv[1] && /backfill-history\.ts$/.test(process.argv[1])) {
  main().catch(err => { console.error(err); process.exit(1); });
}
