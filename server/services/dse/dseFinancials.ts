import fs from "fs";
import path from "path";
import { DseRawCompanyDetail, DseRawUniverseItem } from "./dseParser";

export interface FinancialStatement {
  symbol: string;
  periodType: "Annual" | "Quarterly" | "Half-Yearly";
  fiscalYear: number;
  periodEndDate: string;
  publicationDate?: string | null;
  revenue: number | null;
  grossProfit: number | null;
  operatingProfit: number | null;
  profitBeforeTax: number | null;
  netProfit: number | null;
  eps: number | null;
  operatingCashFlow: number | null;
  investingCashFlow: number | null;
  financingCashFlow: number | null;
  totalAssets: number | null;
  totalLiabilities: number | null;
  totalEquity: number | null;
  source: "DSE_OFFICIAL" | "LOCAL_DEVELOPMENT_FALLBACK";
  sourceUrl: string;
  retrievedAt: string;
}

export interface DSEReportedRatio {
  symbol: string;
  period: string;
  peRatio: number | null;
  pbRatio: number | null;
  roe: number | null;
  roa: number | null;
  eps: number | null;
  nav: number | null;
  dividendYield: number | null;
  otherRatios?: Record<string, number | null>;
  source: "DSE_OFFICIAL" | "LOCAL_DEVELOPMENT_FALLBACK";
  sourceUrl: string;
  retrievedAt: string;
}

export interface CalculatedRatio {
  symbol: string;
  period: string;
  metric: string;
  value: number | null;
  calculationFormula: string;
  inputSources: string[];
  calculatedAt: string;
}

const STORAGE_DIR = path.join(process.cwd(), "data", "dse", "financials");

export class DseFinancialsManager {
  private static statementsCache: Map<string, FinancialStatement[]> = new Map();
  private static reportedRatiosCache: Map<string, DSEReportedRatio> = new Map();

  static ensureStorage(): void {
    if (!fs.existsSync(STORAGE_DIR)) {
      fs.mkdirSync(STORAGE_DIR, { recursive: true });
    }
  }

  static getReportedRatios(symbol: string): DSEReportedRatio | null {
    const sym = symbol.toUpperCase().trim();
    if (this.reportedRatiosCache.has(sym)) {
      return this.reportedRatiosCache.get(sym)!;
    }

    const filePath = path.join(STORAGE_DIR, `${sym}_ratios.json`);
    if (fs.existsSync(filePath)) {
      try {
        const raw = fs.readFileSync(filePath, "utf-8");
        const ratio: DSEReportedRatio = JSON.parse(raw);
        this.reportedRatiosCache.set(sym, ratio);
        return ratio;
      } catch {}
    }
    return null;
  }

  static getFinancialStatements(symbol: string): FinancialStatement[] {
    const sym = symbol.toUpperCase().trim();
    if (this.statementsCache.has(sym)) {
      return this.statementsCache.get(sym)!;
    }

    const filePath = path.join(STORAGE_DIR, `${sym}_statements.json`);
    if (fs.existsSync(filePath)) {
      try {
        const raw = fs.readFileSync(filePath, "utf-8");
        const list: FinancialStatement[] = JSON.parse(raw);
        this.statementsCache.set(sym, list);
        return list;
      } catch {}
    }
    return [];
  }

  /**
   * Updates reported ratios from official DSE universe or detail item.
   * Never fabricates missing PE, EPS, NAV, or Dividend Yield.
   */
  static updateReportedRatios(item: {
    symbol: string;
    peRatio: number | null;
    eps: number | null;
    nav: number | null;
    dividendYield: number | null;
    period?: string;
    sourceUrl: string;
  }): void {
    this.ensureStorage();
    const sym = item.symbol.toUpperCase().trim();
    const now = new Date().toISOString();

    const ratio: DSEReportedRatio = {
      symbol: sym,
      period: item.period || now.split("T")[0],
      peRatio: typeof item.peRatio === "number" && !isNaN(item.peRatio) ? item.peRatio : null,
      pbRatio: null,
      roe: null,
      roa: null,
      eps: typeof item.eps === "number" && !isNaN(item.eps) ? item.eps : null,
      nav: typeof item.nav === "number" && !isNaN(item.nav) ? item.nav : null,
      dividendYield: typeof item.dividendYield === "number" && !isNaN(item.dividendYield) ? item.dividendYield : null,
      source: "DSE_OFFICIAL",
      sourceUrl: item.sourceUrl,
      retrievedAt: now
    };

    this.reportedRatiosCache.set(sym, ratio);
    try {
      fs.writeFileSync(path.join(STORAGE_DIR, `${sym}_ratios.json`), JSON.stringify(ratio, null, 2), "utf-8");
    } catch (e) {
      console.error(`[DseFinancialsManager] Failed to write ratios for ${sym}:`, e);
    }
  }

  /**
   * Stores official multi-year and interim financial statements from DSE company page.
   */
  static updateFromCompanyDetail(detail: DseRawCompanyDetail, sourceUrl: string): void {
    this.ensureStorage();
    const sym = detail.code.toUpperCase().trim();
    const now = new Date().toISOString();

    // 1. Reported Ratios
    this.updateReportedRatios({
      symbol: sym,
      peRatio: detail.pe,
      eps: detail.eps,
      nav: detail.nav ?? detail.bookValue,
      dividendYield: detail.dividendYield,
      period: detail.asOfDate || now.split("T")[0],
      sourceUrl
    });

    // 2. Financial Statements from multiYearFinancials
    const statements: FinancialStatement[] = [];
    if (Array.isArray(detail.multiYearFinancials)) {
      for (const row of detail.multiYearFinancials) {
        if (row && row.year) {
          const stmt: FinancialStatement = {
            symbol: sym,
            periodType: "Annual",
            fiscalYear: parseInt(row.year, 10) || new Date().getFullYear(),
            periodEndDate: `${row.year}-12-31`,
            publicationDate: null,
            revenue: null,
            grossProfit: null,
            operatingProfit: null,
            profitBeforeTax: null,
            netProfit: typeof row.profit === "number" ? row.profit : (typeof row.profitForYear === "number" ? row.profitForYear : null),
            eps: typeof row.epsBasic === "number" ? row.epsBasic : null,
            operatingCashFlow: null,
            investingCashFlow: null,
            financingCashFlow: null,
            totalAssets: null,
            totalLiabilities: null,
            totalEquity: typeof row.nav === "number" && typeof detail.paidUpCapital === "number" && typeof detail.faceValue === "number" && detail.faceValue > 0
              ? (row.nav * (detail.paidUpCapital / detail.faceValue))
              : null,
            source: "DSE_OFFICIAL",
            sourceUrl,
            retrievedAt: now
          };
          statements.push(stmt);
        }
      }
    }

    if (statements.length > 0) {
      this.statementsCache.set(sym, statements);
      try {
        fs.writeFileSync(path.join(STORAGE_DIR, `${sym}_statements.json`), JSON.stringify(statements, null, 2), "utf-8");
      } catch (e) {
        console.error(`[DseFinancialsManager] Failed to write statements for ${sym}:`, e);
      }
    }
  }

  static getPopulatedCount(): number | null {
    this.ensureStorage();
    if (!fs.existsSync(STORAGE_DIR)) return null;
    try {
      const files = fs.readdirSync(STORAGE_DIR);
      const symbolsWithData = new Set<string>();
      for (const f of files) {
        if (f.endsWith("_ratios.json")) {
          const sym = f.replace("_ratios.json", "");
          const ratio = this.getReportedRatios(sym);
          if (ratio && (ratio.peRatio !== null || ratio.eps !== null || ratio.nav !== null || ratio.dividendYield !== null)) {
            symbolsWithData.add(sym);
          }
        } else if (f.endsWith("_statements.json")) {
          const sym = f.replace("_statements.json", "");
          const stmts = this.getFinancialStatements(sym);
          if (stmts && stmts.length > 0) {
            symbolsWithData.add(sym);
          }
        }
      }
      return symbolsWithData.size > 0 ? symbolsWithData.size : null;
    } catch {
      return null;
    }
  }
}
