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

const dhakaDate = (now: Date) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);

/** DSE's trade-time stamp, e.g. "Oct 05, 2026 at 10:16 AM" -> { date: "2026-10-05", minutes: 616 } */
export function parseTradeTime(s: unknown): { date: string; minutes: number } | null {
  const m = typeof s === "string" ? s.match(/^([A-Za-z]{3,})\s+(\d{1,2}),\s+(\d{4})\s+at\s+(\d{1,2}):(\d{2})\s*([AP]M)$/i) : null;
  if (!m) return null;
  const d = new Date(`${m[1]} ${m[2]}, ${m[3]} 00:00:00 UTC`);
  if (isNaN(d.getTime())) return null;
  const hour = (Number(m[4]) % 12) + (m[6].toUpperCase() === "PM" ? 12 : 0);
  return { date: d.toISOString().slice(0, 10), minutes: hour * 60 + Number(m[5]) };
}

const SESSION_OPENS_AT_MINUTES = 10 * 60; // DSE continuous trading starts 10:00 Dhaka

/**
 * The trading day the feed's prices belong to. DSE's own session.sessionDate lags while trading is
 * under way (observed 5 Oct 2026: isOpen true, sessionDate "2026-10-04", tradeTime "Oct 05 ... 10:16 AM",
 * DSEX prev = the 4 Oct close), so it is only trusted when nothing better is known:
 *  - market open                      -> today in Dhaka
 *  - trade time at/after 10:00        -> that day (trading happened then)
 *  - pre-open stamp (e.g. 8:36 AM)    -> ignored; the prices are still the previous session's
 *  - otherwise                        -> DSE's sessionDate, never later than today
 */
export function resolveSessionDate(session: DseSessionInfo | undefined, tradeTime: unknown, now = new Date()): string | null {
  const today = dhakaDate(now);
  if (session?.isOpen) return today;
  const trade = parseTradeTime(tradeTime);
  if (trade && trade.minutes >= SESSION_OPENS_AT_MINUTES && trade.date <= today) {
    if (!session?.sessionDate || trade.date > session.sessionDate) return trade.date;
  }
  const reported = session?.sessionDate ?? null;
  return reported && reported > today ? today : reported;
}
