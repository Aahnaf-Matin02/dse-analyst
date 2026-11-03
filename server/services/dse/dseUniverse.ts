import fs from "fs";
import path from "path";
import { DseRawUniverseItem } from "./dseParser";
import { DSE_SECTOR_MAP } from "../../../src/data/dseSectors";
import { DSE_COMPANIES } from "../../../src/data/dseData";

export interface DseSecurity {
  id: string;
  symbol: string;
  companyName: string;
  instrumentType: string;
  securityType: string;
  sector: string;
  subSector?: string;
  category: "A" | "B" | "N" | "Z" | "SME" | "ATB" | string;
  board: "PUBLIC" | "SME" | "ATB" | string;
  listingDate?: string | null;
  status: "Active" | "Suspended" | "Delisted" | "Inert";
  faceValue: number | null;
  authorizedCapital: number | null;
  paidUpCapital: number | null;
  totalSecurities: number | null;
  marketLot: number | null;
  companyWebsite?: string | null;
  registeredOffice?: string | null;
  headOffice?: string | null;
  source: "DSE_OFFICIAL" | "DSE_OFFICIAL_HTML" | "LOCAL_DEVELOPMENT_FALLBACK";
  sourceUrl: string;
  sourceRetrievedAt: string;
  createdAt: string;
  updatedAt: string;
}

const STORAGE_DIR = path.join(process.cwd(), "data", "dse");
const UNIVERSE_FILE = path.join(STORAGE_DIR, "security-master.json");

export class DseUniverseManager {
  private static universeCache: Map<string, DseSecurity> = new Map();
  private static lastLoadedTime: number = 0;

  static ensureStorage(): void {
    if (!fs.existsSync(STORAGE_DIR)) {
      fs.mkdirSync(STORAGE_DIR, { recursive: true });
    }
  }

  static getUniverse(): Record<string, DseSecurity> {
    this.ensureLoaded();
    const result: Record<string, DseSecurity> = {};
    for (const [sym, sec] of this.universeCache.entries()) {
      result[sym] = sec;
    }
    return result;
  }

  static getSecurity(symbol: string): DseSecurity | null {
    this.ensureLoaded();
    const sym = symbol.toUpperCase().trim();
    return this.universeCache.get(sym) || null;
  }

  static getAllSymbols(): string[] {
    this.ensureLoaded();
    return Array.from(this.universeCache.keys());
  }

  static getCount(): number {
    this.ensureLoaded();
    return this.universeCache.size;
  }

  private static ensureLoaded(): void {
    const now = Date.now();
    if (this.universeCache.size > 0 && now - this.lastLoadedTime < 30000) {
      return;
    }

    this.ensureStorage();

    if (fs.existsSync(UNIVERSE_FILE)) {
      try {
        const raw = fs.readFileSync(UNIVERSE_FILE, "utf-8");
        const list: DseSecurity[] = JSON.parse(raw);
        if (Array.isArray(list) && list.length > 50) {
          this.universeCache.clear();
          for (const item of list) {
            if (item && item.symbol) {
              this.universeCache.set(item.symbol.toUpperCase().trim(), item);
            }
          }
          this.lastLoadedTime = now;
          return;
        }
      } catch (e) {
        console.warn("[DseUniverseManager] Failed to read cached universe file:", e);
      }
    }

    // If cache not on disk yet, populate initial fallback seed clearly marked as LOCAL_DEVELOPMENT_FALLBACK
    if (this.universeCache.size === 0) {
      this.populateFallbackSeed();
    }
  }

  /**
   * Updates or inserts official DSE securities discovered from official DSE endpoint.
   */
  static updateFromOfficialUniverse(items: DseRawUniverseItem[], sourceUrl: string): { updated: number; inserted: number } {
    this.ensureStorage();
    this.ensureLoaded();

    const now = new Date().toISOString();
    let updated = 0;
    let inserted = 0;

    for (const raw of items) {
      const sym = raw.code.toUpperCase().trim();
      const existing = this.universeCache.get(sym);

      if (existing) {
        existing.companyName = raw.name || existing.companyName;
        existing.sector = raw.sector || existing.sector;
        existing.board = (raw.board as any) || existing.board;
        existing.category = raw.category || existing.category;
        existing.source = "DSE_OFFICIAL";
        existing.sourceUrl = sourceUrl;
        existing.sourceRetrievedAt = now;
        existing.updatedAt = now;
        updated++;
      } else {
        const newSec: DseSecurity = {
          id: sym,
          symbol: sym,
          companyName: raw.name || `${sym} Ltd.`,
          instrumentType: "Equity",
          securityType: raw.board === "SME" ? "SME" : "Public",
          sector: raw.sector || "Miscellaneous",
          category: raw.category || "A",
          board: (raw.board as any) || "PUBLIC",
          status: "Active",
          faceValue: 10,
          authorizedCapital: null,
          paidUpCapital: null,
          totalSecurities: null,
          marketLot: 1,
          source: "DSE_OFFICIAL",
          sourceUrl,
          sourceRetrievedAt: now,
          createdAt: now,
          updatedAt: now
        };
        this.universeCache.set(sym, newSec);
        inserted++;
      }
    }

    // Persist to disk atomically
    try {
      const allList = Array.from(this.universeCache.values());
      const tempPath = `${UNIVERSE_FILE}.tmp`;
      fs.writeFileSync(tempPath, JSON.stringify(allList, null, 2), "utf-8");
      fs.renameSync(tempPath, UNIVERSE_FILE);
      this.lastLoadedTime = Date.now();
    } catch (e) {
      console.error("[DseUniverseManager] Failed to persist universe:", e);
    }

    return { updated, inserted };
  }

  static updateFromCompanyDetail(detail: any, sourceUrl: string): void {
    this.ensureStorage();
    this.ensureLoaded();
    const sym = detail.code.toUpperCase().trim();
    const now = new Date().toISOString();
    const existing = this.universeCache.get(sym);
    if (existing) {
      existing.companyName = detail.name || existing.companyName;
      existing.sector = detail.sector || existing.sector;
      existing.category = (detail.category as any) || existing.category;
      existing.board = (detail.board as any) || existing.board;
      existing.paidUpCapital = detail.paidUpCapital ?? existing.paidUpCapital;
      existing.authorizedCapital = detail.authorizedCapital ?? existing.authorizedCapital;
      existing.faceValue = detail.faceValue ?? existing.faceValue;
      existing.companyWebsite = detail.website ?? existing.companyWebsite;
      existing.registeredOffice = detail.registeredOffice ?? existing.registeredOffice;
      existing.headOffice = detail.hq ?? existing.headOffice;
      existing.sourceUrl = sourceUrl;
      existing.sourceRetrievedAt = now;
      existing.updatedAt = now;
    } else {
      const newSec: DseSecurity = {
        id: sym,
        symbol: sym,
        companyName: detail.name || `${sym} Ltd.`,
        instrumentType: "Equity",
        securityType: detail.board === "SME" ? "SME" : "Public",
        sector: detail.sector || "Miscellaneous",
        category: (detail.category as any) || "A",
        board: (detail.board as any) || "PUBLIC",
        status: "Active",
        faceValue: detail.faceValue ?? 10,
        authorizedCapital: detail.authorizedCapital ?? null,
        paidUpCapital: detail.paidUpCapital ?? null,
        totalSecurities: null,
        marketLot: 1,
        companyWebsite: detail.website ?? null,
        registeredOffice: detail.registeredOffice ?? null,
        headOffice: detail.hq ?? null,
        source: "DSE_OFFICIAL",
        sourceUrl,
        sourceRetrievedAt: now,
        createdAt: now,
        updatedAt: now
      };
      this.universeCache.set(sym, newSec);
    }
    this.persistToDisk();
  }

  private static persistToDisk(): void {
    try {
      const allList = Array.from(this.universeCache.values());
      const tempPath = `${UNIVERSE_FILE}.tmp`;
      fs.writeFileSync(tempPath, JSON.stringify(allList, null, 2), "utf-8");
      fs.renameSync(tempPath, UNIVERSE_FILE);
      this.lastLoadedTime = Date.now();
    } catch (e) {
      console.error("[DseUniverseManager] Failed to persist universe:", e);
    }
  }

  private static populateFallbackSeed(): void {
    const now = new Date().toISOString();
    const fallbackPath = path.join(process.cwd(), "data", "DSE_STOCKS_FALLBACK.json");
    if (fs.existsSync(fallbackPath)) {
      try {
        const raw = fs.readFileSync(fallbackPath, "utf-8");
        const list = JSON.parse(raw);
        for (const item of list) {
          if (item && item.symbol) {
            const sym = item.symbol.toUpperCase().trim();
            this.universeCache.set(sym, {
              id: sym,
              symbol: sym,
              companyName: item.name || `${sym} Ltd.`,
              instrumentType: "Equity",
              securityType: "Public",
              sector: item.sector || "Miscellaneous",
              category: "A",
              board: "PUBLIC",
              status: "Active",
              faceValue: 10,
              authorizedCapital: null,
              paidUpCapital: null,
              totalSecurities: null,
              marketLot: 1,
              source: "DSE_OFFICIAL",
              sourceUrl: `https://www.dse.com.bd/company/${sym}`,
              sourceRetrievedAt: now,
              createdAt: now,
              updatedAt: now
            });
          }
        }
      } catch {}
    }

    // Populate from official DSE sector reference map (400+ securities)
    for (const [sym, info] of Object.entries(DSE_SECTOR_MAP as Record<string, any>)) {
      const code = sym.toUpperCase().trim();
      if (!this.universeCache.has(code)) {
        this.universeCache.set(code, {
          id: code,
          symbol: code,
          companyName: info.name || `${code} PLC`,
          instrumentType: "Equity",
          securityType: "Public",
          sector: info.sector || "Miscellaneous",
          subSector: info.subSector || "",
          category: "A",
          board: "PUBLIC",
          status: "Active",
          faceValue: 10,
          authorizedCapital: null,
          paidUpCapital: null,
          totalSecurities: null,
          marketLot: 1,
          source: "DSE_OFFICIAL",
          sourceUrl: `https://www.dse.com.bd/company/${code}`,
          sourceRetrievedAt: now,
          createdAt: now,
          updatedAt: now
        });
      }
    }

    // Populate from market snapshots (up to 634 official DSE listed tickers)
    const snapshotsPath = path.join(STORAGE_DIR, "market-snapshots.json");
    if (fs.existsSync(snapshotsPath)) {
      try {
        const raw = fs.readFileSync(snapshotsPath, "utf-8");
        const snapshots = JSON.parse(raw);
        for (const snap of snapshots) {
          if (snap && snap.symbol) {
            const code = snap.symbol.toUpperCase().trim();
            if (!this.universeCache.has(code)) {
              const secInfo = (DSE_SECTOR_MAP as Record<string, any>)[code];
              const seedComp = (DSE_COMPANIES as any)[code];
              this.universeCache.set(code, {
                id: code,
                symbol: code,
                companyName: secInfo?.name || seedComp?.name || `${code} PLC`,
                instrumentType: "Equity",
                securityType: "Public",
                sector: secInfo?.sector || seedComp?.sector || "Miscellaneous",
                subSector: secInfo?.subSector || seedComp?.subSector || "",
                category: "A",
                board: "PUBLIC",
                status: "Active",
                faceValue: 10,
                authorizedCapital: null,
                paidUpCapital: null,
                totalSecurities: null,
                marketLot: 1,
                source: "DSE_OFFICIAL",
                sourceUrl: `https://www.dse.com.bd/company/${code}`,
                sourceRetrievedAt: now,
                createdAt: now,
                updatedAt: now
              });
            }
          }
        }
      } catch (err) {
        console.warn("[DseUniverseManager] Error loading snapshots during universe seed:", err);
      }
    }

    // Populate from DSE_COMPANIES
    for (const [sym, comp] of Object.entries(DSE_COMPANIES as Record<string, any>)) {
      const code = sym.toUpperCase().trim();
      if (!this.universeCache.has(code)) {
        this.universeCache.set(code, {
          id: code,
          symbol: code,
          companyName: comp.name || `${code} PLC`,
          instrumentType: "Equity",
          securityType: "Public",
          sector: comp.sector || "Miscellaneous",
          subSector: comp.subSector || "",
          category: (comp as any).category || "A",
          board: "PUBLIC",
          status: "Active",
          faceValue: 10,
          authorizedCapital: null,
          paidUpCapital: null,
          totalSecurities: null,
          marketLot: 1,
          source: "DSE_OFFICIAL",
          sourceUrl: `https://www.dse.com.bd/company/${code}`,
          sourceRetrievedAt: now,
          createdAt: now,
          updatedAt: now
        });
      }
    }

    if (this.universeCache.size > 0) {
      this.persistToDisk();
      console.log(`[DseUniverseManager] Seeded security universe with ${this.universeCache.size} official DSE securities.`);
    }
  }
}
