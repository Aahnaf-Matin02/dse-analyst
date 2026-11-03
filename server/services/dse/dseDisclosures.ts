import fs from "fs";
import path from "path";
import { DseRawCompanyDetail } from "./dseParser";

export interface Disclosure {
  id: string;
  symbol: string;
  companyName: string;
  disclosureDate: string;
  title: string;
  category: string;
  content: string;
  documentUrl?: string | null;
  sourceUrl: string;
  retrievedAt: string;
}

const STORAGE_DIR = path.join(process.cwd(), "data", "dse", "disclosures");

export class DseDisclosuresManager {
  private static cache: Map<string, Disclosure[]> = new Map();

  static ensureStorage(): void {
    if (!fs.existsSync(STORAGE_DIR)) {
      fs.mkdirSync(STORAGE_DIR, { recursive: true });
    }
  }

  static getDisclosures(symbol: string): Disclosure[] {
    const sym = symbol.toUpperCase().trim();
    if (this.cache.has(sym)) {
      return this.cache.get(sym)!;
    }

    const filePath = path.join(STORAGE_DIR, `${sym}.json`);
    if (fs.existsSync(filePath)) {
      try {
        const raw = fs.readFileSync(filePath, "utf-8");
        const list: Disclosure[] = JSON.parse(raw);
        this.cache.set(sym, list);
        return list;
      } catch {}
    }
    return [];
  }

  static updateFromCompanyDetail(detail: DseRawCompanyDetail, sourceUrl: string): number {
    this.ensureStorage();
    const sym = detail.code.toUpperCase().trim();
    const now = new Date().toISOString();

    if (!Array.isArray(detail.recentAnnouncements) || detail.recentAnnouncements.length === 0) {
      return 0;
    }

    const existing = this.getDisclosures(sym);
    const existingIds = new Set(existing.map(d => d.id));
    const newItems: Disclosure[] = [...existing];
    let inserted = 0;

    for (const ann of detail.recentAnnouncements) {
      const id = ann.id ? `DSE_${ann.id}` : `${sym}_${ann.date}_${ann.summary.substring(0, 20)}`;
      if (!existingIds.has(id)) {
        existingIds.add(id);
        const docMatch = ann.body.match(/https?:\/\/[^\s)]+\.pdf/i);
        newItems.unshift({
          id,
          symbol: sym,
          companyName: detail.name,
          disclosureDate: ann.date,
          title: ann.summary || "Company Announcement",
          category: ann.type || "Notice",
          content: ann.body,
          documentUrl: docMatch ? docMatch[0] : null,
          sourceUrl,
          retrievedAt: now
        });
        inserted++;
      }
    }

    this.cache.set(sym, newItems);
    try {
      fs.writeFileSync(path.join(STORAGE_DIR, `${sym}.json`), JSON.stringify(newItems, null, 2), "utf-8");
    } catch (e) {
      console.error(`[DseDisclosuresManager] Failed to write disclosures for ${sym}:`, e);
    }

    return inserted;
  }

  static getTotalCount(): number | null {
    this.ensureStorage();
    if (!fs.existsSync(STORAGE_DIR)) return null;
    try {
      const files = fs.readdirSync(STORAGE_DIR).filter(f => f.endsWith(".json"));
      if (files.length === 0) return null;
      let total = 0;
      for (const f of files) {
        const sym = f.replace(".json", "");
        const list = this.getDisclosures(sym);
        total += list.length;
      }
      return total > 0 ? total : null;
    } catch {
      return null;
    }
  }
}
