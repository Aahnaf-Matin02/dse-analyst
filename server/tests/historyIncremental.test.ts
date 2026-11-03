import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { HISTORY_HEADER, parseHistoryFile } from "../services/history/historyFiles";
import { setRoot, setFetcher, setDelay } from "../services/history/dseArchive";
import { runIncrementalUpdate, readIncrementalStatus, isDue, acquireLock, releaseLock } from "../services/history/historyIncremental";
import { saveDailyHistoryRecord } from "../repositories/marketIndexRepository";

// Temporary data directory and mocked network only — never the real site or the real data folder.
let root: string;
let requested: string[];
const hist = () => path.join(root, "data", "history");
const gpFile = () => path.join(hist(), "stocks", "GP.csv");

const DAYEND_HEADER = ["#", "DATE", "TRADING CODE", "LTP*", "HIGH", "LOW", "OPENP*", "CLOSEP*", "YCP", "TRADE", "VALUE (mn)", "VOLUME"];
const tr = (cells: string[], tag = "td") => `<tr>${cells.map(c => `<${tag}>${c}</${tag}>`).join("")}</tr>`;
const dayEndHtml = (rows: string[][]) => `<html><body><table>${tr(DAYEND_HEADER, "th")}${rows.map(r => tr(r)).join("")}</table></body></html>`;
const gpRow = (date: string, close: string) => ["1", date, "GP", close, close, close, close, close, close, "500", "1.0", "1,000"];
const summaryHtml = (date: string) =>
  `<html><body><table><tr><td>Market Summary of ${date}</td></tr><tr><td>DSEX Index</td><td>5,480.5</td></tr><tr><td>DSEX Index Change</td><td>-2</td></tr><tr><td>DS30 Index</td><td>2,080.1</td></tr><tr><td>DS30 Index Change</td><td>1</td></tr></table></body></html>`;

// 2026-10-05 is a Monday. 10:00 UTC = 16:00 Dhaka (after close); 03:00 UTC = 09:00 Dhaka (before open).
const AFTER_CLOSE = new Date("2026-10-05T10:00:00Z");
const BEFORE_OPEN = new Date("2026-10-05T03:00:00Z");
const EXISTING = `${HISTORY_HEADER}\n2026-09-30,242.9,242.9,241.5,241.6,43119,DSE_OFFICIAL\n2026-10-01,242,242,241,241.1,58099,DSE_OFFICIAL\n`;

function serve(dayEndRows: string[][], status = 200) {
  setFetcher(async url => {
    requested.push(url);
    if (status !== 200) return { status, body: "" };
    return { status: 200, body: url.includes("day_end_archive") ? dayEndHtml(dayEndRows) : summaryHtml("Oct 4, 2026") };
  });
}

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "dse-incremental-"));
  requested = [];
  setRoot(root);
  setDelay(0);
  fs.mkdirSync(path.join(hist(), "source-map"), { recursive: true });
  fs.mkdirSync(path.join(hist(), "stocks"), { recursive: true });
  fs.writeFileSync(path.join(hist(), "source-map", "website-symbols.json"), JSON.stringify({ symbols: ["GP"] }));
  fs.writeFileSync(gpFile(), EXISTING);
});
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

describe("daily incremental history update", () => {
  it("requests only the days after the latest stored session and appends only new dates", async () => {
    serve([gpRow("2026-10-04", "240.8"), gpRow("2026-10-05", "239.0")]);
    const run = await runIncrementalUpdate("test", root, AFTER_CLOSE);

    expect(run.ok).toBe(true);
    expect(run.outcome).toBe("updated");
    expect(requested[0]).toContain("startDate=2026-10-02&endDate=2026-10-05");
    const text = fs.readFileSync(gpFile(), "utf8");
    expect(text.startsWith(EXISTING)).toBe(true); // existing rows untouched, byte for byte
    expect(parseHistoryFile(text).map(b => b.date)).toEqual(["2026-09-30", "2026-10-01", "2026-10-04", "2026-10-05"]);
    expect(run.result?.rowsAdded).toBe(2);
    // Raw archive rows are saved before loading, in the monthly raw file the backfill uses
    expect(fs.readFileSync(path.join(hist(), "imports", "dse_official", "day-end", "2026-10.csv"), "utf8")).toContain("2026-10-05,GP");

    const status = readIncrementalStatus(root);
    expect(status.lastOutcome).toBe("updated");
    expect(status.latestSessionStored).toBe("2026-10-05");
    expect(status.lastSessionsAdded).toEqual(["2026-10-04", "2026-10-05"]);
  });

  it("ignores rows outside the requested range instead of trusting them", async () => {
    serve([gpRow("2026-10-01", "999"), gpRow("2026-10-04", "240.8")]);
    await runIncrementalUpdate("test", root, AFTER_CLOSE);
    const bars = parseHistoryFile(fs.readFileSync(gpFile(), "utf8"));
    expect(bars.find(b => b.date === "2026-10-01")?.close).toBe(241.1);
  });

  it("does not include today before the session is final", async () => {
    serve([gpRow("2026-10-04", "240.8")]);
    await runIncrementalUpdate("test", root, BEFORE_OPEN);
    expect(requested[0]).toContain("startDate=2026-10-02&endDate=2026-10-04");
  });

  it("changes nothing when the archive has no new session (holiday / not yet published)", async () => {
    serve([]);
    const run = await runIncrementalUpdate("test", root, AFTER_CLOSE);
    expect(run.outcome).toBe("no-new-session");
    expect(requested).toHaveLength(1); // no second request when there is nothing to store
    expect(fs.readFileSync(gpFile(), "utf8")).toBe(EXISTING);
    expect(readIncrementalStatus(root).lastSuccessAt).toBeNull();
  });

  it("makes no request when history already has the latest completed session", async () => {
    fs.appendFileSync(gpFile(), "2026-10-04,241.7,241.8,240.7,240.8,35942,DSE_OFFICIAL\n");
    serve([]);
    const run = await runIncrementalUpdate("test", root, BEFORE_OPEN);
    expect(run.outcome).toBe("up-to-date");
    expect(requested).toHaveLength(0);
  });

  it("stops on 429 without changing files, and the scheduler does not retry that day", async () => {
    serve([], 429);
    const run = await runIncrementalUpdate("test", root, AFTER_CLOSE);
    expect(run.ok).toBe(false);
    expect(run.outcome).toBe("stopped");
    expect(requested).toHaveLength(1);
    expect(fs.readFileSync(gpFile(), "utf8")).toBe(EXISTING);
    const status = { ...readIncrementalStatus(root), lastAttemptAt: AFTER_CLOSE.toISOString() };
    expect(isDue(new Date("2026-10-05T12:00:00Z"), status)).toBe(false);
  });

  it("refuses to run while another update or backfill holds the lock", async () => {
    serve([gpRow("2026-10-04", "240.8")]);
    expect(acquireLock(root)).toBe(true);
    const run = await runIncrementalUpdate("test", root, AFTER_CLOSE);
    expect(run.outcome).toBe("locked");
    expect(requested).toHaveLength(0);
    releaseLock(root);
  });
});

describe("index history: official closes win over live values", () => {
  it("keeps live-only records (e.g. DSES) and replaces live values with archive closes for the same day", async () => {
    const indexFile = path.join(root, "data", "market_index_history.json");
    fs.writeFileSync(indexFile, JSON.stringify([
      { timestamp: "x", index_name: "DSEX", index_value: 5502.8, change_value: 0, change_percent: 0, trading_date: "2026-10-04", source: "LiveScraped" },
      { timestamp: "x", index_name: "DSES", index_value: 1093.9, change_value: 0, change_percent: 0, trading_date: "2026-10-04", source: "LiveScraped" },
    ]));
    serve([gpRow("2026-10-04", "240.8")]);
    await runIncrementalUpdate("test", root, AFTER_CLOSE);
    const records = JSON.parse(fs.readFileSync(indexFile, "utf8"));
    const dsex = records.filter((r: any) => r.index_name === "DSEX" && r.trading_date === "2026-10-04");
    expect(dsex).toHaveLength(1);
    expect(dsex[0]).toMatchObject({ index_value: 5480.5, source: "DSE_OFFICIAL" });
    expect(records.find((r: any) => r.index_name === "DSES")).toMatchObject({ index_value: 1093.9, source: "LiveScraped" });
  });

  it("refuses live values dated to any day other than today in Dhaka (stale session date)", () => {
    const rec = { timestamp: "x", index_name: "DSEX", index_value: 5502.8, change_value: 0, change_percent: 0, trading_date: "2026-10-04" };
    expect(saveDailyHistoryRecord(rec, "2026-10-05")).toBe(false); // returns before reading or writing any file
  });
});

describe("schedule", () => {
  const fresh = readIncrementalStatus("/nonexistent");
  it("runs Sunday–Thursday between 16:00 and 22:00 Dhaka until the day's session is stored", () => {
    expect(isDue(new Date("2026-10-05T10:00:00Z"), fresh)).toBe(true);   // Mon 16:00
    expect(isDue(new Date("2026-10-05T09:00:00Z"), fresh)).toBe(false);  // Mon 15:00, too early
    expect(isDue(new Date("2026-10-05T16:30:00Z"), fresh)).toBe(false);  // Mon 22:30, window closed
    expect(isDue(new Date("2026-10-09T10:00:00Z"), fresh)).toBe(false);  // Friday
    expect(isDue(new Date("2026-10-10T10:00:00Z"), fresh)).toBe(false);  // Saturday
    expect(isDue(new Date("2026-10-05T11:00:00Z"), { ...fresh, latestSessionStored: "2026-10-05" })).toBe(false);
  });

  it("is never started at import time (nothing written to data/history on startup)", () => {
    expect(fs.existsSync(path.join(hist(), "processed", "incremental-status.json"))).toBe(false);
  });
});
