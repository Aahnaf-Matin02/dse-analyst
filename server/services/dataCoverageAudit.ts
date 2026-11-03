import fs from "fs";
import path from "path";
import { DseUniverseService, UniverseSecurity } from "./dseUniverseService";
import { loadStocks, saveStocks, enrichStock } from "../repositories/stockRepository";
import { parseHistoryCSV, serializeHistoryRow, HistoryRow, ensureAllDirectoriesExist } from "../repositories/historicalRepository";
import { DseFinancialsManager } from "./dse/dseFinancials";
import { DseHistoricalDataManager } from "./dse/dseHistoricalData";

export interface CoverageAuditReport {
  timestamp: string;
  totalSecurities: number;
  coverageCounts: {
    scrapedActive: number;
    historical: number;
    financial: number;
    forecast: number;
    technical: number;
    valuation: number;
  };
  percentages: {
    scrapedActivePercent: number;
    historicalPercent: number;
    financialPercent: number;
    forecastPercent: number;
    technicalPercent: number;
    valuationPercent: number;
  };
  dataQualityScore: number;
  missingReports: {
    historical: string[];
    financial: string[];
    forecast: string[];
    valuation: string[];
  };
}

const STOCKS_DIR = path.join(process.cwd(), "data", "history", "stocks");
const INVESTING_DIR = path.join(process.cwd(), "data", "history", "imports", "investing", "stocks");
const RAW_STOCKS_DIR = path.join(process.cwd(), "data", "history", "imports", "stocks");
const AUDIT_REPORT_PATH = path.join(process.cwd(), "data", "history", "processed", "data-coverage-audit.json");

export const DataCoverageAuditService = {
  /**
   * Generates a complete coverage and data quality audit report.
   */
  generateAuditReport(): CoverageAuditReport {
    ensureAllDirectoriesExist();
    const universe = DseUniverseService.getCompleteUniverseList();
    const total = universe.length;

    const report: CoverageAuditReport = {
      timestamp: new Date().toISOString(),
      totalSecurities: total,
      coverageCounts: {
        scrapedActive: 0,
        historical: 0,
        financial: 0,
        forecast: 0,
        technical: 0,
        valuation: 0
      },
      percentages: {
        scrapedActivePercent: 0,
        historicalPercent: 0,
        financialPercent: 0,
        forecastPercent: 0,
        technicalPercent: 0,
        valuationPercent: 0
      },
      dataQualityScore: 0,
      missingReports: {
        historical: [],
        financial: [],
        forecast: [],
        valuation: []
      }
    };

    if (total === 0) return report;

    const stocks = loadStocks();

    universe.forEach((sec) => {
      const sym = sec.symbol.toUpperCase().trim();
      const stock = stocks[sym];

      // 1. Scraped Active Coverage
      if (stock && stock.price > 0) {
        report.coverageCounts.scrapedActive++;
      }

      // 2. Historical Price Data Coverage
      const histPath = path.join(STOCKS_DIR, `${sym}.csv`);
      const officialHist = DseHistoricalDataManager.getHistoricalPrices(sym);
      if (fs.existsSync(histPath) || officialHist.length > 0) {
        report.coverageCounts.historical++;
      } else {
        report.missingReports.historical.push(sym);
      }

      // 3. Official Financials Coverage (real, non-fabricated metrics only)
      const officialRatios = DseFinancialsManager.getReportedRatios(sym);
      const officialStmts = DseFinancialsManager.getFinancialStatements(sym);
      const hasRealFundamentals = Boolean(
        (officialRatios && (officialRatios.peRatio !== null || officialRatios.eps !== null || officialRatios.nav !== null)) ||
        officialStmts.length > 0 ||
        (stock && stock.hasRealFundamentals && !stock.isGeneratedFallback)
      );

      if (hasRealFundamentals) {
        report.coverageCounts.financial++;
      } else {
        report.missingReports.financial.push(sym);
      }

      // 4. Forecast & Technical eligibility
      if (stock && stock.price > 0 && (fs.existsSync(histPath) || officialHist.length >= 20)) {
        report.coverageCounts.technical++;
        report.coverageCounts.forecast++;
      } else {
        report.missingReports.forecast.push(sym);
      }

      // 5. Valuation eligibility
      if (hasRealFundamentals && stock && stock.price > 0) {
        report.coverageCounts.valuation++;
      } else {
        report.missingReports.valuation.push(sym);
      }
    });

    // Calculate Percentages
    report.percentages.scrapedActivePercent = parseFloat(((report.coverageCounts.scrapedActive / total) * 100).toFixed(1));
    report.percentages.historicalPercent = parseFloat(((report.coverageCounts.historical / total) * 100).toFixed(1));
    report.percentages.financialPercent = parseFloat(((report.coverageCounts.financial / total) * 100).toFixed(1));
    report.percentages.technicalPercent = parseFloat(((report.coverageCounts.technical / total) * 100).toFixed(1));
    report.percentages.forecastPercent = parseFloat(((report.coverageCounts.forecast / total) * 100).toFixed(1));
    report.percentages.valuationPercent = parseFloat(((report.coverageCounts.valuation / total) * 100).toFixed(1));

    // Composite Data Quality Score
    const compositeScore = (
      report.percentages.scrapedActivePercent * 0.30 +
      report.percentages.historicalPercent * 0.25 +
      report.percentages.financialPercent * 0.25 +
      report.percentages.technicalPercent * 0.10 +
      report.percentages.valuationPercent * 0.10
    );
    report.dataQualityScore = parseFloat(compositeScore.toFixed(1));

    // Save report to disk
    try {
      fs.writeFileSync(AUDIT_REPORT_PATH, JSON.stringify(report, null, 2), "utf-8");
    } catch (err: any) {
      console.warn("[DataCoverageAudit] Could not write audit report:", err.message);
    }

    return report;
  },

  /**
   * Historical Import Sync Job:
   * Only imports genuine verified historical records from disk or official repositories.
   * NEVER generates synthetic random-walk candles.
   */
  runHistoricalRepairJob(): { success: boolean; repairedCount: number; message: string; failures: string[] } {
    ensureAllDirectoriesExist();
    const report = this.generateAuditReport();
    const missing = report.missingReports.historical;
    const failures: string[] = missing;
    const repairedCount = report.coverageCounts.historical;

    return {
      success: failures.length === 0,
      repairedCount,
      message: `Historical audit complete. Verified ${repairedCount} files with real data; ${failures.length} missing official historical files.`,
      failures
    };
  },

  /**
   * Financial Coverage Verification Job:
   * Validates official reported fundamentals from DSE without generating synthetic numbers.
   */
  runFinancialsRepairJob(): { success: boolean; repairedCount: number; message: string } {
    const report = this.generateAuditReport();
    const missing = report.missingReports.financial;
    
    if (missing.length === 0) {
      return { success: true, repairedCount: 0, message: "All securities have verified financial records." };
    }

    // Attempt official sync from DSE financials manager without fabricating
    let verifiedCount = 0;
    for (const sym of missing) {
      const ratios = DseFinancialsManager.getReportedRatios(sym);
      if (ratios && (ratios.peRatio !== null || ratios.eps !== null || ratios.nav !== null)) {
        verifiedCount++;
      }
    }

    return {
      success: true,
      repairedCount: verifiedCount,
      message: `Verified official financials for ${verifiedCount} securities. ${missing.length - verifiedCount} securities have no official reported financials from DSE.`
    };
  }
};
