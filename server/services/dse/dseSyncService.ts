import { DseClient, defaultDseClient } from "./dseClient";
import { DseParser } from "./dseParser";
import { DseUniverseManager } from "./dseUniverse";
import { DseMarketDataManager } from "./dseMarketData";
import { DseFinancialsManager } from "./dseFinancials";
import { DseShareholdingManager } from "./dseShareholding";
import { DseCorporateActionsManager } from "./dseCorporateActions";
import { DseDisclosuresManager } from "./dseDisclosures";
import { DseHistoricalDataManager } from "./dseHistoricalData";
import { saveIndices } from "../../repositories/marketRepository";
import { saveDailyHistoryRecord, saveIntradayTick } from "../../repositories/marketIndexRepository";

export interface SyncResult {
  success: boolean;
  syncType: "universe" | "market" | "historical" | "financials" | "disclosures" | "corporate-actions" | "all";
  startedAt: string;
  completedAt: string;
  recordsDiscovered: number;
  recordsUpdated: number;
  recordsInserted: number;
  recordsFailed: number;
  source: string;
  errors: string[];
}

export class DseSyncService {
  private client: DseClient;
  private isSyncing: boolean = false;
  private lastSyncTime: number = 0;
  private minIntervalBetweenFullSyncsMs: number = 60 * 1000; // 60 seconds minimum cooldown

  constructor(client: DseClient = defaultDseClient) {
    this.client = client;
  }

  isCurrentlySyncing(): boolean {
    return this.isSyncing;
  }

  getLastSyncTime(): number {
    return this.lastSyncTime;
  }

  /**
   * Synchronizes the entire dynamic DSE security universe from https://www.dse.com.bd/companies
   */
  async syncUniverse(): Promise<SyncResult> {
    const startedAt = new Date().toISOString();
    const errors: string[] = [];

    try {
      this.isSyncing = true;
      const res = await this.client.fetchCompaniesHtml();
      if (res.status !== 200 || !res.body) {
        throw new Error(`DSE /companies returned HTTP ${res.status}`);
      }

      const rawItems = DseParser.parseCompaniesUniverse(res.body);
      if (rawItems.length === 0) {
        throw new Error("No securities parsed from DSE /companies HTML payload");
      }

      // Update security master
      const universeStats = DseUniverseManager.updateFromOfficialUniverse(rawItems, res.url);

      // Update snapshot market data
      const marketCount = DseMarketDataManager.updateFromUniverseItems(rawItems, res.url);

      // Update initial reported ratios without inventing metrics
      for (const item of rawItems) {
        if (item.pe !== null || item.dividendYield !== null) {
          DseFinancialsManager.updateReportedRatios({
            symbol: item.code,
            peRatio: item.pe,
            eps: null,
            nav: null,
            dividendYield: item.dividendYield,
            sourceUrl: res.url
          });
        }
      }

      this.lastSyncTime = Date.now();
      const completedAt = new Date().toISOString();

      return {
        success: true,
        syncType: "universe",
        startedAt,
        completedAt,
        recordsDiscovered: rawItems.length,
        recordsUpdated: universeStats.updated,
        recordsInserted: universeStats.inserted,
        recordsFailed: 0,
        source: "DSE_OFFICIAL (https://www.dse.com.bd/companies)",
        errors
      };
    } catch (err: any) {
      errors.push(err.message || String(err));
      return {
        success: false,
        syncType: "universe",
        startedAt,
        completedAt: new Date().toISOString(),
        recordsDiscovered: 0,
        recordsUpdated: 0,
        recordsInserted: 0,
        recordsFailed: 1,
        source: "DSE_OFFICIAL",
        errors
      };
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Synchronizes market snapshot data and market indices.
   */
  async syncMarket(): Promise<SyncResult> {
    const startedAt = new Date().toISOString();
    const errors: string[] = [];

    try {
      this.isSyncing = true;

      // 1. Fetch homepage for indices, market totals, breadth, and intraday points
      try {
        const homeRes = await this.client.fetchHomepageHtml();
        if (homeRes.status === 200 && homeRes.body) {
          const glanceData = DseParser.parseAtAGlance(homeRes.body);
          if (glanceData.dsex && glanceData.dsex.current > 0) {
            saveIndices({
              DSEX: {
                symbol: "DSEX",
                name: "DSEX Broad Index",
                value: glanceData.dsex.current,
                change: glanceData.dsex.change ?? 0,
                changePercent: glanceData.dsex.changePercent ?? 0,
                prev: glanceData.dsex.prev
              },
              DS30: {
                symbol: "DS30",
                name: "DS30 Blue Chip Index",
                value: glanceData.ds30?.current ?? 0,
                change: glanceData.ds30?.change ?? 0,
                changePercent: glanceData.ds30?.changePercent ?? 0,
                prev: glanceData.ds30?.prev
              },
              DSES: {
                symbol: "DSES",
                name: "DSE Shariah Index",
                value: glanceData.dses?.current ?? 0,
                change: glanceData.dses?.change ?? 0,
                changePercent: glanceData.dses?.changePercent ?? 0,
                prev: glanceData.dses?.prev
              },
              totals: {
                trades: glanceData.totalTrades,
                volume: glanceData.totalVolume,
                turnover: glanceData.totalTurnoverBdt,
                marketCap: glanceData.totalMarketCapBdt,
                tradeTime: glanceData.tradeTime
              },
              breadth: glanceData.issuesAdvanced !== undefined ? {
                advanced: glanceData.issuesAdvanced,
                declined: glanceData.issuesDeclined || 0,
                unchanged: glanceData.issuesUnchanged || 0,
                traded: glanceData.issuesTraded || 0
              } : undefined,
              intradayPoints: glanceData.intradayPoints,
              source: "LiveScraped",
              timestamp: new Date().toISOString()
            });

            // Update daily index history in marketIndexRepository
            const todayStr = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
            const nowIso = new Date().toISOString();
            saveDailyHistoryRecord({
              timestamp: nowIso,
              index_name: "DSEX",
              index_value: glanceData.dsex.current,
              change_value: glanceData.dsex.change ?? 0,
              change_percent: glanceData.dsex.changePercent ?? 0,
              trading_date: todayStr
            });
            if (glanceData.ds30?.current) {
              saveDailyHistoryRecord({
                timestamp: nowIso,
                index_name: "DS30",
                index_value: glanceData.ds30.current,
                change_value: glanceData.ds30.change ?? 0,
                change_percent: glanceData.ds30.changePercent ?? 0,
                trading_date: todayStr
              });
            }
            if (glanceData.dses?.current) {
              saveDailyHistoryRecord({
                timestamp: nowIso,
                index_name: "DSES",
                index_value: glanceData.dses.current,
                change_value: glanceData.dses.change ?? 0,
                change_percent: glanceData.dses.changePercent ?? 0,
                trading_date: todayStr
              });
            }

            // Save intraday ticks if available
            if (glanceData.intradayPoints && glanceData.intradayPoints.length > 0) {
              for (const pt of glanceData.intradayPoints) {
                saveIntradayTick({
                  timestamp: `${todayStr}T${pt.t}:00.000Z`,
                  index_name: "DSEX",
                  index_value: pt.value,
                  change_value: parseFloat((pt.value - (glanceData.dsex.prev || 5524.37)).toFixed(2)),
                  change_percent: glanceData.dsex.prev ? parseFloat((((pt.value - glanceData.dsex.prev) / glanceData.dsex.prev) * 100).toFixed(2)) : 0,
                  trading_date: todayStr
                });
              }
            }
          }

          // Parse and apply initialPrices from homepage
          const homePrices = DseParser.parseHomepagePrices(homeRes.body);
          if (homePrices.length > 0) {
            DseMarketDataManager.updateFromPriceRows(homePrices, homeRes.url);
          }
        }
      } catch (e: any) {
        errors.push(`Homepage index fetch warning: ${e.message}`);
      }

      // 2. Fetch companies universe for prices and volumes
      const compRes = await this.client.fetchCompaniesHtml();
      const rawItems = DseParser.parseCompaniesUniverse(compRes.body);
      const updatedCount = DseMarketDataManager.updateFromUniverseItems(rawItems, compRes.url);

      this.lastSyncTime = Date.now();
      const completedAt = new Date().toISOString();

      return {
        success: true,
        syncType: "market",
        startedAt,
        completedAt,
        recordsDiscovered: rawItems.length,
        recordsUpdated: updatedCount,
        recordsInserted: 0,
        recordsFailed: errors.length > 0 ? 1 : 0,
        source: "DSE_OFFICIAL",
        errors
      };
    } catch (err: any) {
      errors.push(err.message || String(err));
      return {
        success: false,
        syncType: "market",
        startedAt,
        completedAt: new Date().toISOString(),
        recordsDiscovered: 0,
        recordsUpdated: 0,
        recordsInserted: 0,
        recordsFailed: 1,
        source: "DSE_OFFICIAL",
        errors
      };
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Synchronizes complete details for a single company from https://www.dse.com.bd/company/:symbol
   */
  async syncCompany(symbol: string): Promise<boolean> {
    try {
      const sym = symbol.toUpperCase().trim();
      const res = await this.client.fetchCompanyHtml(sym);
      if (res.status !== 200 || !res.body) {
        return false;
      }

      const detail = DseParser.parseCompanyDetail(res.body, sym);
      if (!detail) {
        return false;
      }

      // Update Universe
      DseUniverseManager.updateFromCompanyDetail(detail, res.url);

      // Update Market Data Snapshot
      DseMarketDataManager.updateFromCompanyDetail(detail, res.url);

      // Update Financials & Ratios
      DseFinancialsManager.updateFromCompanyDetail(detail, res.url);

      // Update Shareholding
      DseShareholdingManager.updateFromCompanyDetail(detail, res.url);

      // Update Corporate Actions
      DseCorporateActionsManager.updateFromCompanyDetail(detail, res.url);

      // Update Disclosures
      DseDisclosuresManager.updateFromCompanyDetail(detail, res.url);

      // Update Historical Daily Price Data
      DseHistoricalDataManager.updateFromCompanyDetail(detail, res.url);

      return true;
    } catch (e) {
      console.warn(`[DseSyncService] Failed to sync company ${symbol}:`, e);
      return false;
    }
  }

  /**
   * Synchronizes universe, market snapshots, and detailed data for key securities.
   */
  async syncAll(): Promise<SyncResult> {
    const startedAt = new Date().toISOString();
    const errors: string[] = [];

    // Cooldown check
    const now = Date.now();
    if (now - this.lastSyncTime < this.minIntervalBetweenFullSyncsMs) {
      return {
        success: true,
        syncType: "all",
        startedAt,
        completedAt: new Date().toISOString(),
        recordsDiscovered: DseUniverseManager.getCount(),
        recordsUpdated: 0,
        recordsInserted: 0,
        recordsFailed: 0,
        source: "DSE_OFFICIAL (Cached - Cooldown Active)",
        errors: ["Sync skipped: minimum interval between full syncs is 60 seconds."]
      };
    }

    try {
      this.isSyncing = true;

      // 1. Sync universe
      const uResult = await this.syncUniverse();
      if (!uResult.success) {
        errors.push(...uResult.errors);
      }

      // 2. Sync market at-a-glance
      const mResult = await this.syncMarket();
      if (!mResult.success) {
        errors.push(...mResult.errors);
      }

      // 3. Sync top liquid securities in background
      const prioritySymbols = ["GP", "BATBC", "SQURPHARMA", "ROBI", "BRACBANK", "BSRMLTD", "CITYBANK", "RENATA", "BXPHARMA", "LHBL"];
      let deepSyncSuccess = 0;
      for (const sym of prioritySymbols) {
        const ok = await this.syncCompany(sym);
        if (ok) deepSyncSuccess++;
      }

      this.lastSyncTime = Date.now();
      const completedAt = new Date().toISOString();

      return {
        success: true,
        syncType: "all",
        startedAt,
        completedAt,
        recordsDiscovered: uResult.recordsDiscovered,
        recordsUpdated: uResult.recordsUpdated + deepSyncSuccess,
        recordsInserted: uResult.recordsInserted,
        recordsFailed: errors.length,
        source: "DSE_OFFICIAL",
        errors
      };
    } catch (err: any) {
      errors.push(err.message || String(err));
      return {
        success: false,
        syncType: "all",
        startedAt,
        completedAt: new Date().toISOString(),
        recordsDiscovered: 0,
        recordsUpdated: 0,
        recordsInserted: 0,
        recordsFailed: 1,
        source: "DSE_OFFICIAL",
        errors
      };
    } finally {
      this.isSyncing = false;
    }
  }
}

export const defaultDseSyncService = new DseSyncService();
