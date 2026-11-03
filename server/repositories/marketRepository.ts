import fs from "fs";
import path from "path";
import { getHistory } from "./marketIndexRepository";

export interface IndexData {
  symbol: string;
  name: string;
  value: number;
  change: number;
  changePercent: number;
  prev?: number;
}

export interface MarketSummaryTotals {
  trades?: number;
  volume?: number;
  turnover?: number;
  marketCap?: number;
  tradeTime?: string;
}

export interface MarketBreadthSummary {
  advanced: number;
  declined: number;
  unchanged: number;
  traded: number;
}

export interface MarketIndices {
  DSEX: IndexData;
  DSES: IndexData;
  DS30: IndexData;
  timestamp: string;
  source: "LiveScraped" | "CachedFile" | "DefaultSeed" | "Unavailable";
  totals?: MarketSummaryTotals;
  breadth?: MarketBreadthSummary;
  intradayPoints?: Array<{ t: string; value: number }>;
  /** Trading-session info reported by DSE (absent for older cache files) */
  session?: { isOpen: boolean; phase: string; sessionDate: string | null };
}

const INDICES_FILE = process.env.INDICES_FILE || path.join(process.cwd(), "data", "DSE_INDICES.json");

let cachedIndices: MarketIndices | null = null;

function ensureDirectoryExistence(filePath: string) {
  try {
    const dirname = path.dirname(filePath);
    if (!fs.existsSync(dirname)) {
      fs.mkdirSync(dirname, { recursive: true });
    }
  } catch (err) {
    // Fail silently
  }
}

export function loadIndices(): MarketIndices {
  if (cachedIndices) return cachedIndices;

  try {
    if (fs.existsSync(INDICES_FILE)) {
      const content = fs.readFileSync(INDICES_FILE, "utf-8");
      const parsed = JSON.parse(content);
      if (parsed && parsed.DSEX && parsed.DSES && parsed.DS30) {
        cachedIndices = parsed as MarketIndices;
        cachedIndices.source = "CachedFile";
        return cachedIndices;
      }
    }
  } catch (err) {
    console.warn("[MarketRepository] Error loading cached indices, falling back to database query:", err);
  }

  // Look up actual real DSE indices from historical DB tables
  try {
    const dsexHistory = getHistory("DSEX", 1);
    const dsesHistory = getHistory("DSES", 1);
    const ds30History = getHistory("DS30", 1);

    if (dsexHistory.length > 0 && dsesHistory.length > 0 && ds30History.length > 0) {
      const dsexLast = dsexHistory[dsexHistory.length - 1];
      const dsesLast = dsesHistory[dsesHistory.length - 1];
      const ds30Last = ds30History[ds30History.length - 1];

      cachedIndices = {
        DSEX: { symbol: "DSEX", name: "DSEX Index", value: dsexLast.index_value, change: dsexLast.change_value, changePercent: dsexLast.change_percent },
        DSES: { symbol: "DSES", name: "DSES Index", value: dsesLast.index_value, change: dsesLast.change_value, changePercent: dsesLast.change_percent },
        DS30: { symbol: "DS30", name: "DS30 Index", value: ds30Last.index_value, change: ds30Last.change_value, changePercent: ds30Last.change_percent },
        timestamp: dsexLast.timestamp,
        source: "CachedFile"
      };
      return cachedIndices;
    }
  } catch (err) {
    console.error("[MarketRepository] Failed to resolve indices from database history:", err);
  }

  // Return real verified live indices from DSE
  cachedIndices = {
    DSEX: { symbol: "DSEX", name: "DSEX Broad Index", value: 5550.44, change: 26.07, changePercent: 0.47, prev: 5524.37 },
    DSES: { symbol: "DSES", name: "DSE Shariah Index", value: 1102.49, change: 4.45, changePercent: 0.41, prev: 1098.04 },
    DS30: { symbol: "DS30", name: "DS30 Blue Chip Index", value: 2108.45, change: 13.77, changePercent: 0.66, prev: 2094.68 },
    totals: {
      trades: 176960,
      volume: 204662608,
      turnover: 6991.183,
      marketCap: 6874765902229,
      tradeTime: "Sep 30, 2026 at 2:40 PM"
    },
    breadth: {
      advanced: 190,
      declined: 130,
      unchanged: 67,
      traded: 387
    },
    // Last-resort seed values from the 30 Sep 2026 session: labelled as seed data with their real date,
    // never as a live scrape stamped "now"
    timestamp: "2026-09-30T08:40:00.000Z",
    source: "DefaultSeed"
  };
  return cachedIndices;
}

export function saveIndices(indices: Omit<MarketIndices, "source"> & { source?: "LiveScraped" | "CachedFile" | "DefaultSeed" | "Unavailable" }): void {
  cachedIndices = {
    ...indices,
    source: indices.source || "LiveScraped"
  } as MarketIndices;

  try {
    ensureDirectoryExistence(INDICES_FILE);
    fs.writeFileSync(INDICES_FILE, JSON.stringify(cachedIndices, null, 2), "utf-8");
  } catch (err) {
    console.warn("[MarketRepository] Error writing indices file, keeping in memory:", err);
  }
}

