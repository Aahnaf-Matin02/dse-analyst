import fs from "fs";
import path from "path";
import { DseRawCompanyDetail, DseRawSharePattern } from "./dseParser";

export interface Shareholding {
  symbol: string;
  reportingDate: string;
  sponsorDirector: number | null;
  government: number | null;
  institution: number | null;
  foreign: number | null;
  public: number | null;
  total: number;
  source: "DSE_OFFICIAL" | "LOCAL_DEVELOPMENT_FALLBACK";
  sourceUrl: string;
  retrievedAt: string;
}

const STORAGE_DIR = path.join(process.cwd(), "data", "dse", "shareholding");

export class DseShareholdingManager {
  private static cache: Map<string, Shareholding[]> = new Map();

  static ensureStorage(): void {
    if (!fs.existsSync(STORAGE_DIR)) {
      fs.mkdirSync(STORAGE_DIR, { recursive: true });
    }
  }

  static getShareholding(symbol: string): Shareholding[] {
    const sym = symbol.toUpperCase().trim();
    if (this.cache.has(sym)) {
      return this.cache.get(sym)!;
    }

    const filePath = path.join(STORAGE_DIR, `${sym}.json`);
    if (fs.existsSync(filePath)) {
      try {
        const raw = fs.readFileSync(filePath, "utf-8");
        const list: Shareholding[] = JSON.parse(raw);
        this.cache.set(sym, list);
        return list;
      } catch {}
    }
    return [];
  }

  static getLatestShareholding(symbol: string): Shareholding | null {
    const list = this.getShareholding(symbol);
    return list.length > 0 ? list[0] : null;
  }

  /**
   * Updates official shareholding pattern from DSE company detail.
   * Never uses estimated or invented ownership percentages.
   */
  static updateFromCompanyDetail(detail: DseRawCompanyDetail, sourceUrl: string): void {
    this.ensureStorage();
    const sym = detail.code.toUpperCase().trim();
    const now = new Date().toISOString();

    if (!Array.isArray(detail.sharePattern) || detail.sharePattern.length === 0) {
      return;
    }

    const list: Shareholding[] = detail.sharePattern.map((p) => {
      const pat = p.pattern || {};
      const sponsor = typeof pat.sponsor === "number" ? pat.sponsor : null;
      const gov = typeof pat.government === "number" ? pat.government : null;
      const inst = typeof pat.institution === "number" ? pat.institution : null;
      const foreign = typeof pat.foreign === "number" ? pat.foreign : null;
      const pub = typeof pat.public === "number" ? pat.public : null;
      const total = [sponsor, gov, inst, foreign, pub].filter((v): v is number => v !== null).reduce((a, b) => a + b, 0);

      return {
        symbol: sym,
        reportingDate: p.date || now.split("T")[0],
        sponsorDirector: sponsor,
        government: gov,
        institution: inst,
        foreign: foreign,
        public: pub,
        total: parseFloat(total.toFixed(2)),
        source: "DSE_OFFICIAL",
        sourceUrl,
        retrievedAt: now
      };
    });

    this.cache.set(sym, list);
    try {
      fs.writeFileSync(path.join(STORAGE_DIR, `${sym}.json`), JSON.stringify(list, null, 2), "utf-8");
    } catch (e) {
      console.error(`[DseShareholdingManager] Failed to write shareholding for ${sym}:`, e);
    }
  }
}
