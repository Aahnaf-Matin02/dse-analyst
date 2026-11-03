import fs from "fs";
import path from "path";
import { DSE_SECTOR_MAP } from "../../src/data/dseSectors";
import { DSE_COMPANIES } from "../../src/data/dseData";
import { loadLatestDseData } from "../repositories/dseCacheRepository";
import { DseUniverseManager } from "./dse/dseUniverse";

export interface UniverseSecurity {
  symbol: string;
  name: string;
  sector: string;
  subSector: string;
  industry: string;
  category: "A" | "B" | "N" | "Z" | "SME" | "Bond" | string;
  listingStatus: "Active" | "Suspended" | "Inert";
  type: "Equity" | "SME" | "Mutual Fund" | "Bond" | "ETF";
}

export const DseUniverseService = {
  /**
   * Retrieves the combined set of all recognized securities in the DSE stock universe.
   * Discovers tickers dynamically from:
   * 1. Official DSE Universe Manager (https://www.dse.com.bd/companies)
   * 2. Official sectors mapping (src/data/dseSectors.ts)
   * 3. Fallback static seed (src/data/dseData.ts)
   * 4. Scraped cache (data/cache/dse-latest.json)
   * 5. Local history files on disk (data/history/stocks/*.csv)
   */
  getCompleteUniverse(): Record<string, UniverseSecurity> {
    const universe: Record<string, UniverseSecurity> = {};

    // 0. Authoritative Source: DSE Official Universe Manager (https://www.dse.com.bd/companies)
    try {
      const officialMap = DseUniverseManager.getUniverse();
      for (const [sym, sec] of Object.entries(officialMap)) {
        const uppercaseSym = sym.toUpperCase().trim();
        universe[uppercaseSym] = {
          symbol: uppercaseSym,
          name: sec.companyName,
          sector: sec.sector || "Miscellaneous",
          subSector: sec.subSector || "",
          industry: sec.subSector || sec.sector || "Miscellaneous",
          category: (sec.category as any) || "A",
          listingStatus: sec.status === "Active" ? "Active" : "Inert",
          type: sec.board === "SME" ? "SME" : "Equity"
        };
      }
    } catch {}

    // 1. Supplement from Official Sector Reference Map (src/data/dseSectors.ts)
    if (DSE_SECTOR_MAP) {
      for (const [sym, info] of Object.entries(DSE_SECTOR_MAP)) {
        const uppercaseSym = sym.toUpperCase().trim();
        if (!universe[uppercaseSym]) {
          universe[uppercaseSym] = {
            symbol: uppercaseSym,
            name: info.name,
            sector: info.sector || "Miscellaneous",
            subSector: info.subSector || "",
            industry: info.subSector || "Miscellaneous",
            category: "A", // Default
            listingStatus: "Inert", // Default status, overridden by cache
            type: "Equity", // Default type, classified below
          };
        }
      }
    }

    // 2. Load from Default Seed (src/data/dseData.ts)
    if (DSE_COMPANIES) {
      for (const [sym, info] of Object.entries(DSE_COMPANIES)) {
        const uppercaseSym = sym.toUpperCase().trim();
        if (!universe[uppercaseSym]) {
          universe[uppercaseSym] = {
            symbol: uppercaseSym,
            name: info.name || `${uppercaseSym} Ltd.`,
            sector: info.sector || "Miscellaneous",
            subSector: info.subSector || "",
            industry: info.subSector || "Miscellaneous",
            category: "A",
            listingStatus: "Inert",
            type: "Equity",
          };
        }
      }
    }

    // 3. Scan History Directory to discover historical tickers
    const historyDir = path.join(process.cwd(), "data", "history", "stocks");
    if (fs.existsSync(historyDir)) {
      try {
        const files = fs.readdirSync(historyDir);
        files.forEach((f) => {
          if (f.toLowerCase().endsWith(".csv")) {
            const sym = f.slice(0, -4).toUpperCase().trim();
            if (!universe[sym]) {
              universe[sym] = {
                symbol: sym,
                name: `${sym} Ltd.`,
                sector: this.guessSectorBySymbol(sym),
                subSector: "Miscellaneous",
                industry: "Miscellaneous",
                category: "A",
                listingStatus: "Inert",
                type: "Equity",
              };
            }
          }
        });
      } catch (err) {
        console.warn("[DseUniverseService] Error scanning history folder:", err);
      }
    }

    // 4. Load from Live Scrape Cache (data/cache/dse-latest.json)
    let liveSymbols: Set<string> = new Set();
    try {
      const cache = loadLatestDseData();
      if (cache && cache.stocks) {
        for (const [sym, stock] of Object.entries(cache.stocks)) {
          const uppercaseSym = sym.toUpperCase().trim();
          liveSymbols.add(uppercaseSym);
          
          const s = stock as any;
          if (universe[uppercaseSym]) {
            universe[uppercaseSym].listingStatus = "Active";
            if (s.name && s.name !== `${uppercaseSym} Ltd.`) {
              universe[uppercaseSym].name = s.name;
            }
          } else {
            universe[uppercaseSym] = {
              symbol: uppercaseSym,
              name: s.name || `${uppercaseSym} Ltd.`,
              sector: s.sector || this.guessSectorBySymbol(uppercaseSym),
              subSector: s.subSector || "",
              industry: s.subSector || "Miscellaneous",
              category: "A",
              listingStatus: "Active",
              type: "Equity",
            };
          }
        }
      }
    } catch (err) {
      console.warn("[DseUniverseService] Error loading latest cache:", err);
    }

    // 5. Refine and classify security types & categories
    for (const [sym, sec] of Object.entries(universe)) {
      const uSym = sym.toUpperCase();
      
      // Determine listingStatus (Active if seen in recent cache, or has high-fidelity info)
      if (liveSymbols.has(uSym)) {
        sec.listingStatus = "Active";
      } else {
        // Check if there's any file under history stocks for it, in which case it is Suspended or Inert.
        const csvPath = path.join(historyDir, `${uSym}.csv`);
        if (fs.existsSync(csvPath)) {
          sec.listingStatus = "Suspended";
        } else {
          sec.listingStatus = "Inert";
        }
      }

      // Classify Type
      if (uSym.endsWith("MF") || uSym.includes("1JANATAMF") || sec.name.toLowerCase().includes("mutual fund") || sec.sector.toLowerCase() === "mutual funds") {
        sec.type = "Mutual Fund";
        sec.category = "A"; // Mutual funds are always treated as safe/A-class units by default
      } else if (uSym.endsWith("BOND") || sec.name.toLowerCase().includes("bond") || sec.sector.toLowerCase().includes("bond")) {
        sec.type = "Bond";
        sec.category = "Bond";
      } else if (uSym.endsWith("ETF") || sec.name.toLowerCase().includes("etf")) {
        sec.type = "ETF";
        sec.category = "A";
      } else if (uSym.includes("SME") || sec.sector.toLowerCase().includes("sme") || sec.subSector.toLowerCase().includes("sme")) {
        sec.type = "SME";
        sec.category = "SME";
      } else {
        sec.type = "Equity";
        // Assign categories based on some fundamental heuristics or default to A/B
        const seed = DSE_COMPANIES[uSym];
        if (seed) {
          if (seed.peRatio && seed.peRatio > 40) {
            sec.category = "B";
          } else if (seed.eps && seed.eps < 0) {
            sec.category = "Z";
          } else {
            sec.category = "A";
          }
        } else {
          sec.category = "A";
        }
      }
    }

    return universe;
  },

  getCompleteUniverseList(): UniverseSecurity[] {
    return Object.values(this.getCompleteUniverse());
  },

  getUniverseBySymbol(symbol: string): UniverseSecurity | null {
    const universe = this.getCompleteUniverse();
    return universe[symbol.toUpperCase().trim()] || null;
  },

  guessSectorBySymbol(sym: string): string {
    const s = sym.toUpperCase().trim();
    if (s.includes("BANK")) return "Bank";
    if (s.includes("PHARMA") || s.includes("CHEM")) return "Pharmaceuticals & Chemicals";
    if (s.includes("TEX") || s.includes("SPIN")) return "Textile";
    if (s.includes("INS")) return "Insurance";
    if (s.includes("POWER") || s.includes("ELECT")) return "Fuel & Power";
    if (s.includes("CEM")) return "Cement";
    if (s.includes("FOOD") || s.includes("BATBC")) return "Food & Allied";
    if (s.includes("TELECOM") || s.includes("GP")) return "Telecommunication";
    if (s.endsWith("MF")) return "Mutual Funds";
    if (s.endsWith("BOND")) return "Corporate Bond";
    return "Miscellaneous";
  }
};
