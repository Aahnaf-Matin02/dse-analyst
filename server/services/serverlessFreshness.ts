import { DSEScraper } from "./dseScraper";
import { loadDseSyncStatus } from "../repositories/dseCacheRepository";

/**
 * Serverless instances (Netlify) start from the bundled snapshot and share no state, so each one
 * refreshes from DSE itself when its live data is older than FRESH_MS. A failed refresh is retried
 * at most once per RETRY_MS, and a request never waits longer than WAIT_MS for it.
 */
export const FRESH_MS = 3 * 60 * 1000;
export const RETRY_MS = 60 * 1000;
export const WAIT_MS = 6000;

let inflight: Promise<unknown> | null = null;
let lastAttempt = 0;

export async function ensureFreshDseData(now = Date.now(), sync: () => Promise<unknown> = () => DSEScraper.syncLiveDSEData(1)) {
  const lastSuccess = Date.parse(loadDseSyncStatus()?.lastSuccessfulSync ?? "") || 0;
  if (now - lastSuccess < FRESH_MS) return;
  if (!inflight) {
    if (now - lastAttempt < RETRY_MS) return;
    lastAttempt = now;
    inflight = sync().catch(() => null).finally(() => { inflight = null; });
  }
  await Promise.race([inflight, new Promise(r => setTimeout(r, WAIT_MS))]);
}
