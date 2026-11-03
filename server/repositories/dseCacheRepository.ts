import fs from "fs";
import path from "path";

// Paths for persistent local files
const LOCAL_CACHE_DIR = path.join(process.cwd(), "data", "cache");
const LOCAL_LATEST_FILE = path.join(LOCAL_CACHE_DIR, "dse-latest.json");
const LOCAL_STATUS_FILE = path.join(LOCAL_CACHE_DIR, "dse-status.json");

// Paths for writable lambda fallback (/tmp is always writable in serverless contexts)
const LAMBDA_LATEST_FILE = "/tmp/dse-latest.json";
const LAMBDA_STATUS_FILE = "/tmp/dse-status.json";

// Shared memory layer for Netlify Serverless Function durability in a single process spin
let memoryCacheData: any = null;
let memoryCacheStatus: any = null;

function ensureDirExists(dirPath: string) {
  try {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  } catch (err) {
    // Fail silently in read-only setups
  }
}

// Select the correct cache file path depending on Netlify serverless / local environments
function getLatestFilePath(): string {
  if (process.env.NETLIFY || process.env.LAMBDA_TASK_ROOT) {
    return LAMBDA_LATEST_FILE;
  }
  return LOCAL_LATEST_FILE;
}

function getStatusFilePath(): string {
  if (process.env.NETLIFY || process.env.LAMBDA_TASK_ROOT) {
    return LAMBDA_STATUS_FILE;
  }
  return LOCAL_STATUS_FILE;
}

export function saveLatestDseData(payload: any): void {
  memoryCacheData = payload;
  const filePath = getLatestFilePath();
  try {
    ensureDirExists(path.dirname(filePath));
    fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), "utf-8");
  } catch (err) {
    console.warn(`[dseCacheRepository] Failed to write cache to ${filePath}, using internal memory:`, err);
  }
}

export function loadLatestDseData(): any {
  if (memoryCacheData) return memoryCacheData;

  const filePath = getLatestFilePath();
  try {
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, "utf-8");
      memoryCacheData = JSON.parse(data);
      return memoryCacheData;
    }
  } catch (err) {
    console.warn(`[dseCacheRepository] Failed to read latest DSE data cache from ${filePath}:`, err);
  }

  // Cross-environment double fallback to standard local cache directory
  if (filePath !== LOCAL_LATEST_FILE) {
    try {
      if (fs.existsSync(LOCAL_LATEST_FILE)) {
        const data = fs.readFileSync(LOCAL_LATEST_FILE, "utf-8");
        memoryCacheData = JSON.parse(data);
        return memoryCacheData;
      }
    } catch {}
  }

  return null;
}

export function saveDseSyncStatus(status: any): void {
  const isServerless = !!(process.env.NETLIFY || process.env.LAMBDA_TASK_ROOT);
  const enrichedStatus = {
    ...status,
    isTemporaryCache: isServerless,
    storageType: isServerless ? "In-Memory / /tmp Serverless Fallback" : "Persistent disk"
  };

  memoryCacheStatus = enrichedStatus;
  const filePath = getStatusFilePath();
  try {
    ensureDirExists(path.dirname(filePath));
    fs.writeFileSync(filePath, JSON.stringify(enrichedStatus, null, 2), "utf-8");
  } catch (err) {
    console.warn(`[dseCacheRepository] Failed to write sync status to ${filePath}, using memory:`, err);
  }
}

export function loadDseSyncStatus(): any {
  if (memoryCacheStatus) return memoryCacheStatus;

  const filePath = getStatusFilePath();
  try {
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, "utf-8");
      memoryCacheStatus = JSON.parse(data);
      return memoryCacheStatus;
    }
  } catch (err) {
    console.warn(`[dseCacheRepository] Failed to read sync status from ${filePath}:`, err);
  }

  // Fallback to local status file
  if (filePath !== LOCAL_STATUS_FILE) {
    try {
      if (fs.existsSync(LOCAL_STATUS_FILE)) {
        const data = fs.readFileSync(LOCAL_STATUS_FILE, "utf-8");
        memoryCacheStatus = JSON.parse(data);
        return memoryCacheStatus;
      }
    } catch {}
  }

  return null;
}
