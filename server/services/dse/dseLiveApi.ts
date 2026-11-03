import { DseClient, defaultDseClient } from "./dseClient";

/**
 * Client for the JSON feed behind the current dse.com.bd website.
 * DSE retired its old PHP pages (latest_share_price_*.php now return HTTP 410 Gone); the new site's
 * "Latest Share Price" and market pages load their data from these endpoints instead.
 */
export const DSE_LIVE_PRICES_PATH = (process.env.DSE_LIVE_PRICES_PATH || "/api/live/prices").trim();
export const DSE_LIVE_MARKET_PATH = (process.env.DSE_LIVE_MARKET_PATH || "/api/live/market").trim();

export interface DseLivePriceRow {
  code: string;
  ltp: number;
  ycp: number | null;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  volume: number;
  valueMn: number;
  trades: number;
  percent: number | null;
  category: string | null;
  board: string | null;
  sector: string | null;
  assetType: string | null;
}

export interface DseSessionInfo {
  isOpen: boolean;
  phase: string;
  sessionDate: string | null; // trading date the prices belong to (YYYY-MM-DD)
}

export interface DseLiveIndex {
  value: number;
  change: number;
  changePercent: number;
  prev: number | null;
}

export interface DseLiveMarket {
  indices: Record<"DSEX" | "DS30" | "DSES", DseLiveIndex | undefined>;
  totals?: { trades?: number; volume?: number; turnover?: number; marketCap?: number; tradeTime?: string };
  breadth?: { advanced: number; declined: number; unchanged: number; traded: number };
  session: DseSessionInfo;
}

const JSON_HEADERS = { Accept: "application/json" };

function num(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? parseFloat(v.replace(/,/g, "")) : NaN;
  return Number.isFinite(n) ? n : null;
}

function parseSession(raw: any): DseSessionInfo {
  return {
    isOpen: !!raw?.isOpen,
    phase: typeof raw?.phase === "string" ? raw.phase : "unknown",
    sessionDate: typeof raw?.sessionDate === "string" ? raw.sessionDate : (typeof raw?.date === "string" ? raw.date : null)
  };
}

async function getJson(client: DseClient, path: string): Promise<{ data: any; url: string }> {
  const res = await client.get(path, JSON_HEADERS);
  if (res.status !== 200) {
    throw new Error(`DSE live API ${path} returned HTTP ${res.status}`);
  }
  try {
    return { data: JSON.parse(res.body), url: res.url };
  } catch {
    throw new Error(`DSE live API ${path} did not return JSON`);
  }
}

/**
 * Parses the column-oriented { cols, rows } payload of /api/live/prices.
 * Columns are looked up by name so a reordering on DSE's side does not silently shift values.
 */
export function parseLivePrices(payload: any): { rows: DseLivePriceRow[]; session: DseSessionInfo } {
  const cols: string[] = Array.isArray(payload?.cols) ? payload.cols : [];
  const rawRows: any[][] = Array.isArray(payload?.rows) ? payload.rows : [];
  const idx = (name: string) => cols.indexOf(name);
  const iCode = idx("code");
  const iLtp = idx("ltp");
  if (iCode < 0 || iLtp < 0) {
    throw new Error("DSE live prices payload is missing the 'code' or 'ltp' column");
  }
  const pick = (r: any[], name: string) => {
    const i = idx(name);
    return i >= 0 ? r[i] : undefined;
  };

  const rows: DseLivePriceRow[] = [];
  for (const r of rawRows) {
    const code = String(r[iCode] ?? "").trim().toUpperCase();
    if (!code) continue;
    rows.push({
      code,
      ltp: num(r[iLtp]) ?? 0,
      ycp: num(pick(r, "ycp")),
      open: num(pick(r, "open")),
      high: num(pick(r, "high")),
      low: num(pick(r, "low")),
      close: num(pick(r, "close")),
      volume: num(pick(r, "volume")) ?? 0,
      valueMn: num(pick(r, "value")) ?? 0,
      trades: num(pick(r, "trades")) ?? 0,
      percent: num(pick(r, "percent")),
      category: (pick(r, "category") as string) ?? null,
      board: (pick(r, "board") as string) ?? null,
      sector: (pick(r, "sector") as string) ?? null,
      assetType: (pick(r, "assetType") as string) ?? null
    });
  }
  return { rows, session: parseSession(payload?.session) };
}

export function parseLiveMarket(payload: any): DseLiveMarket {
  const indices: DseLiveMarket["indices"] = { DSEX: undefined, DS30: undefined, DSES: undefined };
  for (const item of Array.isArray(payload?.indices) ? payload.indices : []) {
    const key = String(item?.key || "").toUpperCase();
    const value = num(item?.value);
    if ((key === "DSEX" || key === "DS30" || key === "DSES") && value && value > 0) {
      indices[key] = {
        value,
        change: num(item.change) ?? 0,
        changePercent: num(item.percent) ?? 0,
        prev: num(item.prev)
      };
    }
  }
  const b = payload?.breadth;
  return {
    indices,
    totals: payload?.totals && typeof payload.totals === "object" ? payload.totals : undefined,
    breadth: b && typeof b.advanced === "number"
      ? { advanced: b.advanced, declined: b.declined || 0, unchanged: b.unchanged || 0, traded: b.traded || 0 }
      : undefined,
    session: parseSession(payload?.session)
  };
}

export async function fetchLivePrices(client: DseClient = defaultDseClient) {
  const { data, url } = await getJson(client, DSE_LIVE_PRICES_PATH);
  return { ...parseLivePrices(data), url };
}

export async function fetchLiveMarket(client: DseClient = defaultDseClient) {
  const { data, url } = await getJson(client, DSE_LIVE_MARKET_PATH);
  return { ...parseLiveMarket(data), url };
}
