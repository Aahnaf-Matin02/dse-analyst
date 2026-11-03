import fs from "fs";
import path from "path";
import { updateIncremental, latestStoredSession, dhakaClock, IncrementalResult, StopError } from "./dseArchive";

/**
 * Daily incremental history update: runs updateIncremental() under a lock, records the outcome in
 * data/history/processed/incremental-status.json and schedules itself after market close.
 *
 * Triggers: the scheduler below (long-running server only), POST /api/dse/sync?type=history
 * (SYNC_SECRET) and `npm run update:history`. Never runs at server startup.
 */

export const SCHEDULE = {
  days: ["Sun", "Mon", "Tue", "Wed", "Thu"],
  startAfterDhaka: "16:00",
  stopAfterDhaka: "22:00",
  checkEveryMinutes: 60,
  description: "Sunday–Thursday, hourly from 16:00 to 22:00 Asia/Dhaka until the day's session is stored",
};

const LOCK_STALE_MS = 30 * 60 * 1000;

export interface IncrementalStatus {
  lastAttemptAt: string | null;
  lastTrigger: string | null;
  lastOutcome: IncrementalResult["status"] | "stopped" | "failed" | "locked" | null;
  lastMessage: string | null;
  lastSuccessAt: string | null;
  lastSessionsAdded: string[];
  lastRowsAdded: number;
  latestSessionStored: string | null;
}

const EMPTY: IncrementalStatus = {
  lastAttemptAt: null, lastTrigger: null, lastOutcome: null, lastMessage: null, lastSuccessAt: null,
  lastSessionsAdded: [], lastRowsAdded: 0, latestSessionStored: null,
};

const processedDir = (root: string) => path.join(root, "data", "history", "processed");
const statusFile = (root: string) => path.join(processedDir(root), "incremental-status.json");
const lockFile = (root: string) => path.join(processedDir(root), ".history-update.lock");

export function readIncrementalStatus(root = process.cwd()): IncrementalStatus {
  try { return { ...EMPTY, ...JSON.parse(fs.readFileSync(statusFile(root), "utf8")) }; } catch { return { ...EMPTY }; }
}

function writeStatus(root: string, status: IncrementalStatus) {
  fs.mkdirSync(processedDir(root), { recursive: true });
  fs.writeFileSync(statusFile(root), JSON.stringify(status, null, 2) + "\n");
}

/** Cross-process lock (server, CLI and backfill share data/history). A lock older than 30 min is treated as stale. */
export function acquireLock(root = process.cwd()): boolean {
  const file = lockFile(root);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  try {
    fs.writeFileSync(file, JSON.stringify({ pid: process.pid, at: new Date().toISOString() }), { flag: "wx" });
    return true;
  } catch {
    try {
      if (Date.now() - fs.statSync(file).mtimeMs > LOCK_STALE_MS) { fs.unlinkSync(file); return acquireLock(root); }
    } catch { /* lock vanished between checks; try once more */ return acquireLock(root); }
    return false;
  }
}
export function releaseLock(root = process.cwd()) { try { fs.unlinkSync(lockFile(root)); } catch { /* already gone */ } }

export interface RunOutcome { ok: boolean; outcome: IncrementalStatus["lastOutcome"]; message: string; result?: IncrementalResult; }

let running: Promise<RunOutcome> | null = null;

export function runIncrementalUpdate(trigger: string, root = process.cwd(), now = new Date()): Promise<RunOutcome> {
  if (running) return Promise.resolve({ ok: false, outcome: "locked", message: "A history update is already running in this server." });
  running = (async (): Promise<RunOutcome> => {
    const prev = readIncrementalStatus(root);
    const attempt = { ...prev, lastAttemptAt: new Date().toISOString(), lastTrigger: trigger };
    if (!acquireLock(root)) {
      return { ok: false, outcome: "locked", message: "Another history update or backfill holds data/history/processed/.history-update.lock." };
    }
    try {
      const result = await updateIncremental(now);
      const message = result.status === "updated"
        ? `Added ${result.rowsAdded} rows for ${result.sessions.join(", ")}.`
        : result.status === "up-to-date"
          ? "History already includes the latest completed session."
          : `DSE archive has no session for ${result.from}..${result.to} yet (holiday, or not published yet).`;
      writeStatus(root, {
        ...attempt, lastOutcome: result.status, lastMessage: message,
        // Success means new real rows were stored, or there was nothing newer to store
        lastSuccessAt: result.status === "no-new-session" ? prev.lastSuccessAt : new Date().toISOString(),
        lastSessionsAdded: result.status === "updated" ? result.sessions : prev.lastSessionsAdded,
        lastRowsAdded: result.status === "updated" ? result.rowsAdded : prev.lastRowsAdded,
        latestSessionStored: latestStoredSession(),
      });
      return { ok: true, outcome: result.status, message, result };
    } catch (err) {
      const outcome = err instanceof StopError ? "stopped" : "failed";
      const message = (err as Error).message;
      writeStatus(root, { ...attempt, lastOutcome: outcome, lastMessage: message });
      return { ok: false, outcome, message };
    } finally {
      releaseLock(root);
    }
  })().finally(() => { running = null; });
  return running;
}

/** True when the scheduler should try now: a trading weekday, inside the evening window, not yet done today. */
export function isDue(now: Date, status: IncrementalStatus): boolean {
  const clock = dhakaClock(now);
  if (!SCHEDULE.days.includes(clock.weekday)) return false;
  if (clock.time < SCHEDULE.startAfterDhaka || clock.time > SCHEDULE.stopAfterDhaka) return false;
  if (status.latestSessionStored && status.latestSessionStored >= clock.date) return false;
  // After a hard stop (403/429/challenge/layout change) do not retry automatically the same day
  if (status.lastOutcome === "stopped" && status.lastAttemptAt && dhakaClock(new Date(status.lastAttemptAt)).date === clock.date) return false;
  return true;
}

let timer: NodeJS.Timeout | null = null;

/** Starts the hourly check. The first check happens one interval after startup, never at startup. */
export function startHistoryScheduler(root = process.cwd()) {
  if (timer) return;
  timer = setInterval(() => {
    if (!isDue(new Date(), readIncrementalStatus(root))) return;
    runIncrementalUpdate("schedule", root).then(r => {
      console.log(`[History] Scheduled incremental update: ${r.outcome} — ${r.message}`);
    });
  }, SCHEDULE.checkEveryMinutes * 60 * 1000);
  timer.unref?.();
  console.log(`[History] Daily incremental update scheduled: ${SCHEDULE.description}.`);
}
