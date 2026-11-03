import { describe, it, expect } from "vitest";
import { parseLivePrices, parseLiveMarket, resolveSessionDate } from "../services/dse/dseLiveApi";
import { liveRowsToStocks } from "../services/dseScraper";

// Shape of https://www.dse.com.bd/api/live/prices (captured 2026-10-05)
const pricesPayload = {
  cols: ["code", "ltp", "ycp", "open", "high", "low", "close", "volume", "value", "trades", "percent", "category", "board", "sector", "assetType"],
  rows: [
    ["GP", 240.8, 241.1, 241.7, 241.8, 240.7, 240.8, 35942, 8.658, 629, -0.1244, "A", "PUBLIC", "Telecom", "EQ"],
    ["ABBLPBOND", 0, 1060, 0, 0, 0, 1060, 0, 0, 0, null, "A", "DEBT", "CorpBond", "CB"],
    ["", 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, "A", "PUBLIC", "X", "EQ"]
  ],
  session: { isOpen: false, phase: "closed", date: "2026-10-05", sessionDate: "2026-10-04" }
};

describe("DSE live price feed", () => {
  it("parses rows by column name and reports the trading session date", () => {
    const { rows, session } = parseLivePrices(pricesPayload);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ code: "GP", ltp: 240.8, ycp: 241.1, volume: 35942, trades: 629, sector: "Telecom" });
    expect(session.sessionDate).toBe("2026-10-04");
  });

  it("is robust to column reordering", () => {
    const reordered = {
      cols: ["ltp", "code", "ycp"],
      rows: [[10.5, "ACI", 10]]
    };
    expect(parseLivePrices(reordered).rows[0]).toMatchObject({ code: "ACI", ltp: 10.5, ycp: 10 });
  });

  it("rejects payloads without the required columns", () => {
    expect(() => parseLivePrices({ cols: ["foo"], rows: [] })).toThrow();
  });

  it("converts traded and untraded securities into StockData correctly", () => {
    const stocks = liveRowsToStocks(parseLivePrices(pricesPayload).rows);
    expect(stocks.GP).toMatchObject({ price: 240.8, prevClose: 241.1, change: -0.3, changePercent: -0.12, high: 241.8, source: "LiveScraped" });
    // Untraded bond: ltp 0 -> reference price is the close, no change, no fake OHLC
    expect(stocks.ABBLPBOND).toMatchObject({ price: 1060, change: 0, changePercent: 0, high: null, low: null, open: null });
  });
});

describe("DSE live market feed", () => {
  it("parses indices, totals, breadth and session", () => {
    const m = parseLiveMarket({
      indices: [
        { key: "DSEX", value: 5482.36, change: -49.28, percent: -0.89, prev: 5531.65 },
        { key: "DS30", value: 2085.29, change: -18.25, percent: -0.87, prev: 2103.55 },
        { key: "DSES", value: 0, change: 0, percent: 0, prev: 0 }
      ],
      totals: { trades: 171907, turnover: 5429.87 },
      breadth: { advanced: 66, declined: 291, unchanged: 28, traded: 385 },
      session: { isOpen: false, phase: "closed", sessionDate: "2026-10-04" }
    });
    expect(m.indices.DSEX).toEqual({ value: 5482.36, change: -49.28, changePercent: -0.89, prev: 5531.65 });
    expect(m.indices.DSES).toBeUndefined(); // zero value is treated as missing, not as a real index level
    expect(m.breadth?.declined).toBe(291);
    expect(m.session.sessionDate).toBe("2026-10-04");
  });
});

describe("resolveSessionDate: which trading day the live prices belong to", () => {
  const open = { isOpen: true, phase: "open", sessionDate: "2026-10-04" };
  const closed = (sessionDate: string | null) => ({ isOpen: false, phase: "closed", sessionDate });
  // 2026-10-05 is a Monday; times below are Dhaka (UTC+6)
  const at = (dhaka: string) => new Date(`2026-10-05T${dhaka}:00+06:00`);

  it("uses today while trading, even though DSE still reports the previous session (observed 5 Oct 2026)", () => {
    expect(resolveSessionDate(open, "Oct 05, 2026 at 10:16 AM", at("10:17"))).toBe("2026-10-05");
  });

  it("uses the day of a trade stamp taken during or after trading once the market has closed", () => {
    expect(resolveSessionDate(closed("2026-10-04"), "Oct 05, 2026 at 2:30 PM", at("15:00"))).toBe("2026-10-05");
  });

  it("ignores the next day's pre-opening stamp: prices are still the previous session's", () => {
    expect(resolveSessionDate(closed("2026-10-04"), "Oct 05, 2026 at 8:36 AM", at("08:40"))).toBe("2026-10-04");
  });

  it("falls back to DSE's date, never later than today, and to null when nothing is known", () => {
    expect(resolveSessionDate(closed("2026-10-01"), undefined, at("09:00"))).toBe("2026-10-01");
    expect(resolveSessionDate(closed("2026-10-09"), undefined, at("09:00"))).toBe("2026-10-05");
    expect(resolveSessionDate(closed(null), "garbage", at("09:00"))).toBeNull();
  });
});
