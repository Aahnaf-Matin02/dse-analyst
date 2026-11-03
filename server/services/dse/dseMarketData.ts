import fs from "fs";
import path from "path";
import { DseRawUniverseItem, DseRawCompanyDetail, DseRawPriceRow } from "./dseParser";

export interface DseMarketSnapshot {
  symbol: string;
  tradingDate: string;
  lastPrice: number | null;
  open: number | null;
  high: number | null;
  low: number | null;
  previousClose: number | null;
  change: number | null;
  changePercent: number | null;
  volume: number | null;
  trades: number | null;
  turnover: number | null;
  marketCap: number | null;
  freeFloat?: number | null;
  freeFloatMarketCap: number | null;
  weekHigh52?: number | null;
  weekLow52?: number | null;
  source: "DSE_OFFICIAL" | "LOCAL_DEVELOPMENT_FALLBACK";
  sourceUrl: string;
  retrievedAt: string;
}

const STORAGE_DIR = path.join(process.cwd(), "data", "dse");
const SNAPSHOTS_FILE = path.join(STORAGE_DIR, "market-snapshots.json");

export class DseMarketDataManager {
  private static latestSnapshots: Map<string, DseMarketSnapshot> = new Map();
  private static lastLoadedTime: number = 0;

  static ensureStorage(): void {
    if (!fs.existsSync(STORAGE_DIR)) {
      fs.mkdirSync(STORAGE_DIR, { recursive: true });
    }
  }

  static getLatestSnapshot(symbol: string): DseMarketSnapshot | null {
    this.ensureLoaded();
    const sym = symbol.toUpperCase().trim();
    return this.latestSnapshots.get(sym) || null;
  }

  static getAllLatestSnapshots(): Record<string, DseMarketSnapshot> {
    this.ensureLoaded();
    const result: Record<string, DseMarketSnapshot> = {};
    for (const [sym, snap] of this.latestSnapshots.entries()) {
      result[sym] = snap;
    }
    return result;
  }

  static getSnapshotCount(): number {
    this.ensureLoaded();
    return this.latestSnapshots.size;
  }

  private static ensureLoaded(): void {
    const now = Date.now();
    if (this.latestSnapshots.size > 0 && now - this.lastLoadedTime < 30000) {
      return;
    }

    this.ensureStorage();

    if (fs.existsSync(SNAPSHOTS_FILE)) {
      try {
        const raw = fs.readFileSync(SNAPSHOTS_FILE, "utf-8");
        const list: DseMarketSnapshot[] = JSON.parse(raw);
        this.latestSnapshots.clear();
        for (const item of list) {
          if (item && item.symbol) {
            this.latestSnapshots.set(item.symbol.toUpperCase().trim(), item);
          }
        }
        this.lastLoadedTime = now;
        return;
      } catch (e) {
        console.warn("[DseMarketDataManager] Failed to load market snapshots:", e);
      }
    }
  }

  /**
   * Updates market snapshots from universe scan.
   * Calculates marketCap strictly from official DSE reported marketCap, or paidUpCapital/faceValue × price.
   * Never fabricates or estimates missing marketCap.
   */
  static updateFromUniverseItems(items: DseRawUniverseItem[], sourceUrl: string): number {
    this.ensureStorage();
    this.ensureLoaded();

    const now = new Date().toISOString();
    const today = now.split("T")[0];
    let count = 0;

    for (const item of items) {
      const sym = item.code.toUpperCase().trim();
      const existing = this.latestSnapshots.get(sym);

      // Before the opening (and for untraded securities) DSE lists a price of 0. That means "no trade
      // yet", not a price: never overwrite the last real snapshot with it (it showed as -100%).
      if (!(typeof item.price === "number" && item.price > 0)) continue;

      // Official price & changes
      const lastPrice = typeof item.price === "number" && !isNaN(item.price) ? item.price : (existing?.lastPrice ?? null);
      const changePct = typeof item.changePct === "number" && !isNaN(item.changePct) ? item.changePct : (existing?.changePercent ?? null);
      const volume = typeof item.volume === "number" && !isNaN(item.volume) ? item.volume : (existing?.volume ?? null);

      // Official DSE market cap
      const officialMarketCap = typeof item.marketCap === "number" && !isNaN(item.marketCap) && item.marketCap > 0
        ? item.marketCap
        : (existing?.marketCap ?? null);

      const snapshot: DseMarketSnapshot = {
        symbol: sym,
        tradingDate: today,
        lastPrice,
        open: existing?.open ?? lastPrice,
        high: existing?.high ?? lastPrice,
        low: existing?.low ?? lastPrice,
        previousClose: existing?.previousClose ?? null,
        change: lastPrice && existing?.previousClose ? parseFloat((lastPrice - existing.previousClose).toFixed(2)) : (existing?.change ?? null),
        changePercent: changePct,
        volume,
        trades: existing?.trades ?? null,
        turnover: existing?.turnover ?? null,
        marketCap: officialMarketCap,
        freeFloat: existing?.freeFloat ?? null,
        freeFloatMarketCap: existing?.freeFloatMarketCap ?? null,
        source: "DSE_OFFICIAL",
        sourceUrl,
        retrievedAt: now
      };

      this.latestSnapshots.set(sym, snapshot);
      count++;
    }

    this.persistToDisk();
    return count;
  }

  /**
   * Updates market snapshots directly from homepage price table rows.
   */
  static updateFromPriceRows(rows: DseRawPriceRow[], sourceUrl: string): number {
    this.ensureStorage();
    this.ensureLoaded();

    const now = new Date().toISOString();
    const today = now.split("T")[0];
    let count = 0;

    for (const r of rows) {
      const sym = r.code.toUpperCase().trim();
      const existing = this.latestSnapshots.get(sym);

      // ltp 0 = not traded yet this session: keep the last real snapshot
      if (!(typeof r.ltp === "number" && r.ltp > 0)) continue;
      const lastPrice = r.ltp;
      const open = r.open ?? existing?.open ?? lastPrice;
      const high = r.high ?? existing?.high ?? lastPrice;
      const low = r.low ?? existing?.low ?? lastPrice;
      const previousClose = r.ycp ?? existing?.previousClose ?? null;
      const change = previousClose !== null ? parseFloat((lastPrice - previousClose).toFixed(2)) : (existing?.change ?? null);
      const changePercent = typeof r.percent === "number" ? r.percent : (existing?.changePercent ?? null);

      const snapshot: DseMarketSnapshot = {
        symbol: sym,
        tradingDate: today,
        lastPrice,
        open,
        high,
        low,
        previousClose,
        change,
        changePercent,
        volume: typeof r.volume === "number" ? r.volume : (existing?.volume ?? null),
        trades: typeof r.trades === "number" ? r.trades : (existing?.trades ?? null),
        turnover: typeof r.value === "number" ? r.value : (existing?.turnover ?? null),
        marketCap: existing?.marketCap ?? null,
        freeFloat: existing?.freeFloat ?? null,
        freeFloatMarketCap: existing?.freeFloatMarketCap ?? null,
        source: "DSE_OFFICIAL",
        sourceUrl,
        retrievedAt: now
      };

      this.latestSnapshots.set(sym, snapshot);
      count++;
    }

    this.persistToDisk();
    return count;
  }

  /**
   * Updates snapshot from deep company detail endpoint.
   */
  static updateFromCompanyDetail(detail: DseRawCompanyDetail, sourceUrl: string): void {
    this.ensureStorage();
    this.ensureLoaded();

    const now = new Date().toISOString();
    const sym = detail.code.toUpperCase().trim();
    const today = detail.asOfDate || now.split("T")[0];

    // Market capitalization strictly uses official DSE marketCap, or paidUpCapital/faceValue × price.
    // Never fabricates or estimates.
    let officialMarketCap: number | null = null;
    if (typeof detail.marketCap === "number" && !isNaN(detail.marketCap) && detail.marketCap > 0) {
      officialMarketCap = detail.marketCap;
    } else if (
      typeof detail.paidUpCapital === "number" &&
      typeof detail.faceValue === "number" &&
      typeof detail.price === "number" &&
      detail.faceValue > 0
    ) {
      officialMarketCap = (detail.paidUpCapital / detail.faceValue) * detail.price;
    }

    const snapshot: DseMarketSnapshot = {
      symbol: sym,
      tradingDate: today,
      lastPrice: detail.price,
      open: detail.open,
      high: detail.high,
      low: detail.low,
      previousClose: detail.prevClose,
      change: detail.change,
      changePercent: detail.changePct,
      volume: detail.volume,
      trades: detail.trades,
      turnover: null,
      marketCap: officialMarketCap,
      freeFloat: detail.freeFloat ?? null,
      freeFloatMarketCap: detail.freeFloatMarketCap,
      weekHigh52: detail.weekHigh52 ?? null,
      weekLow52: detail.weekLow52 ?? null,
      source: "DSE_OFFICIAL",
      sourceUrl,
      retrievedAt: now
    };

    this.latestSnapshots.set(sym, snapshot);
    this.persistToDisk();
  }

  /**
   * Returns the ISO date (YYYY-MM-DD) of the last expected completed or current trading day in Dhaka (Asia/Dhaka, UTC+6).
   * DSE trading days: Sunday (0) through Thursday (4). Weekly holidays: Friday (5) and Saturday (6).
   */
  static getLastExpectedTradingDay(now = new Date()): string {
    const DHAKA_OFFSET_MS = 6 * 60 * 60 * 1000;
    const dhakaNow = new Date(now.getTime() + DHAKA_OFFSET_MS);

    const year = dhakaNow.getUTCFullYear();
    const month = dhakaNow.getUTCMonth();
    const date = dhakaNow.getUTCDate();
    const dayOfWeek = dhakaNow.getUTCDay(); // 0 = Sun, ..., 4 = Thu, 5 = Fri, 6 = Sat
    const hour = dhakaNow.getUTCHours();

    let daysAgo = 0;
    if (dayOfWeek === 5) {
      // Friday: market closed today, last session was Thursday
      daysAgo = 1;
    } else if (dayOfWeek === 6) {
      // Saturday: market closed today, last session was Thursday
      daysAgo = 2;
    } else if (dayOfWeek === 0) {
      // Sunday: before 10:00 AM Dhaka, last session was Thursday (3 days ago); after 10:00 AM, today
      daysAgo = hour < 10 ? 3 : 0;
    } else {
      // Mon (1) to Thu (4): before 10:00 AM Dhaka, last session was yesterday; after 10:00 AM, today
      daysAgo = hour < 10 ? 1 : 0;
    }

    const targetDate = new Date(Date.UTC(year, month, date - daysAgo));
    return targetDate.toISOString().split("T")[0];
  }

  /**
   * Calculates the UTC millisecond timestamp cutoff for the most recent completed or active trading session in Dhaka (Asia/Dhaka, UTC+6).
   * DSE trading days: Sunday (0) through Thursday (4). Weekly holidays: Friday (5) and Saturday (6).
   * Trading hours: 10:00 AM to 2:30 PM Asia/Dhaka.
   * A snapshot is considered stale only if retrieved prior to the start of the last expected trading session.
   */
  static getLastTradingSessionCutoff(now = new Date()): number {
    const DHAKA_OFFSET_MS = 6 * 60 * 60 * 1000;
    const dhakaNow = new Date(now.getTime() + DHAKA_OFFSET_MS);

    const year = dhakaNow.getUTCFullYear();
    const month = dhakaNow.getUTCMonth();
    const date = dhakaNow.getUTCDate();
    const dayOfWeek = dhakaNow.getUTCDay(); // 0 = Sun, 1 = Mon, ..., 4 = Thu, 5 = Fri, 6 = Sat
    const hour = dhakaNow.getUTCHours();

    let daysAgo = 0;
    if (dayOfWeek === 5) {
      // Friday: market closed today, last session was Thursday
      daysAgo = 1;
    } else if (dayOfWeek === 6) {
      // Saturday: market closed today, last session was Thursday
      daysAgo = 2;
    } else if (dayOfWeek === 0) {
      // Sunday: before 10:00 AM Dhaka, last session was Thursday (3 days ago); after 10:00 AM, today
      daysAgo = hour < 10 ? 3 : 0;
    } else {
      // Mon (1) to Thu (4): before 10:00 AM Dhaka, last session was yesterday; after 10:00 AM, today
      daysAgo = hour < 10 ? 1 : 0;
    }

    // Session start day in UTC millis corresponding to 00:00:00 Dhaka time
    const sessionDayMidnightDhaka = Date.UTC(year, month, date - daysAgo, 0, 0, 0) - DHAKA_OFFSET_MS;
    return sessionDayMidnightDhaka;
  }

  static getStaleSnapshotCount(customCutoffOrExpectedDay?: string | number): number {
    this.ensureLoaded();
    let expectedDayStr: string;

    if (typeof customCutoffOrExpectedDay === "string" && /^\d{4}-\d{2}-\d{2}$/.test(customCutoffOrExpectedDay)) {
      expectedDayStr = customCutoffOrExpectedDay;
    } else {
      expectedDayStr = this.getLastExpectedTradingDay();
    }

    let stale = 0;
    for (const snap of this.latestSnapshots.values()) {
      const snapDate = snap.tradingDate
        ? (snap.tradingDate.includes("T") ? snap.tradingDate.split("T")[0] : snap.tradingDate)
        : null;

      if (!snapDate || snapDate < expectedDayStr) {
        stale++;
      }
    }
    return stale;
  }

  static getValidMetricsCount(): number {
    this.ensureLoaded();
    let count = 0;
    for (const snap of this.latestSnapshots.values()) {
      if (
        snap.lastPrice !== null &&
        typeof snap.lastPrice === "number" &&
        !isNaN(snap.lastPrice) &&
        snap.lastPrice > 0 &&
        snap.volume !== null &&
        typeof snap.volume === "number" &&
        !isNaN(snap.volume) &&
        snap.volume >= 0
      ) {
        count++;
      }
    }
    return count;
  }

  private static persistToDisk(): void {
    try {
      const allList = Array.from(this.latestSnapshots.values());
      const tempPath = `${SNAPSHOTS_FILE}.tmp`;
      fs.writeFileSync(tempPath, JSON.stringify(allList, null, 2), "utf-8");
      fs.renameSync(tempPath, SNAPSHOTS_FILE);
      this.lastLoadedTime = Date.now();
    } catch (e) {
      console.error("[DseMarketDataManager] Failed to persist market snapshots:", e);
    }
  }
}

export function getLastTradingSessionCutoff(now = new Date()): number {
  return DseMarketDataManager.getLastTradingSessionCutoff(now);
}

