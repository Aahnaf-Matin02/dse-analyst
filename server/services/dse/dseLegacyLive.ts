import https from "https";
import * as cheerio from "cheerio";
import { DseLiveMarket, DseLivePriceRow } from "./dseLiveApi";

/**
 * Live prices and indices from old.dsebd.org, the legacy DSE site that DSE still serves (no
 * robots.txt restrictions; it also hosts the day-end archive used for history). www.dse.com.bd
 * now refuses automated access ("automated access to this site is not permitted"), so the app
 * reads the legacy pages instead and identifies itself honestly.
 * Returns the same shapes as dseLiveApi so the scraper can use either.
 */
export const LEGACY_BASE = "https://old.dsebd.org";
const USER_AGENT = "DSE-AI-Analyst/1.0 (educational project; live prices)";

function get(path: string): Promise<{ status: number; body: string; url: string }> {
  const url = LEGACY_BASE + path;
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { "User-Agent": USER_AGENT, Accept: "text/html" }, timeout: 20000 }, res => {
      let body = ""; res.setEncoding("utf8");
      res.on("data", c => (body += c));
      res.on("end", () => resolve({ status: res.statusCode || 0, body, url }));
    });
    req.on("timeout", () => req.destroy(new Error(`timeout fetching ${url}`)));
    req.on("error", reject);
  });
}

const num = (s: string | undefined): number | null => {
  const v = Number(String(s ?? "").replace(/,/g, "").replace("%", "").trim());
  return s !== undefined && String(s).trim() !== "" && Number.isFinite(v) ? v : null;
};

/** "Latest Share Price by Trade Code" table: #, TRADING CODE, LTP*, HIGH, LOW, CLOSEP*, YCP*, CHANGE, TRADE, VALUE (mn), VOLUME */
export function parseLegacyPrices(html: string): DseLivePriceRow[] {
  const $ = cheerio.load(html);
  const rows: DseLivePriceRow[] = [];
  $("table").each((_, t) => {
    const header = $(t).find("tr").first().find("th,td").map((__, c) => $(c).text().trim().toUpperCase()).get();
    const col = (name: string) => header.findIndex(h => h.replace(/\*/g, "") === name);
    if (col("TRADING CODE") < 0 || col("LTP") < 0) return;
    $(t).find("tr").slice(1).each((__, tr) => {
      const c = $(tr).find("td").map((___, td) => $(td).text().trim()).get();
      const code = (c[col("TRADING CODE")] || "").toUpperCase();
      if (!code) return;
      rows.push({
        code, ltp: num(c[col("LTP")]) ?? 0, ycp: num(c[col("YCP")]), open: null,
        high: num(c[col("HIGH")]), low: num(c[col("LOW")]), close: num(c[col("CLOSEP")]),
        volume: num(c[col("VOLUME")]) ?? 0, valueMn: num(c[col("VALUE (MN)")]) ?? 0, trades: num(c[col("TRADE")]) ?? 0,
        percent: null, category: null, board: null, sector: null, assetType: null,
      });
    });
    return false;
  });
  return rows;
}

/** Home page "Last update on <tradeTime>" block: DSEX/DSES/DS30, totals, breadth and market status. */
export function parseLegacyMarket(html: string): DseLiveMarket {
  // A space at every tag boundary: the page splits labels and numbers across elements
  const text = cheerio.load(html.replace(/</g, " <")).root().text().replace(/\s+/g, " ");
  const at = text.indexOf("Last update on");
  const block = at >= 0 ? text.slice(at, at + 1200) : "";
  const tradeTime = block.match(/^Last update on (\w{3} \d{1,2}, \d{4} at \d{1,2}:\d{2} [AP]M)/)?.[1];
  const index = (label: string) => {
    const m = block.match(new RegExp(`${label} ?Index (-?[\\d,.]+) (-?[\\d,.]+) (-?[\\d,.]+) ?%`));
    if (!m) return undefined;
    const value = num(m[1]), change = num(m[2]), pct = num(m[3]);
    return value && value > 0 ? { value, change: change ?? 0, changePercent: pct ?? 0, prev: change !== null ? Math.round((value - change) * 1e5) / 1e5 : null } : undefined;
  };
  const totals = block.match(/Total Value in Taka \(mn\) ([\d,]+) ([\d,]+) ([\d,.]+)/);
  const breadth = block.match(/Issues Unchanged (\d+) (\d+) (\d+)/);
  const status = text.match(/Market Status: (Open|Closed|Pre-?Open\w*|Halt\w*)/i)?.[1] ?? "unknown";
  return {
    indices: { DSEX: index("DSE ?X"), DSES: index("DSE ?S"), DS30: index("DS30") },
    totals: totals ? { trades: num(totals[1]) ?? undefined, volume: num(totals[2]) ?? undefined, turnover: num(totals[3]) ?? undefined, tradeTime } : (tradeTime ? { tradeTime } : undefined),
    breadth: breadth ? { advanced: Number(breadth[1]), declined: Number(breadth[2]), unchanged: Number(breadth[3]), traded: Number(breadth[1]) + Number(breadth[2]) + Number(breadth[3]) } : undefined,
    session: { isOpen: /^open$/i.test(status), phase: status.toLowerCase(), sessionDate: null },
  };
}

/** One retry after 1.5 s for server errors and network failures (the legacy site returns occasional 500s); 4xx is final. */
async function fetchOk(path: string, retries = 1): Promise<{ status: number; body: string; url: string }> {
  try {
    const res = await get(path);
    if (res.status === 200 && res.body) return res;
    if (res.status < 500 || retries <= 0) throw Object.assign(new Error(`old.dsebd.org${path} returned HTTP ${res.status}`), { final: true });
  } catch (err) {
    if ((err as any).final || retries <= 0) throw err;
  }
  await new Promise(r => setTimeout(r, 1500));
  return fetchOk(path, retries - 1);
}

export async function fetchLegacyPrices() {
  const res = await fetchOk("/latest_share_price_scroll_l.php");
  const rows = parseLegacyPrices(res.body);
  if (!rows.length) throw new Error("old.dsebd.org price table not found (page layout changed?)");
  return { rows, session: { isOpen: false, phase: "unknown", sessionDate: null }, url: res.url };
}

export async function fetchLegacyMarket() {
  const res = await fetchOk("/");
  return { ...parseLegacyMarket(res.body), url: res.url };
}
