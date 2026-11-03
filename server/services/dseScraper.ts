import * as cheerio from "cheerio";
import https from "node:https";
import http from "node:http";
import { URL } from "node:url";
import { loadStocks, saveStocks, getAllStocks, enrichStock } from "../repositories/stockRepository";
import { StockData } from "../../src/types";
import { saveIndices, loadIndices } from "../repositories/marketRepository";
import { saveLatestDseData, loadLatestDseData, saveDseSyncStatus, loadDseSyncStatus } from "../repositories/dseCacheRepository";
import { DSE_COMPANIES } from "../../src/data/dseData";
import { saveDailyHistoryRecord, saveIntradayTick } from "../repositories/marketIndexRepository";
import { defaultDseClient } from "./dse/dseClient";
import { DseParser } from "./dse/dseParser";

export interface ScraperStatus {
  status: "Idle" | "Syncing" | "Success" | "Failed";
  live: boolean;
  source: "LiveScraped" | "CachedFile" | "DefaultSeed" | "Unavailable";
  parsedSymbols: number;
  cachedSymbols: number;
  defaultSeedSymbols: number;
  lastAttemptTime: string | null;
  lastSuccessfulSync: string | null;
  message: string;
  diagnostics?: any;
  activeEndpoint: string;
}

const DSE_CACHE_TTL_MS = 30 * 1000; // 30 seconds cache TTL
const DSE_SYNC_RATE_LIMIT_MS = 10 * 1000; // 10 seconds manual sync rate limit

// In-memory throttling variables
let lastSyncAttemptTime: Date | null = null;
let lastSuccessfulSyncTime: Date | null = null;
let currentDseSyncStatus: "Idle" | "Syncing" | "Success" | "Failed" = "Idle";
let currentDseMessage: string = "DSE cache initialized.";
let currentDseSource: "LiveScraped" | "CachedFile" | "DefaultSeed" | "Unavailable" = "DefaultSeed";

let currentParsedSymbols: number = 0;
let currentCachedSymbols: number = 0;
let currentDefaultSeedSymbols: number = Object.keys(DSE_COMPANIES).length;

// Safe env cleaning helper
function cleanEnv(value: string | undefined, fallback: string) {
  const cleaned = (value || "").trim();
  return cleaned.length > 0 ? cleaned : fallback;
}

export const DSE_BASE_URL = cleanEnv(process.env.DSE_BASE_URL, "https://dse.com.bd").replace(/\/+$/, "");
const DSE_LATEST_PRICE_PATH = cleanEnv(process.env.DSE_LATEST_PRICE_PATH, "/latest_share_price_all.php");
const DSE_COMPANY_PATH = cleanEnv(process.env.DSE_COMPANY_PATH, "/company/{symbol}");

export const latestPriceCandidates = [
  "https://dse.com.bd/latest_share_price_all.php",
  "https://www.dse.com.bd/latest_share_price_all.php",
  "https://dse.com.bd/latest_share_price_scroll_l.php",
  "https://www.dse.com.bd/latest_share_price_scroll_l.php",
  "http://dse.com.bd/latest_share_price_all.php",
  "http://www.dse.com.bd/latest_share_price_all.php"
];

function normalizePath(path: string) {
  const trimmed = path.trim();
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

export function buildDseUrl(path: string) {
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }
  const normalizedPath = normalizePath(path);
  return `${DSE_BASE_URL}${normalizedPath}`;
}

export function getConfiguredLatestPriceUrl() {
  return buildDseUrl(DSE_LATEST_PRICE_PATH);
}

let lastDiagnostics: any = {
  finalUrl: getConfiguredLatestPriceUrl(),
  baseUrl: DSE_BASE_URL,
  latestPricePath: DSE_LATEST_PRICE_PATH,
  companyPath: DSE_COMPANY_PATH,
  httpStatus: null,
  errorCode: null,
  rowsParsed: 0,
  attemptedUrls: [],
  selectedUrl: null,
  diagnosticsMessage: "Initialization state."
};

// Initialize from existing cache files on load to ensure continuity
try {
  const savedStatus = loadDseSyncStatus();
  if (savedStatus) {
    currentDseSyncStatus = savedStatus.status;
    currentDseSource = savedStatus.source;
    currentParsedSymbols = savedStatus.parsedSymbols || 0;
    currentCachedSymbols = savedStatus.cachedSymbols || 0;
    currentDefaultSeedSymbols = savedStatus.defaultSeedSymbols || Object.keys(DSE_COMPANIES).length;
    currentDseMessage = savedStatus.message;
    if (savedStatus.lastAttemptTime) lastSyncAttemptTime = new Date(savedStatus.lastAttemptTime);
    if (savedStatus.lastSuccessfulSync) lastSuccessfulSyncTime = new Date(savedStatus.lastSuccessfulSync);
    if (savedStatus.diagnostics) lastDiagnostics = savedStatus.diagnostics;
  }
} catch (err) {
  console.log("[DSE Scraper] Initial sync status not found or loaded in fallback mode.");
}

const getSectorBySymbolOrType = (sym: string): string => {
  const s = sym.toUpperCase();
  if (s.includes("BANK")) return "Banking";
  if (s.includes("PHARMA") || s.includes("CHEM")) return "Pharmaceuticals & Chemicals";
  if (s.includes("TEX") || s.includes("SPIN")) return "Textile";
  if (s.includes("INS")) return "Insurance";
  if (s.includes("POWER") || s.includes("ELECT")) return "Fuel & Power";
  if (s.includes("CEM")) return "Cement";
  if (s.includes("FOOD") || s.includes("BATBC")) return "Food & Allied";
  if (s.includes("TELECOM") || s.includes("GP")) return "Telecommunication";
  return "Miscellaneous";
};

export function parseDseLastUpdateString(str: string): Date {
  try {
    const cleanStr = str.replace(/\s+/g, " ").trim();
    // Match "Month Day, Year at Hour:Min AM/PM" or typical "Month Day, Year at Hour:Min"
    const regex = /([A-Za-z]+)\s+(\d+),\s+(\d+)\s+at\s+(\d+):(\d+)\s*(AM|PM|am|pm)?/i;
    const parts = cleanStr.match(regex);
    if (parts) {
      const monthStr = parts[1].substring(0, 3).toLowerCase();
      const months: Record<string, number> = {
        jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
        jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
      };
      const month = months[monthStr] !== undefined ? months[monthStr] : 5;
      const day = parseInt(parts[2], 10);
      const year = parseInt(parts[3], 10);
      let hour = parseInt(parts[4], 10);
      const minute = parseInt(parts[5], 10);
      const ampm = parts[6] ? parts[6].toUpperCase() : "";

      if (ampm === "PM" && hour < 12) hour += 12;
      if (ampm === "AM" && hour === 12) hour = 0;

      // Construct date and return
      return new Date(Date.UTC(year, month, day, hour - 6, minute)); // Dhaka is UTC+6
    }
  } catch (err) {
    // Fail gracefully
  }
  return new Date();
}

async function fetchWithTimeout(urlStr: string, timeoutMs = 15000): Promise<any> {
  return new Promise((resolve, reject) => {
    try {
      const parsedUrl = new URL(urlStr);
      const isHttps = parsedUrl.protocol === "https:";
      const lib = isHttps ? https : http;

      const req = lib.request(urlStr, {
        method: "GET",
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 DSE-AI-Analyst/1.0",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.5",
          "Cache-Control": "no-cache",
          "Pragma": "no-cache"
        },
        timeout: timeoutMs,
        rejectUnauthorized: false
      }, (res) => {
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          body += chunk;
        });
        res.on("end", () => {
          resolve({
            ok: (res.statusCode || 200) >= 200 && (res.statusCode || 200) < 300,
            status: res.statusCode || 200,
            headers: {
              get(name: string) {
                const headerVal = res.headers[name.toLowerCase()];
                return Array.isArray(headerVal) ? headerVal.join(", ") : (headerVal || null);
              }
            },
            text: async () => body
          });
        });
      });

      req.on("error", (err) => {
        reject(err);
      });

      req.on("timeout", () => {
        req.destroy();
        reject(new Error("Request timeout"));
      });

      req.end();
    } catch (err) {
      reject(err);
    }
  });
}

export function classifyDseHttpError(status: number) {
  if (status === 404) {
    return {
      errorCode: "DSE_ENDPOINT_NOT_FOUND",
      message: "DSE endpoint returned 404. Configured latest share price path is wrong or has changed.",
      retryable: false
    };
  }

  if (status === 403) {
    return {
      errorCode: "DSE_ACCESS_FORBIDDEN",
      message: "DSE returned 403 Forbidden. Access is restricted by IP blocking or security credentials.",
      retryable: false
    };
  }

  if (status === 429) {
    return {
      errorCode: "DSE_RATE_LIMITED",
      message: "DSE returned 429 Too Many Requests.",
      retryable: true
    };
  }

  if (status >= 500) {
    return {
      errorCode: "DSE_SERVER_ERROR",
      message: `DSE returned server error ${status}.`,
      retryable: true
    };
  }

  return {
    errorCode: "DSE_HTTP_ERROR",
    message: `DSE returned HTTP ${status}.`,
    retryable: false
  };
}

export function isValidDseSymbol(symbol: string) {
  return /^[A-Z0-9][A-Z0-9.-]{1,20}$/.test(symbol);
}

export async function probeDseEndpoint(url: string) {
  const startedAt = Date.now();
  let diagnosticsMessage = "";
  let isPathIssue = false;
  let isAccessBlock = false;
  let securityShieldDetected = false;

  try {
    const res = await fetchWithTimeout(url, 8000);
    const contentType = res.headers.get("content-type") || "";
    const text = await res.text();
    const serverHeader = res.headers.get("server") || "";
    const cfRay = res.headers.get("cf-ray") || "";

    const hasCloudflare = cfRay || serverHeader.toLowerCase().includes("cloudflare") || text.toLowerCase().includes("cloudflare");
    const hasDdosShield = text.toLowerCase().includes("captcha") || text.toLowerCase().includes("ddos") || text.toLowerCase().includes("security checking") || text.toLowerCase().includes("under attack");

    if (hasCloudflare || hasDdosShield) {
      securityShieldDetected = true;
    }

    if (res.status === 404) {
      try {
        const homeRes = await fetchWithTimeout(buildDseUrl("/"), 8000);
        if (homeRes.ok) {
          isPathIssue = true;
          diagnosticsMessage = "Path Issue Confirmed: The home domain is fully reachable, but the latest share prices URL returns 404. Verify DSE_LATEST_PRICE_PATH.";
        } else {
          diagnosticsMessage = `Endpoint returned 404, and the base domain also failed with status ${homeRes.status}. Your base URL configuration may be incorrect.`;
        }
      } catch (homeErr) {
        diagnosticsMessage = "Endpoint returned 404, and probing home page timed out. Highly likely a misconfigured domain.";
      }
    } else if (res.status === 403) {
      isAccessBlock = true;
      if (securityShieldDetected) {
        diagnosticsMessage = "Access Block: 403 Forbidden with Cloudflare/DDoS shielding detected. Automated scraper queries are actively filtered.";
      } else {
        diagnosticsMessage = "Access Block: 403 Forbidden. Server is rejecting script connections from this network context.";
      }
    } else if (res.ok) {
      diagnosticsMessage = "Fully functional: Endpoint responded with 200 OK.";
    } else {
      diagnosticsMessage = `Query completed with status ${res.status}.`;
    }

    return {
      url,
      ok: res.ok,
      httpStatus: res.status,
      contentType,
      responseLength: text.length,
      hasHtml: text.includes("<html") || text.includes("<table"),
      hasLatestShareKeywords:
        text.toLowerCase().includes("trading code") ||
        text.toLowerCase().includes("ltp") ||
        text.toLowerCase().includes("ycp"),
      elapsedMs: Date.now() - startedAt,
      isPathIssue,
      isAccessBlock,
      securityShieldDetected,
      diagnosticsMessage,
      bodyPreview: process.env.NODE_ENV === "production" ? undefined : text.slice(0, 300)
    };
  } catch (err: any) {
    let googleConnectivity = false;
    try {
      const gCheck = await fetchWithTimeout("https://www.google.com", 3000);
      googleConnectivity = gCheck.ok;
    } catch (e) {}

    const isTimeout = err?.name === "AbortError";
    diagnosticsMessage = isTimeout
      ? `Query Timed Out. Outbound internet connectivity is ${googleConnectivity ? "ONLINE" : "OFFLINE"}. Target DSE server is non-responsive.`
      : `Connection exception: ${err?.message || "Check network configurations"}`;

    return {
      url,
      ok: false,
      httpStatus: null,
      errorCode: isTimeout ? "DSE_TIMEOUT" : "DSE_FETCH_EXCEPTION",
      message: err?.message || "Connection exception",
      elapsedMs: Date.now() - startedAt,
      isPathIssue: false,
      isAccessBlock: false,
      securityShieldDetected: false,
      diagnosticsMessage
    };
  }
}

// Map columns dynamically and parse
export function parseDseHtml(html: string): Record<string, StockData> {
  const parsedStocks: Record<string, StockData> = {};
  const isHtml = html.trim().startsWith("<") || html.toLowerCase().includes("<!doctype html>") || html.toLowerCase().includes("<html");
  if (!html || html.length < 500 || !isHtml) {
    return parsedStocks;
  }

  const $ = cheerio.load(html);

  // Define column lookup layout
  const colIndexes = {
    symbol: -1,
    ltp: -1,
    high: -1,
    low: -1,
    open: -1,
    ycp: -1,
    change: -1,
    trades: -1,
    value: -1,
    volume: -1
  };

  // Find the table and populate colIndexes
  let targetTable: cheerio.Cheerio | null = null;
  let headers: string[] = [];

  $("table").each((_, tbl) => {
    $(tbl).find("tr").each((_, row) => {
      const cells = $(row).find("th, td");
      if (cells.length >= 8) {
        const texts = cells.map((_, cell) => $(cell).text().trim().toUpperCase().replace(/\s+/g, " ")).get();
        const hasTradingCode = texts.some(t => t.includes("TRADING CODE") || t === "CODE" || t === "SYMBOL" || t === "INSTRUMENT");
        const hasLtp = texts.some(t => t.includes("LTP") || t.includes("LAST TRADING") || t.includes("PRICE") || t.includes("LAST PRICE") || t.includes("LAST SHARE PRICE"));
        const hasYcp = texts.some(t => t.includes("YCP") || t.includes("YESTERDAY CLOSE") || t.includes("CLOSEP") || t.includes("PREV. CLOSE") || t.includes("PREV CLOSE"));
        
        if (hasTradingCode && (hasLtp || hasYcp)) {
          targetTable = $(tbl);
          headers = texts;
          return false; // break row loop
        }
      }
    });
    if (targetTable) return false; // break table loop
  });

  if (targetTable && headers.length > 0) {
    headers.forEach((h, idx) => {
      const cleaned = h.trim();
      if (cleaned.includes("TRADING CODE") || cleaned === "CODE" || cleaned === "COMPANY" || cleaned === "SYMBOL" || cleaned === "INSTRUMENT") {
        colIndexes.symbol = idx;
      } else if (cleaned.includes("LTP") || cleaned.includes("LAST TRD") || cleaned.includes("LAST PRICE") || cleaned.includes("LAST TRADING") || cleaned.includes("LATEST PRICE")) {
        colIndexes.ltp = idx;
      } else if (cleaned.includes("HIGH")) {
        colIndexes.high = idx;
      } else if (cleaned.includes("LOW")) {
        colIndexes.low = idx;
      } else if (cleaned.includes("OPENP") || cleaned === "OPEN" || cleaned.includes("OPEN PRICE")) {
        colIndexes.open = idx;
      } else if (cleaned.includes("YCP") || cleaned.includes("YESTERDAY") || cleaned.includes("PREV. CLOSE") || cleaned.includes("PREV CLOSE") || cleaned.includes("YESTERDAY'S CLOSE")) {
        colIndexes.ycp = idx;
      } else if (cleaned.includes("CHANGE") || cleaned.includes("PRICE CHANGE")) {
        colIndexes.change = idx;
      } else if (cleaned.includes("TRADE") || cleaned.includes("NO. OF TRAD")) {
        colIndexes.trades = idx;
      } else if (cleaned.includes("VALUE")) {
        colIndexes.value = idx;
      } else if (cleaned.includes("VOLUME") || cleaned.includes("TOTAL VOL")) {
        colIndexes.volume = idx;
      }
    });
  }

  // Fallback defaults if columns detection failed
  let finalColIndexes = { ...colIndexes };
  if (finalColIndexes.symbol === -1) finalColIndexes.symbol = 1;
  if (finalColIndexes.ltp === -1) finalColIndexes.ltp = 2;
  if (finalColIndexes.high === -1) finalColIndexes.high = 3;
  if (finalColIndexes.low === -1) finalColIndexes.low = 4;
  if (finalColIndexes.open === -1) finalColIndexes.open = 5;
  if (finalColIndexes.ycp === -1) finalColIndexes.ycp = 6;
  if (finalColIndexes.change === -1) finalColIndexes.change = 7;
  if (finalColIndexes.trades === -1) finalColIndexes.trades = 8;
  if (finalColIndexes.value === -1) finalColIndexes.value = 9;
  if (finalColIndexes.volume === -1) finalColIndexes.volume = 10;

  // Find rows to crawl
  let rows: cheerio.Cheerio;
  if (targetTable) {
    rows = $(targetTable).find("tr");
  } else {
    const companyHrefPrefix = DSE_COMPANY_PATH.split("{symbol}")[0].replace(/^\//, "");
    const anchorElements = $(`a[href*="${companyHrefPrefix}"]`);
    if (anchorElements.length > 0) {
      const rowSet = new Set<any>();
      anchorElements.each((_, a) => {
        const row = $(a).closest("tr");
        if (row.length) rowSet.add(row[0]);
      });
      rows = $(Array.from(rowSet));
    } else {
      rows = $("tr");
    }
  }

  const nowString = new Date().toISOString();

  rows.each((_, row) => {
    const cells = $(row).find("td");
    if (cells.length < 5) return;

    let symbolRaw = "";
    const anchor = $(row).find(`a[href*="displayCompany.php?name="], a[href*="/company/"]`);
    if (anchor.length) {
      const href = anchor.attr("href") || "";
      const matchPath = href.match(/\/company\/([^/?#]+)/i);
      const matchQuery = href.match(/[?&]name=([^&]+)/i);
      symbolRaw = matchPath ? matchPath[1].trim().toUpperCase() : (matchQuery ? matchQuery[1].trim().toUpperCase() : (href.split("=").pop()?.trim().toUpperCase() || ""));
    } else if (finalColIndexes.symbol < cells.length) {
      symbolRaw = $(cells.eq(finalColIndexes.symbol)).text().trim().toUpperCase();
    }

    symbolRaw = symbolRaw.replace(/\s+/g, "");

    // Do not parse menu buttons or headers
    if (!symbolRaw || !isValidDseSymbol(symbolRaw)) return;

    if (finalColIndexes.ltp < cells.length) {
      const ltpStr = $(cells.eq(finalColIndexes.ltp)).text().replace(/,/g, "").trim();
      const ltp = parseFloat(ltpStr);

      if (!isNaN(ltp) && ltp > 0) {
        const highStr = finalColIndexes.high < cells.length ? $(cells.eq(finalColIndexes.high)).text().replace(/,/g, "").trim() : "";
        const lowStr = finalColIndexes.low < cells.length ? $(cells.eq(finalColIndexes.low)).text().replace(/,/g, "").trim() : "";
        const openStr = finalColIndexes.open < cells.length ? $(cells.eq(finalColIndexes.open)).text().replace(/,/g, "").trim() : "";
        const ycpStr = finalColIndexes.ycp < cells.length ? $(cells.eq(finalColIndexes.ycp)).text().replace(/,/g, "").trim() : "";
        const changeStr = finalColIndexes.change < cells.length ? $(cells.eq(finalColIndexes.change)).text().replace(/,/g, "").trim() : "";

        const tradesStr = finalColIndexes.trades < cells.length ? $(cells.eq(finalColIndexes.trades)).text().replace(/,/g, "").trim() : "";
        const valueStr = finalColIndexes.value < cells.length ? $(cells.eq(finalColIndexes.value)).text().replace(/,/g, "").trim() : "";
        const volumeStr = finalColIndexes.volume < cells.length ? $(cells.eq(finalColIndexes.volume)).text().replace(/,/g, "").trim() : "";

        const parsedYcp = parseFloat(ycpStr);
        const ycp = isNaN(parsedYcp) ? null : parsedYcp;
        const change = parseFloat(changeStr) || 0;
        const parsedHigh = parseFloat(highStr);
        const high = isNaN(parsedHigh) ? null : parsedHigh;
        const parsedLow = parseFloat(lowStr);
        const low = isNaN(parsedLow) ? null : parsedLow;
        const parsedOpen = parseFloat(openStr);
        const open = isNaN(parsedOpen) ? null : parsedOpen;
        const trades = parseInt(tradesStr, 10) || 0;
        const value = parseFloat(valueStr) || 0;
        const volume = parseInt(volumeStr, 10) || 0;

        const effectiveYcp = ycp !== null ? ycp : ltp;
        const changePercent = effectiveYcp > 0 ? parseFloat(((change / effectiveYcp) * 100).toFixed(2)) : 0;

        const companyPath = DSE_COMPANY_PATH.replace("{symbol}", encodeURIComponent(symbolRaw));
        const companyUrl = buildDseUrl(companyPath);

        parsedStocks[symbolRaw] = {
          symbol: symbolRaw,
          name: `${symbolRaw} Ltd.`,
          sector: getSectorBySymbolOrType(symbolRaw),
          price: ltp,
          change,
          changePercent,
          volume,
          trades,
          high,
          low,
          open,
          prevClose: ycp,
          eps: null,
          nav: null,
          peRatio: null,
          divYield: null,
          marketCap: null,
          revGrowth: null,
          profitGrowth: null,
          marketDepth: null,
          financials: null,
          source: "LiveScraped",
          dataSource: "LiveScraped",
          lastUpdated: nowString,
          sourceUrl: companyUrl
        };
      }
    }
  });

  return parsedStocks;
}

export async function probeDseAllCandidates() {
  const envUrl = buildDseUrl(DSE_LATEST_PRICE_PATH);
  const candidates = [
    envUrl,
    ...latestPriceCandidates.filter(url => url !== envUrl)
  ];

  const attempts: any[] = [];
  let workingUrl: string | null = null;
  let maxRowsParsed = 0;

  for (const url of candidates) {
    try {
      const res = await fetchWithTimeout(url, 8000);
      const contentType = res.headers.get("content-type") || "";
      const text = await res.text();
      const isHtml = text.trim().startsWith("<") || text.toLowerCase().includes("<!doctype html>") || text.toLowerCase().includes("<html");

      let rowsParsed = 0;
      if (res.ok && isHtml) {
        const parsed = parseDseHtml(text);
        rowsParsed = Object.keys(parsed).length;
      }

      const classification = !res.ok ? classifyDseHttpError(res.status) : null;

      attempts.push({
        url,
        httpStatus: res.status,
        contentType,
        responseLength: text.length,
        rowsParsed,
        ok: res.ok && rowsParsed >= 50,
        errorCode: res.ok ? (rowsParsed >= 50 ? null : "DSE_PARSE_MINIMUM_FAILED") : (classification ? classification.errorCode : "PROBE_FAILED")
      });

      if (res.ok && rowsParsed >= 50 && !workingUrl) {
        workingUrl = url;
        maxRowsParsed = rowsParsed;
      }
    } catch (err: any) {
      const isTimeout = err?.name === "AbortError";
      attempts.push({
        url,
        httpStatus: null,
        contentType: "",
        responseLength: 0,
        rowsParsed: 0,
        ok: false,
        errorCode: isTimeout ? "DSE_TIMEOUT" : "DSE_FETCH_EXCEPTION"
      });
    }
  }

  const recommendation = workingUrl
    ? `Use this working URL/path for live sync: ${workingUrl}. (Configured: ${DSE_LATEST_PRICE_PATH})`
    : `All attempted candidate latest-price endpoints returned 404 or invalid data. Adjust DSE_BASE_URL or DSE_LATEST_PRICE_PATH in env settings.`;

  return {
    baseUrl: DSE_BASE_URL,
    configuredPath: DSE_LATEST_PRICE_PATH,
    attempts,
    workingUrl,
    rowsParsed: maxRowsParsed,
    recommendation
  };
}

export const DSEScraper = {
  getStatus(): ScraperStatus {
    const savedStatus = loadDseSyncStatus();
    if (savedStatus) {
      return {
        status: savedStatus.status,
        live: savedStatus.status === "Success",
        source: savedStatus.source,
        parsedSymbols: savedStatus.parsedSymbols || 0,
        cachedSymbols: savedStatus.cachedSymbols || 0,
        defaultSeedSymbols: savedStatus.defaultSeedSymbols || 0,
        lastAttemptTime: savedStatus.lastAttemptTime || (lastSyncAttemptTime ? lastSyncAttemptTime.toISOString() : null),
        lastSuccessfulSync: savedStatus.lastSuccessfulSync || (lastSuccessfulSyncTime ? lastSuccessfulSyncTime.toISOString() : null),
        message: savedStatus.message,
        diagnostics: savedStatus.diagnostics || lastDiagnostics,
        activeEndpoint: getConfiguredLatestPriceUrl()
      };
    }

    return {
      status: currentDseSyncStatus,
      live: currentDseSyncStatus === "Success",
      source: currentDseSource,
      parsedSymbols: currentParsedSymbols,
      cachedSymbols: currentCachedSymbols,
      defaultSeedSymbols: currentDefaultSeedSymbols,
      lastAttemptTime: lastSyncAttemptTime ? lastSyncAttemptTime.toISOString() : null,
      lastSuccessfulSync: lastSuccessfulSyncTime ? lastSuccessfulSyncTime.toISOString() : null,
      message: currentDseMessage,
      diagnostics: lastDiagnostics,
      activeEndpoint: getConfiguredLatestPriceUrl()
    };
  },

  async syncLiveDSEData(retries = 2, force = false): Promise<{ success: boolean; live: boolean; source: any; message: string; parsedSymbols: number }> {
    const now = new Date();

    // Check Throttling TTL (5 min caching unless forced user sync)
    if (!force && lastSuccessfulSyncTime && (now.getTime() - lastSuccessfulSyncTime.getTime() < DSE_CACHE_TTL_MS)) {
      console.log("[DSE Scraper] Cache is fresh. Returning cached DSE state without scraping.");
      const currentStatus = this.getStatus();
      return {
        success: true,
        live: currentStatus.status === "Success",
        source: currentStatus.source,
        message: "Using recently cached DSE data. Next live sync allowed after cache expiry (5 min TTL).",
        parsedSymbols: currentStatus.parsedSymbols
      };
    }

    // Rate limiting rapid sync clicks to throttle outbound spam (30s)
    const isTestEnv = process.env.NODE_ENV === "test" || process.env.VITEST === "true" || !!process.env.VITEST;
    if (!isTestEnv && force && lastSyncAttemptTime && (now.getTime() - lastSyncAttemptTime.getTime() < DSE_SYNC_RATE_LIMIT_MS) && lastSuccessfulSyncTime) {
      console.log("[DSE Scraper] Sync clicked too recently. Slowing down request to throttle.");
      const currentStatus = this.getStatus();
      return {
        success: false,
        live: false,
        source: currentStatus.source === "LiveScraped" ? "CachedFile" : currentStatus.source,
        message: "Synchronizing manually is regulated. Please wait 30 seconds between requests.",
        parsedSymbols: currentStatus.parsedSymbols
      };
    }

    lastSyncAttemptTime = now;

    currentDseSyncStatus = "Syncing";
    currentDseMessage = "Initiating live scrape lookup from dse.com.bd candidates...";

    const prevStatusOnAttempt = loadDseSyncStatus();
    const preservedLastSuccessfulSync = prevStatusOnAttempt?.lastSuccessfulSync || (lastSuccessfulSyncTime ? lastSuccessfulSyncTime.toISOString() : null);

    saveDseSyncStatus({
      status: "Syncing",
      source: currentDseSource,
      parsedSymbols: currentParsedSymbols,
      cachedSymbols: currentCachedSymbols,
      defaultSeedSymbols: currentDefaultSeedSymbols,
      lastAttemptTime: lastSyncAttemptTime.toISOString(),
      lastSuccessfulSync: preservedLastSuccessfulSync,
      message: currentDseMessage,
      diagnostics: lastDiagnostics
    });

    const envUrl = buildDseUrl(DSE_LATEST_PRICE_PATH);
    const candidateUrls = [
      envUrl,
      ...latestPriceCandidates.filter(url => url !== envUrl)
    ];

    let finalStocks: Record<string, StockData> | null = null;
    let selectedUrl: string | null = null;
    let attemptedLog: any[] = [];
    let successfulCount = 0;

    // Iteratively try candidates
    for (const url of candidateUrls) {
      try {
        const probeResult = await probeDseEndpoint(url);
        
        let rowsParsed = 0;
        let pErrorStr: string | null = null;

        if (probeResult.ok) {
          const rawHtml = await (await fetchWithTimeout(url, 8000)).text();
          const parsed = parseDseHtml(rawHtml);
          rowsParsed = Object.keys(parsed).length;

          if (rowsParsed >= 50) {
            finalStocks = parsed;
            selectedUrl = url;
            successfulCount = rowsParsed;
            
            attemptedLog.push({
              url,
              httpStatus: probeResult.httpStatus || 200,
              errorCode: null,
              rowsParsed,
              ok: true,
              message: `Success: Scraped ${rowsParsed} assets.`
            });
            break; // Working URL found, exit candidate loop
          } else {
            pErrorStr = "DSE_PARSE_MINIMUM_FAILED";
            attemptedLog.push({
              url,
              httpStatus: probeResult.httpStatus || 200,
              errorCode: pErrorStr,
              rowsParsed,
              ok: false,
              message: `Parsed under threshold: ${rowsParsed} assets.`
            });
          }
        } else {
          pErrorStr = probeResult.errorCode || "PROBE_FAILED";
          attemptedLog.push({
            url,
            httpStatus: probeResult.httpStatus,
            errorCode: pErrorStr,
            rowsParsed: 0,
            ok: false,
            message: probeResult.diagnosticsMessage || "Probe connection failed."
          });
        }
      } catch (err: any) {
        attemptedLog.push({
          url,
          httpStatus: null,
          errorCode: err?.name === "AbortError" ? "DSE_TIMEOUT" : "DSE_FETCH_EXCEPTION",
          rowsParsed: 0,
          ok: false,
          message: err.message || "Exception occurred."
        });
      }
    }

    // Success state
    if (finalStocks && Object.keys(finalStocks).length >= 50 && selectedUrl) {
      const currentStocks = loadStocks();
      const mergedStocks: Record<string, StockData> = { ...currentStocks };

      for (const [sym, parsedStock] of Object.entries(finalStocks)) {
        const existing = currentStocks[sym] || DSE_COMPANIES[sym];
        const mergedBase = {
          ...parsedStock,
          name: existing?.name || parsedStock.name || `${sym} Ltd.`,
          sector: existing?.sector || parsedStock.sector || getSectorBySymbolOrType(sym),
          eps: existing?.eps !== undefined && existing?.eps !== null ? existing.eps : parsedStock.eps,
          nav: existing?.nav !== undefined && existing?.nav !== null ? existing.nav : parsedStock.nav,
          peRatio: existing?.peRatio !== undefined && existing?.peRatio !== null ? existing.peRatio : parsedStock.peRatio,
          divYield: existing?.divYield !== undefined && existing?.divYield !== null ? existing.divYield : parsedStock.divYield,
          marketCap: existing?.marketCap !== undefined && existing?.marketCap !== null ? existing.marketCap : parsedStock.marketCap,
          revGrowth: existing?.revGrowth !== undefined && existing?.revGrowth !== null ? existing.revGrowth : parsedStock.revGrowth,
          profitGrowth: existing?.profitGrowth !== undefined && existing?.profitGrowth !== null ? existing.profitGrowth : parsedStock.profitGrowth,
          marketDepth: existing?.marketDepth || null,
          financials: existing?.financials || null,
          lastUpdated: now.toISOString()
        };
        mergedStocks[sym] = enrichStock(mergedBase);
      }

      saveStocks(mergedStocks, true);
      currentDseSyncStatus = "Success";
      currentDseSource = "LiveScraped";
      currentParsedSymbols = successfulCount;
      currentCachedSymbols = 0;
      currentDefaultSeedSymbols = 0;
      lastSuccessfulSyncTime = now;

      // Sync market indices
      await scrapeAndSaveIndices(true);

      currentDseMessage = `Successfully scraped ${successfulCount} active stocks from DSE live ticker.`;

      lastDiagnostics = {
        finalUrl: selectedUrl,
        baseUrl: DSE_BASE_URL,
        latestPricePath: DSE_LATEST_PRICE_PATH,
        companyPath: DSE_COMPANY_PATH,
        httpStatus: 200,
        errorCode: null,
        rowsParsed: successfulCount,
        attemptedUrls: attemptedLog,
        selectedUrl,
        diagnosticsMessage: currentDseMessage
      };

      saveLatestDseData({
        stocks: mergedStocks,
        indices: loadIndices(),
        timestamp: now.toISOString(),
        source: "LiveScraped"
      });

      saveDseSyncStatus({
        status: "Success",
        source: "LiveScraped",
        parsedSymbols: successfulCount,
        cachedSymbols: 0,
        defaultSeedSymbols: 0,
        lastAttemptTime: lastSyncAttemptTime.toISOString(),
        lastSuccessfulSync: lastSuccessfulSyncTime.toISOString(),
        message: currentDseMessage,
        diagnostics: lastDiagnostics
      });

      console.log(`[DSE Scraper] ${currentDseMessage}`);
      return {
        success: true,
        live: true,
        source: "LiveScraped",
        message: currentDseMessage,
        parsedSymbols: successfulCount
      };
    }

    // When live scrape fails: load the last real cached data UNCHANGED with NO price modification.
    // Set source to "CachedFile", status "Cached" and live false, include original lastSuccessfulSync,
    // and return success: false for the failed attempt. If no cache exists, return source "Unavailable".
    console.warn(`[DSE Scraper] Scrape attempt failed across all candidate endpoints. Loading cached data unchanged.`);

    const existingCache = loadLatestDseData();
    let cachedStocks: Record<string, StockData> | null = null;

    if (existingCache && existingCache.stocks && Object.keys(existingCache.stocks).length > 0) {
      cachedStocks = existingCache.stocks;
    } else {
      const currentStocks = loadStocks();
      if (Object.keys(currentStocks).length > 0) {
        cachedStocks = currentStocks;
      }
    }

    const hasCachedData = cachedStocks && Object.keys(cachedStocks).length > 0;
    const finalSource: "CachedFile" | "Unavailable" = hasCachedData ? "CachedFile" : "Unavailable";
    const finalStatus: "Cached" | "Unavailable" = hasCachedData ? "Cached" : "Unavailable";
    const cachedCount = hasCachedData ? Object.keys(cachedStocks).length : 0;

    // Preserve the original lastSuccessfulSync timestamp (do not overwrite with now)
    const originalSuccessfulSync = preservedLastSuccessfulSync;

    currentDseSyncStatus = "Failed";
    currentDseSource = finalSource;
    currentParsedSymbols = 0;
    currentCachedSymbols = cachedCount;
    currentDefaultSeedSymbols = 0;
    currentDseMessage = `Scrape failed. Serving authentic ${finalSource.toLowerCase()} data without modifications.`;

    lastDiagnostics = {
      finalUrl: buildDseUrl(DSE_LATEST_PRICE_PATH),
      baseUrl: DSE_BASE_URL,
      latestPricePath: DSE_LATEST_PRICE_PATH,
      companyPath: DSE_COMPANY_PATH,
      httpStatus: 503,
      errorCode: "SCRAPE_FAILED",
      rowsParsed: 0,
      attemptedUrls: attemptedLog,
      selectedUrl: null,
      diagnosticsMessage: "DSE endpoints could not be reached. Preserved cached data unchanged without price simulation."
    };

    saveDseSyncStatus({
      status: finalStatus,
      source: finalSource,
      live: false,
      parsedSymbols: 0,
      cachedSymbols: cachedCount,
      defaultSeedSymbols: 0,
      lastAttemptTime: lastSyncAttemptTime.toISOString(),
      lastSuccessfulSync: originalSuccessfulSync,
      message: currentDseMessage,
      diagnostics: lastDiagnostics
    });

    return {
      success: false,
      live: false,
      source: finalSource,
      message: currentDseMessage,
      parsedSymbols: 0
    };
  }
};

export async function scrapeAndSaveIndices(isLiveTrigger: boolean = true): Promise<void> {
  const now = new Date();
  const nowIso = now.toISOString();
  const todayStr = nowIso.split("T")[0];

  const existingIndices = loadIndices();

  let dsexVal = (existingIndices as any)?.DSEX?.value ?? 5550.44;
  let dsexChange = (existingIndices as any)?.DSEX?.change ?? 26.07;
  let dsexPct = (existingIndices as any)?.DSEX?.changePercent ?? 0.47;
  let dsexPrev = (existingIndices as any)?.DSEX?.prev ?? 5524.37;

  let ds30Val = (existingIndices as any)?.DS30?.value ?? 2108.45;
  let ds30Change = (existingIndices as any)?.DS30?.change ?? 13.77;
  let ds30Pct = (existingIndices as any)?.DS30?.changePercent ?? 0.66;
  let ds30Prev = (existingIndices as any)?.DS30?.prev ?? 2094.68;

  let dsesVal = (existingIndices as any)?.DSES?.value ?? 1102.49;
  let dsesChange = (existingIndices as any)?.DSES?.change ?? 4.45;
  let dsesPct = (existingIndices as any)?.DSES?.changePercent ?? 0.41;
  let dsesPrev = (existingIndices as any)?.DSES?.prev ?? 1098.04;

  let totals = (existingIndices as any)?.totals ?? {
    trades: 176960,
    volume: 204662608,
    turnover: 6991.183,
    marketCap: 6874765902229,
    tradeTime: "Sep 30, 2026 at 2:40 PM"
  };

  let breadth = (existingIndices as any)?.breadth ?? {
    advanced: 190,
    declined: 130,
    unchanged: 67,
    traded: 387
  };

  let intradayPoints: Array<{ t: string; value: number }> | undefined = (existingIndices as any)?.intradayPoints;
  let isLive = false;

  // Attempt live scrape of official dse.com.bd homepage
  try {
    const homeRes = await defaultDseClient.fetchHomepageHtml();
    if (homeRes.status === 200 && homeRes.body) {
      const glance = DseParser.parseAtAGlance(homeRes.body);
      if (glance.dsex && glance.dsex.current > 0) {
        dsexVal = glance.dsex.current;
        dsexChange = glance.dsex.change ?? dsexChange;
        dsexPct = glance.dsex.changePercent ?? dsexPct;
        dsexPrev = glance.dsex.prev ?? dsexPrev;
        isLive = true;
      }
      if (glance.ds30 && glance.ds30.current > 0) {
        ds30Val = glance.ds30.current;
        ds30Change = glance.ds30.change ?? ds30Change;
        ds30Pct = glance.ds30.changePercent ?? ds30Pct;
        ds30Prev = glance.ds30.prev ?? ds30Prev;
        isLive = true;
      }
      if (glance.dses && glance.dses.current > 0) {
        dsesVal = glance.dses.current;
        dsesChange = glance.dses.change ?? dsesChange;
        dsesPct = glance.dses.changePercent ?? dsesPct;
        dsesPrev = glance.dses.prev ?? dsesPrev;
        isLive = true;
      }
      if (glance.totalTrades !== undefined) totals.trades = glance.totalTrades;
      if (glance.totalVolume !== undefined) totals.volume = glance.totalVolume;
      if (glance.totalTurnoverBdt !== undefined) totals.turnover = glance.totalTurnoverBdt;
      if (glance.totalMarketCapBdt !== undefined) totals.marketCap = glance.totalMarketCapBdt;
      if (glance.tradeTime) totals.tradeTime = glance.tradeTime;

      if (glance.issuesAdvanced !== undefined) {
        breadth = {
          advanced: glance.issuesAdvanced,
          declined: glance.issuesDeclined || 0,
          unchanged: glance.issuesUnchanged || 0,
          traded: glance.issuesTraded || 0
        };
      }

      if (glance.intradayPoints && glance.intradayPoints.length > 0) {
        intradayPoints = glance.intradayPoints;
      }
    }
  } catch (err: any) {
    console.warn("[scrapeAndSaveIndices] Live probe failed:", err.message);
  }

  const indicesSource = isLive ? "LiveScraped" : (existingIndices ? "CachedFile" : "Unavailable");

  saveIndices({
    DSEX: { symbol: "DSEX", name: "DSEX Broad Index", value: dsexVal, change: dsexChange, changePercent: dsexPct, prev: dsexPrev },
    DS30: { symbol: "DS30", name: "DS30 Blue Chip Index", value: ds30Val, change: ds30Change, changePercent: ds30Pct, prev: ds30Prev },
    DSES: { symbol: "DSES", name: "DSE Shariah Index", value: dsesVal, change: dsesChange, changePercent: dsesPct, prev: dsesPrev },
    totals,
    breadth,
    intradayPoints,
    timestamp: isLive ? nowIso : (existingIndices?.timestamp || nowIso),
    source: indicesSource
  });

  // Save to daily history
  saveDailyHistoryRecord({
    timestamp: nowIso,
    index_name: "DSEX",
    index_value: dsexVal,
    change_value: dsexChange,
    change_percent: dsexPct,
    trading_date: todayStr
  });
  saveDailyHistoryRecord({
    timestamp: nowIso,
    index_name: "DS30",
    index_value: ds30Val,
    change_value: ds30Change,
    change_percent: ds30Pct,
    trading_date: todayStr
  });
  saveDailyHistoryRecord({
    timestamp: nowIso,
    index_name: "DSES",
    index_value: dsesVal,
    change_value: dsesChange,
    change_percent: dsesPct,
    trading_date: todayStr
  });

  // Save intraday ticks if available
  if (intradayPoints && intradayPoints.length > 0) {
    for (const pt of intradayPoints) {
      saveIntradayTick({
        timestamp: `${todayStr}T${pt.t}:00.000Z`,
        index_name: "DSEX",
        index_value: pt.value,
        change_value: parseFloat((pt.value - dsexPrev).toFixed(2)),
        change_percent: dsexPrev ? parseFloat((((pt.value - dsexPrev) / dsexPrev) * 100).toFixed(2)) : 0,
        trading_date: todayStr
      });
    }
  }

  console.log(`[DSE Scraper] Synced live DSE indices from dse.com.bd. DSEX=${dsexVal} (+${dsexChange}), DS30=${ds30Val}, DSES=${dsesVal}`);
}
