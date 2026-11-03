import fs from "fs";
import path from "path";
import { DseRawCompanyDetail } from "./dseParser";

export interface CorporateAction {
  id: string;
  symbol: string;
  actionType: "CASH_DIVIDEND" | "STOCK_DIVIDEND" | "RIGHTS_ISSUE" | "BONUS_SHARE" | "AGM_DATE" | "RECORD_DATE" | "OTHER";
  announcementDate: string;
  recordDate?: string | null;
  effectiveDate?: string | null;
  ratio?: string | null;
  cashAmount?: number | null;
  percentage?: number | null;
  description: string;
  source: "DSE_OFFICIAL" | "LOCAL_DEVELOPMENT_FALLBACK";
  sourceUrl: string;
  retrievedAt: string;
}

const STORAGE_DIR = path.join(process.cwd(), "data", "dse", "corporate-actions");

export class DseCorporateActionsManager {
  private static cache: Map<string, CorporateAction[]> = new Map();

  static ensureStorage(): void {
    if (!fs.existsSync(STORAGE_DIR)) {
      fs.mkdirSync(STORAGE_DIR, { recursive: true });
    }
  }

  static getCorporateActions(symbol: string): CorporateAction[] {
    const sym = symbol.toUpperCase().trim();
    if (this.cache.has(sym)) {
      return this.cache.get(sym)!;
    }

    const filePath = path.join(STORAGE_DIR, `${sym}.json`);
    if (fs.existsSync(filePath)) {
      try {
        const raw = fs.readFileSync(filePath, "utf-8");
        const list: CorporateAction[] = JSON.parse(raw);
        this.cache.set(sym, list);
        return list;
      } catch {}
    }
    return [];
  }

  static updateFromCompanyDetail(detail: DseRawCompanyDetail, sourceUrl: string): void {
    this.ensureStorage();
    const sym = detail.code.toUpperCase().trim();
    const now = new Date().toISOString();
    const actions: CorporateAction[] = [];

    // 1. From dividend history
    if (Array.isArray(detail.dividendHistory)) {
      for (const d of detail.dividendHistory) {
        if (d && d.year) {
          if (d.cash && d.cash > 0) {
            actions.push({
              id: `${sym}_CASH_${d.year}`,
              symbol: sym,
              actionType: "CASH_DIVIDEND",
              announcementDate: `${d.year}-12-31`,
              cashAmount: d.cash,
              percentage: d.cash,
              description: `${d.cash}% Cash Dividend for FY ${d.year}`,
              source: "DSE_OFFICIAL",
              sourceUrl,
              retrievedAt: now
            });
          }
          if (d.stock && d.stock > 0) {
            actions.push({
              id: `${sym}_STOCK_${d.year}`,
              symbol: sym,
              actionType: "STOCK_DIVIDEND",
              announcementDate: `${d.year}-12-31`,
              percentage: d.stock,
              description: `${d.stock}% Stock Dividend for FY ${d.year}`,
              source: "DSE_OFFICIAL",
              sourceUrl,
              retrievedAt: now
            });
          }
        }
      }
    }

    // 2. From recent announcements (Dividends, AGM)
    if (Array.isArray(detail.recentAnnouncements)) {
      for (const ann of detail.recentAnnouncements) {
        if (ann.type === "Dividend") {
          const recMatch = ann.body.match(/Record Date:\s*([0-9.]+)/i);
          actions.push({
            id: ann.id ? `DSE_${ann.id}` : `${sym}_${ann.date}_${actions.length}`,
            symbol: sym,
            actionType: "CASH_DIVIDEND",
            announcementDate: ann.date,
            recordDate: recMatch ? recMatch[1] : null,
            description: ann.summary || ann.body.substring(0, 120),
            source: "DSE_OFFICIAL",
            sourceUrl,
            retrievedAt: now
          });
        }
      }
    }

    if (actions.length > 0) {
      this.cache.set(sym, actions);
      try {
        fs.writeFileSync(path.join(STORAGE_DIR, `${sym}.json`), JSON.stringify(actions, null, 2), "utf-8");
      } catch (e) {
        console.error(`[DseCorporateActionsManager] Failed to write corporate actions for ${sym}:`, e);
      }
    }
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
        const list = this.getCorporateActions(sym);
        total += list.length;
      }
      return total > 0 ? total : null;
    } catch {
      return null;
    }
  }
}
