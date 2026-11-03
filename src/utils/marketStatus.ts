// Helpers for describing market data honestly: when it is from, where it came from, and whether the market is open.

export interface MarketSession {
  isOpen: boolean;
  phase: string;
  sessionDate: string | null;
  basis?: "DSE" | "schedule";
}

export interface IndicesPayload {
  timestamp?: string;
  source?: string;
  status?: "LIVE" | "DELAYED" | "DISCONNECTED" | string;
  totals?: { trades?: number; volume?: number; turnover?: number; marketCap?: number; tradeTime?: string };
  breadth?: { advanced: number; declined: number; unchanged: number; traded: number };
  session?: MarketSession;
}

const DHAKA_TZ = "Asia/Dhaka";

/** "4 Oct 2026, 2:40 PM" in Dhaka time */
export function formatDhakaDateTime(iso: string | number | Date | null | undefined): string | null {
  if (iso === null || iso === undefined || iso === "") return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleString("en-GB", { timeZone: DHAKA_TZ, day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true });
}

/** "4 Oct 2026" from a YYYY-MM-DD trading date (no timezone shifting) */
export function formatSessionDate(ymd: string | null | undefined): string | null {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-GB", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" });
}

/** DSE's own trade-time string, e.g. "Oct 04, 2026 at 2:40 PM" -> { date: "4 Oct 2026", time: "2:40 PM" } */
export function parseDseTradeTime(s: string | undefined): { date: string; time: string } | null {
  const m = typeof s === "string" ? s.match(/^([A-Za-z]{3,})\s+(\d{1,2}),\s+(\d{4})\s+at\s+(\d{1,2}:\d{2}\s*[AP]M)$/i) : null;
  if (!m) return null;
  const d = new Date(`${m[1]} ${m[2]}, ${m[3]} 00:00:00 UTC`);
  if (isNaN(d.getTime())) return null;
  return { date: d.toLocaleDateString("en-GB", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" }), time: m[4].toUpperCase() };
}

export type FeedState = "live" | "closed" | "delayed" | "offline" | "unknown";

/**
 * "live" only when DSE reports the session open AND the last scrape succeeded.
 * A successful scrape while the market is closed is "closed" (last session data), never "live".
 */
export function feedState(p: IndicesPayload | null | undefined): FeedState {
  if (!p) return "unknown";
  if (p.status === "DISCONNECTED") return "offline";
  if (p.status !== "LIVE") return "delayed";
  if (p.session && !p.session.isOpen) return "closed";
  return "live";
}

/** Human label for a data source code used across the API */
export function sourceLabel(source: string | undefined | null): string {
  switch (source) {
    case "LiveScraped":
    case "DSE_OFFICIAL":
      return "DSE (dse.com.bd)";
    case "CachedFile":
    case "DSE_OFFICIAL_CACHE":
      return "Saved DSE snapshot";
    case "DefaultSeed":
      return "Bundled sample snapshot";
    case "InvestingCSV":
    case "ImportedHistoricalCSV":
      return "Imported CSV (unverified)";
    case "LiveDseSnapshot":
      return "DSE daily snapshot";
    default:
      return source ? String(source) : "Unknown source";
  }
}

/**
 * "as of 4 Oct 2026, 2:40 PM" while live; "last session 4 Oct 2026, 2:40 PM" when closed.
 * Uses DSE's reported session date as the truth: outside trading hours DSE's trade-time stamp can
 * already carry the next day's pre-opening time, which must not be shown as the "last session".
 */
export function describeAsOf(p: IndicesPayload | null | undefined): string | null {
  if (!p) return null;
  const state = feedState(p);
  const trade = parseDseTradeTime(p.totals?.tradeTime);
  const sessionLabel = formatSessionDate(p.session?.sessionDate ?? null);
  if (state === "live") return trade ? `as of ${trade.time} (Dhaka)` : null;
  if (sessionLabel) {
    const sameDay = trade && trade.date === sessionLabel;
    return `last session ${sessionLabel}${sameDay ? `, closed ${trade!.time}` : ""}`;
  }
  return trade ? `as of ${trade.date}, ${trade.time} (Dhaka)` : formatDhakaDateTime(p.timestamp);
}
