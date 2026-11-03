/**
 * Daily price history from the official DSE day-end archive (old.dsebd.org, the legacy copy of
 * dse.com.bd that DSE still serves; it has no robots.txt restrictions).
 *
 * Used by the backfill CLI (scripts/backfill-history.ts) and the daily incremental update
 * (historyIncremental.ts).
 *
 * Rules: real data only. Raw responses are saved unchanged before any transformation. Nothing is
 * generated, interpolated or estimated; invalid rows are quarantined with a reason. Sequential
 * requests, 1.5 s apart, exponential backoff on timeouts/5xx, immediate stop on 403/429/challenge.
 * Progress is saved after every window, so the backfill can be re-run until nothing is pending.
 */
import fs from "fs";
import path from "path";
import https from "https";
import tls from "tls";
import { SECTIGO_DV_R36_PEM } from "../dse/legacyCert";
import * as cheerio from "cheerio";
import {
  HistoryBar, mergeBars, validateBar, findDiscontinuities, serializeHistoryFile, parseHistoryFile,
  stockHistoryPath, safeSymbolFileName, MergeConflict
} from "./historyFiles";

// ── configuration ────────────────────────────────────────────────────────────────────────────────
const BASE = "https://old.dsebd.org";
const USER_AGENT = "DSE-AI-Analyst/1.0 (educational project; daily history backfill)";
const MAX_RETRIES = 3;
const SOURCE = "DSE_OFFICIAL" as const;

// Paths are resolved per call so tests can point the script at an isolated temporary directory
let ROOT = process.env.BACKFILL_ROOT || process.cwd();
let HIST = "", RAW_DAYEND = "", RAW_SUMMARY = "", PROCESSED = "", ERRORS = "", PROGRESS_FILE = "", SYMBOLS_FILE = "";
export function setRoot(root: string) {
  ROOT = root;
  HIST = path.join(ROOT, "data", "history");
  RAW_DAYEND = path.join(HIST, "imports", "dse_official", "day-end");
  RAW_SUMMARY = path.join(HIST, "imports", "dse_official", "market-summary");
  PROCESSED = path.join(HIST, "processed");
  ERRORS = path.join(HIST, "errors");
  PROGRESS_FILE = path.join(PROCESSED, "backfill-progress.json");
  SYMBOLS_FILE = path.join(HIST, "source-map", "website-symbols.json");
}
setRoot(ROOT);

// Network access is injectable for tests (they must never hit the real site)
let fetchImpl: (url: string) => Promise<{ status: number; body: string }> = (url) => httpGet(url);
export function setFetcher(f: typeof fetchImpl) { fetchImpl = f; }
let delayMs = 1500;
export function setDelay(ms: number) { delayMs = ms; }

// ── small helpers ────────────────────────────────────────────────────────────────────────────────
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const ymd = (d: Date) => d.toISOString().slice(0, 10);
function writeJson(file: string, data: unknown) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n"); }
function readJson<T>(file: string, fallback: T): T { try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return fallback; } }
const toNum = (s: string) => { const v = Number(String(s).replace(/,/g, "").trim()); return Number.isFinite(v) ? v : NaN; };
const csvCell = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
function parseCsvLine(line: string): string[] {
  const out: string[] = []; let cur = ""; let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) { if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; }
    else if (c === '"') q = true; else if (c === ",") { out.push(cur); cur = ""; } else cur += c;
  }
  out.push(cur); return out;
}

/** Today's date in Dhaka (the archive only contains completed sessions). */
export function dhakaToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

export function monthWindows(from: string, to: string): { key: string; start: string; end: string }[] {
  const out = []; let d = new Date(from.slice(0, 7) + "-01T00:00:00Z");
  while (ymd(d) <= to) {
    const next = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
    const end = new Date(next.getTime() - 86400000);
    out.push({ key: ymd(d).slice(0, 7), start: ymd(d) < from ? from : ymd(d), end: ymd(end) > to ? to : ymd(end) });
    d = next;
  }
  return out;
}

export class StopError extends Error {}

function httpGet(url: string, redirects = 3): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { "User-Agent": USER_AGENT, Accept: "text/html" }, timeout: 120000, ca: [...tls.rootCertificates, SECTIGO_DV_R36_PEM] /* site omits its intermediate */ }, res => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && redirects > 0) {
        res.resume(); resolve(httpGet(new URL(res.headers.location, url).toString(), redirects - 1)); return;
      }
      let body = ""; res.setEncoding("utf8"); res.on("data", c => (body += c)); res.on("end", () => resolve({ status: res.statusCode || 0, body }));
    });
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", reject);
  });
}

/** Polite fetch: retries with exponential backoff on timeouts/5xx; stops the run on 403/429/challenge pages. */
async function politeFetch(url: string): Promise<string> {
  for (let attempt = 1; ; attempt++) {
    try {
      const { status, body } = await fetchImpl(url);
      const low = body.slice(0, 20000).toLowerCase();
      if (status === 403 || status === 429) throw new StopError(`HTTP ${status} from ${url} — stopping as required (no retries, no workarounds).`);
      if (["just a moment...", "attention required", "cf-chl", "g-recaptcha", "h-captcha", "cf-turnstile"].some(m => low.includes(m))) throw new StopError(`Bot-protection/challenge page at ${url} — stopping.`);
      if (status >= 500) throw new Error(`HTTP ${status}`);
      if (status !== 200) throw new StopError(`Unexpected HTTP ${status} from ${url} — stopping.`);
      return body;
    } catch (err) {
      if (err instanceof StopError || attempt >= MAX_RETRIES) throw err;
      const wait = 2000 * 2 ** (attempt - 1);
      console.warn(`  retry ${attempt}/${MAX_RETRIES - 1} in ${wait / 1000}s: ${(err as Error).message}`);
      await sleep(wait);
    }
  }
}

/** Extracts the day-end archive table exactly as displayed (cell text unchanged). */
export function extractDayEndTable(html: string): { header: string[]; rows: string[][] } | null {
  const $ = cheerio.load(html);
  let found: { header: string[]; rows: string[][] } | null = null;
  $("table").each((_, t) => {
    const header = $(t).find("tr").first().find("th,td").map((__, c) => $(c).text().trim()).get();
    if (header.includes("DATE") && header.includes("TRADING CODE")) {
      const rows = $(t).find("tr").slice(1).map((__, tr) => [$(tr).find("td").map((___, c) => $(c).text().trim()).get()]).get() as string[][];
      found = { header, rows: rows.filter(r => r.length === header.length) };
      return false;
    }
  });
  return found;
}

/** Extracts "Market Summary of <date>" blocks: DSEX/DS30 closes and changes plus market totals. */
export function extractMarketSummaries(html: string) {
  const $ = cheerio.load(html);
  const out: Record<string, string>[] = [];
  $("table").each((_, t) => {
    const txt = $(t).text().replace(/\s+/g, " ").trim();
    const m = txt.match(/^Market Summary of ([A-Za-z]{3} \d{1,2}, \d{4})/);
    if (!m || txt.length > 2000) return;
    // Each label cell is followed by its value cell, e.g. <td>DSEX Index</td><td>5,482.36243</td>
    const cells = $(t).find("td,th").map((__, c) => $(c).text().replace(/\s+/g, " ").trim()).get();
    const get = (label: string) => {
      const i = cells.findIndex(c => c === label);
      return i >= 0 && i + 1 < cells.length && /^-?[\d,]+(\.\d+)?$/.test(cells[i + 1]) ? cells[i + 1] : "";
    };
    out.push({
      date: ymd(new Date(m[1] + " 00:00:00 UTC")),
      dsex: get("DSEX Index"), dsexChange: get("DSEX Index Change"),
      ds30: get("DS30 Index"), ds30Change: get("DS30 Index Change"),
      trades: get("Total Trade"), valueMn: get("Total Value Taka(mn)"), volume: get("Total Volume"), marketCapMn: get("Total Market Cap. Taka(mn)"),
    });
  });
  return out;
}

// ── phase A: fetch raw windows ───────────────────────────────────────────────────────────────────
interface WindowProgress { status: "done" | "empty"; complete: boolean; rows: number; tradingDays: number; summaryDays: number; fetchedAt: string; }
interface Progress { source: string; archive: string; windows: Record<string, WindowProgress>; }

export async function fetchWindows(from: string, to: string, maxWindows: number) {
  const progress = readJson<Progress>(PROGRESS_FILE, { source: SOURCE, archive: BASE, windows: {} });
  const all = monthWindows(from, to);
  // A month is only "complete" once it is entirely in the past; the current month is re-fetched each run
  const pending = all.filter(w => !progress.windows[w.key]?.complete);
  console.log(`windows ${all.length} | complete ${all.length - pending.length} | pending ${pending.length} | this run: up to ${maxWindows}`);
  fs.mkdirSync(RAW_DAYEND, { recursive: true }); fs.mkdirSync(RAW_SUMMARY, { recursive: true });
  let fetched = 0;
  for (const w of pending.slice(0, maxWindows)) {
    const t0 = Date.now();
    const dayEndUrl = `${BASE}/day_end_archive.php?startDate=${w.start}&endDate=${w.end}&inst=${encodeURIComponent("All Instrument")}&archive=data`;
    const table = extractDayEndTable(await politeFetch(dayEndUrl));
    if (!table) throw new StopError(`Day-end table not found for ${w.key} (page layout changed?) — stopping.`);
    // Raw table saved exactly as displayed, before any transformation
    fs.writeFileSync(path.join(RAW_DAYEND, `${w.key}.csv`), [table.header, ...table.rows].map(r => r.map(csvCell).join(",")).join("\n") + "\n");
    await sleep(delayMs);

    const summaryUrl = `${BASE}/market_summary.php?startDate=${w.start}&endDate=${w.end}&archive=data`;
    const summaries = extractMarketSummaries(await politeFetch(summaryUrl));
    const sumCols = ["date", "dsex", "dsexChange", "ds30", "ds30Change", "trades", "valueMn", "volume", "marketCapMn"];
    fs.writeFileSync(path.join(RAW_SUMMARY, `${w.key}.csv`), [sumCols.join(","), ...summaries.map(s => sumCols.map(c => csvCell(s[c] ?? "")).join(","))].join("\n") + "\n");

    const days = new Set(table.rows.map(r => r[1])).size;
    progress.windows[w.key] = {
      status: table.rows.length ? "done" : "empty", complete: w.end < to && w.end < dhakaToday(),
      rows: table.rows.length, tradingDays: days, summaryDays: summaries.length, fetchedAt: new Date().toISOString(),
    };
    writeJson(PROGRESS_FILE, progress); // saved after every window → resumable
    fetched++;
    console.log(`  ${w.key}: ${table.rows.length} rows, ${days} trading days, ${summaries.length} market summaries (${Math.round((Date.now() - t0) / 1000)}s)`);
    await sleep(delayMs);
  }
  const left = all.filter(w => !progress.windows[w.key]?.complete).length;
  // The current month never becomes "complete" until it ends, so it is excluded from the batch count
  const remaining = all.filter(w => !progress.windows[w.key]).length;
  console.log(`fetched ${fetched} window(s) this run; never-fetched windows left: ${remaining} → ${Math.ceil(remaining / maxWindows)} more run(s) of ${maxWindows} (the current month is refreshed on every run)`);
  return progress;
}

// ── phase B: load into data/history ──────────────────────────────────────────────────────────────
function loadWebsiteSymbols(): string[] {
  const data = readJson<{ symbols?: string[] }>(SYMBOLS_FILE, {});
  if (!data.symbols?.length) throw new Error(`Missing ${SYMBOLS_FILE} (list of the website's securities).`);
  return data.symbols;
}

export function loadIntoHistory() {
  const symbols = loadWebsiteSymbols();
  const wanted = new Set(symbols);
  const files = fs.existsSync(RAW_DAYEND) ? fs.readdirSync(RAW_DAYEND).filter(f => f.endsWith(".csv")).sort() : [];
  const bySymbol = new Map<string, Record<string, string>[]>();
  const tradedPerDay = new Map<string, number>();
  for (const f of files) {
    const lines = fs.readFileSync(path.join(RAW_DAYEND, f), "utf8").split(/\r?\n/).filter(Boolean);
    const header = parseCsvLine(lines[0]);
    for (const line of lines.slice(1)) {
      const cells = parseCsvLine(line); const rec: Record<string, string> = {};
      header.forEach((h, i) => (rec[h] = cells[i] ?? ""));
      const code = rec["TRADING CODE"].trim().toUpperCase();
      if (toNum(rec["TRADE"]) > 0) tradedPerDay.set(rec["DATE"], (tradedPerDay.get(rec["DATE"]) || 0) + 1);
      if (!wanted.has(code)) continue;
      if (!bySymbol.has(code)) bySymbol.set(code, []);
      bySymbol.get(code)!.push(rec);
    }
  }
  // A date is an official DSE session if at least 100 securities traded on it (covers Saturday make-up sessions)
  const officialDays = new Set([...tradedPerDay].filter(([, n]) => n >= 100).map(([d]) => d));

  const quarantine: Record<string, { date: string; reason: string; raw: Record<string, string> }[]> = {};
  const conflicts: MergeConflict[] = [];
  const discontinuities: ReturnType<typeof findDiscontinuities> = [];
  const coverage: Record<string, unknown> = {};
  fs.mkdirSync(path.join(HIST, "stocks"), { recursive: true });

  for (const sym of symbols) {
    const raw = bySymbol.get(sym) || [];
    const good: HistoryBar[] = [];
    for (const rec of raw) {
      const bar = {
        date: rec["DATE"], open: toNum(rec["OPENP*"]), high: toNum(rec["HIGH"]), low: toNum(rec["LOW"]),
        close: toNum(rec["CLOSEP*"]), volume: toNum(rec["VOLUME"]), source: SOURCE,
      } as HistoryBar;
      const reason = validateBar(bar, officialDays);
      if (reason) (quarantine[sym] ||= []).push({ date: bar.date, reason, raw: rec });
      else good.push(bar);
    }
    const file = stockHistoryPath(sym, ROOT);
    const existing = fs.existsSync(file) ? parseHistoryFile(fs.readFileSync(file, "utf8")) : [];
    const { merged, conflicts: c } = mergeBars(sym, existing, good);
    conflicts.push(...c);
    if (merged.length) fs.writeFileSync(file, serializeHistoryFile(merged));
    discontinuities.push(...findDiscontinuities(sym, merged));
    const first = merged[0]?.date ?? null, last = merged[merged.length - 1]?.date ?? null;
    const years = first && last ? (new Date(last).getTime() - new Date(first).getTime()) / (365.25 * 86400000) : 0;
    coverage[sym] = {
      file: path.relative(ROOT, file).replace(/\\/g, "/"), safeName: safeSymbolFileName(sym), rows: merged.length,
      firstDate: first, lastDate: last, years: Number(years.toFixed(2)),
      sources: merged.reduce((acc: Record<string, number>, b) => ((acc[b.source] = (acc[b.source] || 0) + 1), acc), {}),
      quarantined: quarantine[sym]?.length || 0,
    };
  }

  writeJson(path.join(ERRORS, "quarantined-rows.json"), { generatedAt: new Date().toISOString(), note: "Rows rejected by validation; never repaired.", bySymbol: quarantine });
  writeJson(path.join(PROCESSED, "conflicts.json"), { generatedAt: new Date().toISOString(), preference: ["DSE_OFFICIAL", "LankaBD", "InvestingCSV"], conflicts });
  writeJson(path.join(PROCESSED, "discontinuities.json"), {
    generatedAt: new Date().toISOString(),
    note: "Close-to-close moves > 20%. Prices are UNADJUSTED: dividends, bonus shares, rights and splits are not adjusted, so such moves can be corporate actions rather than market moves.",
    items: discontinuities,
  });
  writeJson(path.join(PROCESSED, "coverage-summary.json"), {
    generatedAt: new Date().toISOString(), source: SOURCE, archive: BASE, adjusted: false,
    officialSessionsInArchive: officialDays.size, symbols: coverage,
  });

  // Indices: DSEX and DS30 daily closes from the market-summary archive (DSES is not published there)
  const sumFiles = fs.existsSync(RAW_SUMMARY) ? fs.readdirSync(RAW_SUMMARY).filter(f => f.endsWith(".csv")).sort() : [];
  const idx: Record<"DSEX" | "DS30", Map<string, { close: number; change: number }>> = { DSEX: new Map(), DS30: new Map() };
  for (const f of sumFiles) {
    const lines = fs.readFileSync(path.join(RAW_SUMMARY, f), "utf8").split(/\r?\n/).filter(Boolean);
    const header = parseCsvLine(lines[0]);
    for (const line of lines.slice(1)) {
      const r: Record<string, string> = {}; parseCsvLine(line).forEach((v, i) => (r[header[i]] = v));
      for (const [k, col, chg] of [["DSEX", "dsex", "dsexChange"], ["DS30", "ds30", "ds30Change"]] as const) {
        const close = toNum(r[col]); if (close > 0 && /^\d{4}-\d{2}-\d{2}$/.test(r.date)) idx[k].set(r.date, { close, change: toNum(r[chg]) });
      }
    }
  }
  fs.mkdirSync(path.join(HIST, "indices"), { recursive: true });
  const indexRecords: { index_name: string; trading_date: string }[] = [];
  for (const k of ["DSEX", "DS30"] as const) {
    const rows = [...idx[k]].sort(([a], [b]) => a.localeCompare(b));
    fs.writeFileSync(path.join(HIST, "indices", `${k}.csv`), ["date,open,high,low,close,volume,source", ...rows.map(([d, v]) => `${d},,,,${v.close},,${SOURCE}`)].join("\n") + "\n");
    for (const [d, v] of rows) {
      const prev = v.close - v.change;
      indexRecords.push({ timestamp: `${d}T08:30:00.000Z`, index_name: k, index_value: v.close, change_value: v.change, change_percent: prev > 0 ? Number(((v.change / prev) * 100).toFixed(5)) : 0, trading_date: d, source: SOURCE } as { index_name: string; trading_date: string });
    }
  }
  if (indexRecords.length) {
    // Live values (e.g. DSES, which the archive does not publish, or today's session before the
    // archive has it) are kept; archive closes replace live values for the same index and day.
    const indexFile = path.join(ROOT, "data", "market_index_history.json");
    const official = new Set(indexRecords.map(r => `${r.index_name}|${r.trading_date}`));
    const live = readJson<{ index_name: string; trading_date: string; source?: string }[]>(indexFile, [])
      .filter(r => r.source === "LiveScraped" && !official.has(`${r.index_name}|${r.trading_date}`));
    const all = [...indexRecords, ...live].sort((a, b) => a.index_name.localeCompare(b.index_name) || a.trading_date.localeCompare(b.trading_date));
    writeJson(indexFile, all);
  }

  return { symbols: symbols.length, withData: Object.values(coverage).filter((c: any) => c.rows > 0).length, officialDays: officialDays.size, conflicts: conflicts.length, discontinuities: discontinuities.length, quarantined: Object.values(quarantine).reduce((a, v) => a + v.length, 0), dsexDays: idx.DSEX.size, ds30Days: idx.DS30.size };
}

// ── daily incremental update ─────────────────────────────────────────────────────────────────────
/** DSE trading ends at 14:30 Dhaka time; before this cut-off today's archive rows may be incomplete. */
export const SESSION_FINAL_AFTER_DHAKA = "15:30";

function dhakaClock(now: Date): { date: string; time: string; weekday: string } {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Dhaka", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23", weekday: "short",
  }).formatToParts(now).map(p => [p.type, p.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}`, weekday: parts.weekday };
}
export { dhakaClock };

const addDays = (date: string, n: number) => ymd(new Date(new Date(date + "T00:00:00Z").getTime() + n * 86400000));

/** Latest session date stored for any website security (suspended securities do not hold this back). */
export function latestStoredSession(): string | null {
  let latest: string | null = null;
  for (const sym of loadWebsiteSymbols()) {
    const file = stockHistoryPath(sym, ROOT);
    if (!fs.existsSync(file)) continue;
    const bars = parseHistoryFile(fs.readFileSync(file, "utf8"));
    const last = bars[bars.length - 1]?.date;
    if (last && (!latest || last > latest)) latest = last;
  }
  return latest;
}

function storedRowCount(): number {
  let n = 0;
  for (const sym of loadWebsiteSymbols()) {
    const file = stockHistoryPath(sym, ROOT);
    if (fs.existsSync(file)) n += parseHistoryFile(fs.readFileSync(file, "utf8")).length;
  }
  return n;
}

/** Replaces rows for the given dates in a monthly raw file and appends the new ones (raw cells unchanged). */
function mergeRawMonth(file: string, header: string[], rows: string[][], dateCol: number) {
  const dates = new Set(rows.map(r => r[dateCol]));
  let kept: string[][] = [];
  if (fs.existsSync(file)) {
    const lines = fs.readFileSync(file, "utf8").split(/\r?\n/).filter(Boolean);
    const existingHeader = parseCsvLine(lines[0]);
    if (existingHeader.join("|") !== header.join("|")) {
      throw new StopError(`Archive columns changed (${header.join(", ")}) and no longer match ${path.basename(file)} — stopping.`);
    }
    kept = lines.slice(1).map(parseCsvLine).filter(r => !dates.has(r[dateCol]));
  }
  fs.writeFileSync(file, [header, ...kept, ...rows].map(r => r.map(csvCell).join(",")).join("\n") + "\n");
}

export interface IncrementalResult {
  status: "updated" | "no-new-session" | "up-to-date";
  from: string | null;
  to: string | null;
  sessions: string[];
  rowsFetched: number;
  rowsAdded: number;
  load?: ReturnType<typeof loadIntoHistory>;
}

/**
 * Fetches only the sessions after the latest stored date (up to today once the session is final,
 * otherwise up to yesterday), saves them into the monthly raw files, then reloads data/history with
 * the same validation as the backfill. Existing rows are never rewritten by this step.
 */
export async function updateIncremental(now = new Date()): Promise<IncrementalResult> {
  const last = latestStoredSession();
  if (!last) throw new Error("No stored history yet. Run npm run backfill:history first.");
  const clock = dhakaClock(now);
  const to = clock.time >= SESSION_FINAL_AFTER_DHAKA ? clock.date : addDays(clock.date, -1);
  const from = addDays(last, 1);
  if (from > to) return { status: "up-to-date", from: null, to: null, sessions: [], rowsFetched: 0, rowsAdded: 0 };

  const dayEndUrl = `${BASE}/day_end_archive.php?startDate=${from}&endDate=${to}&inst=${encodeURIComponent("All Instrument")}&archive=data`;
  const table = extractDayEndTable(await politeFetch(dayEndUrl));
  if (!table) throw new StopError(`Day-end table not found for ${from}..${to} (page layout changed?) — stopping.`);
  const dateCol = table.header.indexOf("DATE");
  // The archive should only return the requested dates; anything else is ignored rather than trusted
  const rows = table.rows.filter(r => r[dateCol] >= from && r[dateCol] <= to);
  if (!rows.length) return { status: "no-new-session", from, to, sessions: [], rowsFetched: 0, rowsAdded: 0 };
  await sleep(delayMs);

  const summaryUrl = `${BASE}/market_summary.php?startDate=${from}&endDate=${to}&archive=data`;
  const summaries = extractMarketSummaries(await politeFetch(summaryUrl)).filter(s => s.date >= from && s.date <= to);
  const sumCols = ["date", "dsex", "dsexChange", "ds30", "ds30Change", "trades", "valueMn", "volume", "marketCapMn"];

  fs.mkdirSync(RAW_DAYEND, { recursive: true }); fs.mkdirSync(RAW_SUMMARY, { recursive: true });
  for (const month of new Set(rows.map(r => r[dateCol].slice(0, 7)))) {
    mergeRawMonth(path.join(RAW_DAYEND, `${month}.csv`), table.header, rows.filter(r => r[dateCol].startsWith(month)), dateCol);
    const monthSummaries = summaries.filter(s => s.date.startsWith(month)).map(s => sumCols.map(c => s[c] ?? ""));
    if (monthSummaries.length) mergeRawMonth(path.join(RAW_SUMMARY, `${month}.csv`), sumCols, monthSummaries, 0);
  }

  const before = storedRowCount();
  const load = loadIntoHistory();
  const rowsAdded = storedRowCount() - before;
  const sessions = [...new Set(rows.map(r => r[dateCol]))].sort();
  return { status: "updated", from, to, sessions, rowsFetched: rows.length, rowsAdded, load };
}
