import fs from "fs";
import path from "path";
import { DseSecurity } from "../dse/dseUniverse";
import { DseMarketSnapshot } from "../dse/dseMarketData";

export type StorageTier = "DURABLE_STORE" | "DURABLE_STORE_GCS" | "BUNDLED_FILE" | "EPHEMERAL_CONTAINER" | "FALLBACK_SEED";

export interface StorageReadResult<T> {
  data: T | null;
  tier: StorageTier;
  source: string;
}

export interface IDseStorage {
  loadSecurityMaster(): Promise<StorageReadResult<DseSecurity[]>>;
  saveSecurityMaster(securities: DseSecurity[]): Promise<void>;
  
  loadMarketSnapshots(): Promise<StorageReadResult<DseMarketSnapshot[]>>;
  saveMarketSnapshots(snapshots: DseMarketSnapshot[]): Promise<void>;
  
  loadSyncStatus(): Promise<StorageReadResult<any>>;
  saveSyncStatus(status: any): Promise<void>;
  
  getUniverseTier(): StorageTier;
  getMarketTier(): StorageTier;
}

const STORAGE_DIR = path.join(process.cwd(), "data", "dse");
const UNIVERSE_FILE = path.join(STORAGE_DIR, "security-master.json");
const SNAPSHOTS_FILE = path.join(STORAGE_DIR, "market-snapshots.json");
const SYNC_STATUS_FILE = path.join(process.cwd(), "data", "dse-sync-status.json");

function ensureDir(dirPath: string) {
  if (!fs.existsSync(dirPath)) {
    try {
      fs.mkdirSync(dirPath, { recursive: true });
    } catch {}
  }
}

/**
 * Local filesystem storage provider.
 * Reads bundled JSON files or /tmp in serverless container environments.
 */
export class LocalFileStorage {
  private storageDir: string;
  private universeFile: string;
  private snapshotsFile: string;
  private syncStatusFile: string;

  constructor(customStorageDir?: string) {
    this.storageDir = customStorageDir || STORAGE_DIR;
    this.universeFile = path.join(this.storageDir, "security-master.json");
    this.snapshotsFile = path.join(this.storageDir, "market-snapshots.json");
    this.syncStatusFile = customStorageDir
      ? path.join(this.storageDir, "dse-sync-status.json")
      : SYNC_STATUS_FILE;
  }

  loadSecurityMasterSync(): StorageReadResult<DseSecurity[]> {
    ensureDir(this.storageDir);
    if (fs.existsSync(this.universeFile)) {
      try {
        const raw = fs.readFileSync(this.universeFile, "utf-8");
        const list: DseSecurity[] = JSON.parse(raw);
        if (Array.isArray(list) && list.length > 0) {
          return { data: list, tier: "BUNDLED_FILE", source: this.universeFile };
        }
      } catch (err) {
        console.warn("[LocalFileStorage] Failed to read UNIVERSE_FILE:", err);
      }
    }
    return { data: null, tier: "FALLBACK_SEED", source: "none" };
  }

  saveSecurityMasterSync(securities: DseSecurity[]): void {
    ensureDir(this.storageDir);
    try {
      const tempPath = `${this.universeFile}.tmp`;
      fs.writeFileSync(tempPath, JSON.stringify(securities, null, 2), "utf-8");
      fs.renameSync(tempPath, this.universeFile);
    } catch (err) {
      console.warn("[LocalFileStorage] Failed to save UNIVERSE_FILE:", err);
    }
  }

  loadMarketSnapshotsSync(): StorageReadResult<DseMarketSnapshot[]> {
    ensureDir(this.storageDir);
    if (fs.existsSync(this.snapshotsFile)) {
      try {
        const raw = fs.readFileSync(this.snapshotsFile, "utf-8");
        const list: DseMarketSnapshot[] = JSON.parse(raw);
        if (Array.isArray(list) && list.length > 0) {
          return { data: list, tier: "BUNDLED_FILE", source: this.snapshotsFile };
        }
      } catch (err) {
        console.warn("[LocalFileStorage] Failed to read SNAPSHOTS_FILE:", err);
      }
    }
    return { data: null, tier: "FALLBACK_SEED", source: "none" };
  }

  saveMarketSnapshotsSync(snapshots: DseMarketSnapshot[]): void {
    ensureDir(this.storageDir);
    try {
      const tempPath = `${this.snapshotsFile}.tmp`;
      fs.writeFileSync(tempPath, JSON.stringify(snapshots, null, 2), "utf-8");
      fs.renameSync(tempPath, this.snapshotsFile);
    } catch (err) {
      console.warn("[LocalFileStorage] Failed to save SNAPSHOTS_FILE:", err);
    }
  }

  loadSyncStatusSync(): StorageReadResult<any> {
    if (fs.existsSync(this.syncStatusFile)) {
      try {
        const raw = fs.readFileSync(this.syncStatusFile, "utf-8");
        const data = JSON.parse(raw);
        return { data, tier: "BUNDLED_FILE", source: this.syncStatusFile };
      } catch (err) {
        console.warn("[LocalFileStorage] Failed to read SYNC_STATUS_FILE:", err);
      }
    }
    return { data: null, tier: "FALLBACK_SEED", source: "none" };
  }

  saveSyncStatusSync(status: any): void {
    try {
      const dir = path.dirname(this.syncStatusFile);
      ensureDir(dir);
      fs.writeFileSync(this.syncStatusFile, JSON.stringify(status, null, 2), "utf-8");
    } catch (err) {
      console.warn("[LocalFileStorage] Failed to save SYNC_STATUS_FILE:", err);
    }
  }
}

/**
 * Unified DSE Persistent Storage Manager.
 *
 * Implements a 3-tier cold-start resolution hierarchy:
 * 1. Durable Store (Netlify Blobs in Netlify environment / Cloud persistent store)
 * 2. Bundled JSON seed files in data/dse/*.json (included in build)
 * 3. In-code static fallback reference seed
 */
export class DseStorageManager implements IDseStorage {
  private localFile: LocalFileStorage;
  private universeTier: StorageTier = "BUNDLED_FILE";
  private marketTier: StorageTier = "BUNDLED_FILE";
  private syncStatusTier: StorageTier = "BUNDLED_FILE";
  private blobsStore: any = null;
  private isNetlifyEnv: boolean;
  private isCloudRunEnv: boolean;
  private gcsBucketName: string | null = null;

  constructor(options?: { customStorageDir?: string; isNetlifyEnv?: boolean; isCloudRun?: boolean }) {
    this.localFile = new LocalFileStorage(options?.customStorageDir);
    this.isCloudRunEnv = options?.isCloudRun ?? Boolean(process.env.K_SERVICE);
    this.gcsBucketName = process.env.GCS_BUCKET || process.env.STORAGE_BUCKET || null;

    // Never use Netlify Blobs when running on Google Cloud Run
    this.isNetlifyEnv = this.isCloudRunEnv 
      ? false 
      : (options?.isNetlifyEnv ?? Boolean(process.env.NETLIFY || process.env.NETLIFY_BLOBS_CONTEXT));

    if (this.isCloudRunEnv) {
      if (this.gcsBucketName) {
        this.universeTier = "DURABLE_STORE_GCS";
        this.marketTier = "DURABLE_STORE_GCS";
        this.syncStatusTier = "DURABLE_STORE_GCS";
      } else {
        // Ephemeral container tier: in-container filesystem persists only during container instance lifetime
        this.universeTier = "EPHEMERAL_CONTAINER";
        this.marketTier = "EPHEMERAL_CONTAINER";
        this.syncStatusTier = "EPHEMERAL_CONTAINER";
      }
    }

    this.initBlobsStore();
  }

  isCloudRun(): boolean {
    return this.isCloudRunEnv;
  }

  getGcsBucket(): string | null {
    return this.gcsBucketName;
  }

  getStorageNote(): string {
    if (this.isCloudRunEnv) {
      if (this.gcsBucketName) {
        return `Google Cloud Run environment detected with GCS bucket: ${this.gcsBucketName}`;
      }
      return "Google Cloud Run container environment detected (K_SERVICE). Storage tier is EPHEMERAL_CONTAINER; in-memory/filesystem state is ephemeral across scale-to-zero container lifecycles. Set GCS_BUCKET to enable durable object storage.";
    }
    if (this.isNetlifyEnv) {
      return "Netlify serverless runtime with Netlify Blobs storage enabled.";
    }
    return "Local file storage active using bundled JSON files.";
  }

  private async initBlobsStore() {
    if (this.isNetlifyEnv) {
      try {
        const { getStore } = await import("@netlify/blobs");
        this.blobsStore = getStore("dse-market-data");
      } catch (e) {
        // Blobs not available in current execution context
        this.blobsStore = null;
      }
    }
  }

  getUniverseTier(): StorageTier {
    return this.universeTier;
  }

  getMarketTier(): StorageTier {
    return this.marketTier;
  }

  getSyncStatusTier(): StorageTier {
    return this.syncStatusTier;
  }

  setUniverseTier(tier: StorageTier): void {
    this.universeTier = tier;
  }

  setMarketTier(tier: StorageTier): void {
    this.marketTier = tier;
  }

  /**
   * Cold-start loader for Security Master:
   * Tier 1: Durable store (Netlify Blobs if present)
   * Tier 2: Bundled data/dse/security-master.json
   * Tier 3: Returns null (signals caller to populate fallback seed)
   */
  async loadSecurityMaster(): Promise<StorageReadResult<DseSecurity[]>> {
    // 1. Try Durable Store
    if (this.blobsStore) {
      try {
        const blobData = await this.blobsStore.get("security-master", { type: "json" });
        if (Array.isArray(blobData) && blobData.length > 0) {
          this.universeTier = "DURABLE_STORE";
          return { data: blobData, tier: "DURABLE_STORE", source: "NetlifyBlobs:security-master" };
        }
      } catch (err) {
        console.warn("[DseStorage] Durable store read error for security-master:", err);
      }
    }

    // 2. Try Bundled JSON files
    const local = this.localFile.loadSecurityMasterSync();
    if (local.data && local.data.length > 0) {
      this.universeTier = "BUNDLED_FILE";
      return local;
    }

    // 3. Fallback Seed
    this.universeTier = "FALLBACK_SEED";
    return { data: null, tier: "FALLBACK_SEED", source: "none" };
  }

  /**
   * Persists Security Master to durable store and local disk.
   */
  async saveSecurityMaster(securities: DseSecurity[]): Promise<void> {
    // Write local file
    this.localFile.saveSecurityMasterSync(securities);

    // Write durable store
    if (this.blobsStore) {
      try {
        await this.blobsStore.setJSON("security-master", securities);
        this.universeTier = "DURABLE_STORE";
      } catch (err) {
        console.warn("[DseStorage] Failed to write security-master to durable store:", err);
      }
    }
  }

  /**
   * Cold-start loader for Market Snapshots:
   * Tier 1: Durable store
   * Tier 2: Bundled data/dse/market-snapshots.json
   * Tier 3: Returns null
   */
  async loadMarketSnapshots(): Promise<StorageReadResult<DseMarketSnapshot[]>> {
    // 1. Try Durable Store
    if (this.blobsStore) {
      try {
        const blobData = await this.blobsStore.get("market-snapshots", { type: "json" });
        if (Array.isArray(blobData) && blobData.length > 0) {
          this.marketTier = "DURABLE_STORE";
          return { data: blobData, tier: "DURABLE_STORE", source: "NetlifyBlobs:market-snapshots" };
        }
      } catch (err) {
        console.warn("[DseStorage] Durable store read error for market-snapshots:", err);
      }
    }

    // 2. Try Bundled JSON files
    const local = this.localFile.loadMarketSnapshotsSync();
    if (local.data && local.data.length > 0) {
      this.marketTier = "BUNDLED_FILE";
      return local;
    }

    // 3. Fallback Seed
    this.marketTier = "FALLBACK_SEED";
    return { data: null, tier: "FALLBACK_SEED", source: "none" };
  }

  /**
   * Persists Market Snapshots to durable store and local disk.
   */
  async saveMarketSnapshots(snapshots: DseMarketSnapshot[]): Promise<void> {
    this.localFile.saveMarketSnapshotsSync(snapshots);

    if (this.blobsStore) {
      try {
        await this.blobsStore.setJSON("market-snapshots", snapshots);
        this.marketTier = "DURABLE_STORE";
      } catch (err) {
        console.warn("[DseStorage] Failed to write market-snapshots to durable store:", err);
      }
    }
  }

  /**
   * Cold-start loader for Sync Status.
   */
  async loadSyncStatus(): Promise<StorageReadResult<any>> {
    if (this.blobsStore) {
      try {
        const blobData = await this.blobsStore.get("sync-status", { type: "json" });
        if (blobData) {
          this.syncStatusTier = "DURABLE_STORE";
          return { data: blobData, tier: "DURABLE_STORE", source: "NetlifyBlobs:sync-status" };
        }
      } catch (err) {
        console.warn("[DseStorage] Durable store read error for sync-status:", err);
      }
    }

    const local = this.localFile.loadSyncStatusSync();
    if (local.data) {
      this.syncStatusTier = "BUNDLED_FILE";
      return local;
    }

    this.syncStatusTier = "FALLBACK_SEED";
    return { data: null, tier: "FALLBACK_SEED", source: "none" };
  }

  /**
   * Persists Sync Status to durable store and local disk.
   */
  async saveSyncStatus(status: any): Promise<void> {
    this.localFile.saveSyncStatusSync(status);

    if (this.blobsStore) {
      try {
        await this.blobsStore.setJSON("sync-status", status);
        this.syncStatusTier = "DURABLE_STORE";
      } catch (err) {
        console.warn("[DseStorage] Failed to write sync-status to durable store:", err);
      }
    }
  }
}

export const defaultDseStorage = new DseStorageManager();
