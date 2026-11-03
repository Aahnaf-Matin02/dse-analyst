import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { mergeBars, validateBar, safeSymbolFileName, HistoryBar, parseHistoryFile, HISTORY_HEADER, findDiscontinuities } from "../services/history/historyFiles";
import { setRoot, setFetcher, setDelay, fetchWindows, loadIntoHistory, monthWindows, extractDayEndTable } from "../../scripts/backfill-history";

// Everything here runs in a temporary directory with a mocked network — never the real site or data folder.
let root: string;
const hist = () => path.join(root, "data", "history");
const bar = (date: string, close: number, source: HistoryBar["source"] = "DSE_OFFICIAL", extra: Partial<HistoryBar> = {}): HistoryBar =>
  ({ date, open: close, high: close, low: close, close, volume: 100, source, ...extra });

const DAYEND_HEADER = ["#", "DATE", "TRADING CODE", "LTP*", "HIGH", "LOW", "OPENP*", "CLOSEP*", "YCP", "TRADE", "VALUE (mn)", "VOLUME"];
function dayEndHtml(rows: string[][]) {
  const tr = (cells: string[], tag = "td") => `<tr>${cells.map(c => `<${tag}>${c}</${tag}>`).join("")}</tr>`;
  return `<!doctype html><html><body><table>${tr(DAYEND_HEADER, "th")}${rows.map(r => tr(r)).join("")}</table></body></html>`;
}
const summaryHtml = (date: string, dsex: string) =>
  `<html><body><table><tr><td>Market Summary of ${date}</td></tr><tr><td>DSEX Index</td><td>${dsex}</td><td>Total Trade</td><td>100</td></tr><tr><td>DSEX Index Change</td><td>-1.5</td><td>Total Value Taka(mn)</td><td>5.5</td></tr><tr><td>DS30 Index</td><td>2,000.5</td><td>Total Volume</td><td>1,000</td></tr><tr><td>DS30 Index Change</td><td>2.5</td><td>Total Market Cap. Taka(mn)</td><td>9</td></tr></table></body></html>`;

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "dse-backfill-"));
  setRoot(root);
  setDelay(0);
  fs.mkdirSync(path.join(hist(), "source-map"), { recursive: true });
  fs.writeFileSync(path.join(hist(), "source-map", "website-symbols.json"), JSON.stringify({ symbols: ["GP", "AMCL(PRAN)", "NEWCO"] }));
});
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

describe("safe filenames", () => {
  it("maps special characters so codes never reach paths or URLs unescaped", () => {
    expect(safeSymbolFileName("AMCL(PRAN)")).toBe("AMCL_PRAN");
    expect(safeSymbolFileName("KAY&QUE")).toBe("KAY_QUE");
    expect(safeSymbolFileName("1JANATAMF")).toBe("1JANATAMF");
    expect(safeSymbolFileName("../../etc/passwd")).not.toMatch(/[\\/]/);
  });
});

describe("row validation (never repairs values)", () => {
  it("rejects bad rows with a reason", () => {
    expect(validateBar(bar("2026-10-04", 240))).toBeNull();
    expect(validateBar({ ...bar("2026-10-04", 240), open: 0 })).toMatch(/price <= 0/);
    expect(validateBar({ ...bar("2026-10-04", 240), high: 239, low: 241 })).toMatch(/high below low/);
    expect(validateBar({ ...bar("2026-10-04", 240), high: 239 })).toMatch(/high below/);
    expect(validateBar({ ...bar("2026-10-04", 240), volume: -1 })).toMatch(/volume/);
    expect(validateBar({ ...bar("2026-10-04", 240), source: "Simulated" as any })).toMatch(/unknown source/);
  });

  it("rejects Friday/Saturday dates unless DSE held an official session that day", () => {
    const sat = bar("2026-10-03", 240); // a Saturday
    expect(validateBar(sat)).toMatch(/Friday\/Saturday/);
    expect(validateBar(sat, new Set(["2026-10-03"]))).toBeNull();
  });
});

describe("merge preference", () => {
  it("prefers DSE_OFFICIAL over LankaBD over InvestingCSV and logs every conflict", () => {
    const existing = [bar("2026-01-01", 10, "InvestingCSV"), bar("2026-01-02", 11, "DSE_OFFICIAL")];
    const incoming = [bar("2026-01-01", 12, "LankaBD"), bar("2026-01-02", 99, "LankaBD"), bar("2026-01-03", 13, "LankaBD")];
    const { merged, conflicts, added } = mergeBars("GP", existing, incoming);
    expect(merged.map(b => [b.date, b.close, b.source])).toEqual([
      ["2026-01-01", 12, "LankaBD"],      // LankaBD beats InvestingCSV
      ["2026-01-02", 11, "DSE_OFFICIAL"], // DSE beats LankaBD
      ["2026-01-03", 13, "LankaBD"],
    ]);
    expect(added).toBe(1);
    expect(conflicts).toHaveLength(2);
    expect(conflicts[1].reason).toMatch(/DSE_OFFICIAL preferred over LankaBD/);
  });

  it("flags >20% close-to-close moves as possible corporate actions", () => {
    const d = findDiscontinuities("X", [bar("2026-01-01", 100), bar("2026-01-02", 70)]);
    expect(d).toHaveLength(1);
    expect(d[0].change).toBeCloseTo(-0.3);
  });
});

describe("backfill: fetch → raw files → load", () => {
  const pages: Record<string, string> = {
    "2026-09": dayEndHtml([
      ["1", "2026-09-30", "GP", "241.9", "242.9", "241.5", "242.9", "241.6", "241.8", "652", "10.4", "43,119"],
      ["2", "2026-09-29", "GP", "242.4", "243", "241.7", "242.4", "241.8", "242.4", "589", "7.3", "30,426"],
      ["3", "2026-09-30", "AMCL(PRAN)", "0", "0", "0", "0", "205.1", "205.1", "0", "0", "0"], // no trade
      ["4", "2026-09-29", "AMCL(PRAN)", "205.1", "206", "204", "205", "205.1", "204.5", "50", "1.1", "5,000"],
    ]),
    "2026-10": dayEndHtml([["1", "2026-10-01", "GP", "241.1", "242", "241", "242", "241.1", "241.6", "719", "14.0", "58,099"]]),
  };
  const calls: string[] = [];
  const fakeFetch = async (url: string) => {
    calls.push(url);
    const m = url.match(/startDate=(\d{4}-\d{2})/)!;
    if (url.includes("market_summary")) return { status: 200, body: summaryHtml(m[1] === "2026-09" ? "Sep 30, 2026" : "Oct 01, 2026", "5,550.4") };
    return { status: 200, body: pages[m[1]] ?? dayEndHtml([]) };
  };

  it("saves raw tables unchanged, resumes by skipping finished windows, then loads clean files", async () => {
    calls.length = 0;
    setFetcher(fakeFetch);
    await fetchWindows("2026-09-01", "2026-10-02", 1); // run 1: only September
    expect(calls.filter(u => u.includes("day_end"))).toHaveLength(1);
    const raw = fs.readFileSync(path.join(hist(), "imports", "dse_official", "day-end", "2026-09.csv"), "utf8");
    expect(raw).toContain('"43,119"'); // exact cell text kept (thousands separator intact)

    calls.length = 0;
    await fetchWindows("2026-09-01", "2026-10-02", 6); // run 2: September is complete → skipped
    expect(calls.some(u => u.includes("startDate=2026-09"))).toBe(false);
    expect(calls.some(u => u.includes("startDate=2026-10"))).toBe(true);

    const res = loadIntoHistory();
    const gp = parseHistoryFile(fs.readFileSync(path.join(hist(), "stocks", "GP.csv"), "utf8"));
    expect(fs.readFileSync(path.join(hist(), "stocks", "GP.csv"), "utf8").split("\n")[0]).toBe(HISTORY_HEADER);
    expect(gp.map(b => [b.date, b.open, b.close, b.volume, b.source])).toEqual([
      ["2026-09-29", 242.4, 241.8, 30426, "DSE_OFFICIAL"],
      ["2026-09-30", 242.9, 241.6, 43119, "DSE_OFFICIAL"],
      ["2026-10-01", 242, 241.1, 58099, "DSE_OFFICIAL"],
    ]);
    // special-character symbol stored under its safe name; the no-trade day is quarantined, not filled
    const amcl = parseHistoryFile(fs.readFileSync(path.join(hist(), "stocks", "AMCL_PRAN.csv"), "utf8"));
    expect(amcl.map(b => b.date)).toEqual(["2026-09-29"]);
    const q = JSON.parse(fs.readFileSync(path.join(hist(), "errors", "quarantined-rows.json"), "utf8"));
    expect(q.bySymbol["AMCL(PRAN)"][0]).toMatchObject({ date: "2026-09-30", reason: expect.stringMatching(/price <= 0/) });
    // a symbol with no data stays missing — no file is created for it
    expect(fs.existsSync(path.join(hist(), "stocks", "NEWCO.csv"))).toBe(false);
    expect(res.withData).toBe(2);
    // index closes from the market summary archive
    expect(fs.readFileSync(path.join(hist(), "indices", "DSEX.csv"), "utf8")).toContain("2026-09-30,,,,5550.4,,DSE_OFFICIAL");
  });

  it("incremental load only appends new dates and leaves existing rows untouched", async () => {
    setFetcher(fakeFetch);
    await fetchWindows("2026-09-01", "2026-09-30", 6);
    loadIntoHistory();
    const before = fs.readFileSync(path.join(hist(), "stocks", "GP.csv"), "utf8");
    await fetchWindows("2026-09-01", "2026-10-02", 6); // October arrives
    loadIntoHistory();
    const after = fs.readFileSync(path.join(hist(), "stocks", "GP.csv"), "utf8");
    expect(after.startsWith(before.trimEnd())).toBe(true);
    expect(after.trim().split("\n").length).toBe(before.trim().split("\n").length + 1);
    const conflicts = JSON.parse(fs.readFileSync(path.join(hist(), "processed", "conflicts.json"), "utf8"));
    expect(conflicts.conflicts).toHaveLength(0);
  });

  it("stops immediately on 429 and keeps the progress made so far", async () => {
    let n = 0;
    setFetcher(async (url) => (++n > 2 ? { status: 429, body: "" } : fakeFetch(url)));
    await expect(fetchWindows("2026-09-01", "2026-10-02", 6)).rejects.toThrow(/429/);
    const progress = JSON.parse(fs.readFileSync(path.join(hist(), "processed", "backfill-progress.json"), "utf8"));
    expect(Object.keys(progress.windows)).toEqual(["2026-09"]);
  });

  it("parses the archive table and month windows", () => {
    expect(extractDayEndTable(pages["2026-10"])!.rows).toHaveLength(1);
    expect(monthWindows("2026-09-15", "2026-10-02")).toEqual([
      { key: "2026-09", start: "2026-09-15", end: "2026-09-30" },
      { key: "2026-10", start: "2026-10-01", end: "2026-10-02" },
    ]);
  });
});
