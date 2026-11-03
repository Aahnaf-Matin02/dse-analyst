import fs from "fs";
import path from "path";
import {
  ensureAllDirectoriesExist,
  HistoryRow,
  HistorySource,
  parseHistoryCSV,
  saveManyStockHistoryRows,
  pruneToOneYear
} from "../server/repositories/historicalRepository";

const RAW_STOCKS_DIR = path.join(process.cwd(), "data", "history", "imports", "stocks");
const RAW_INDICES_DIR = path.join(process.cwd(), "data", "history", "imports", "indices");
const OUTPUT_STOCKS_DIR = path.join(process.cwd(), "data", "history", "stocks");
const OUTPUT_INDICES_DIR = path.join(process.cwd(), "data", "history", "indices");
const SUMMARY_FILE = path.join(process.cwd(), "data", "history", "processed", "one-year-history-summary.json");

// Helper to normalize volume strings (e.g., "1.2M", "500K", "150,000")
function parseVolume(volStr: string): number {
  if (!volStr) return 0;
  const clean = volStr.trim().toUpperCase().replace(/,/g, "");
  if (clean === "-" || clean === "") return 0;

  if (clean.endsWith("M")) {
    return Math.floor(parseFloat(clean.slice(0, -1)) * 1000000);
  }
  if (clean.endsWith("K")) {
    return Math.floor(parseFloat(clean.slice(0, -1)) * 1000);
  }
  if (clean.endsWith("B")) {
    return Math.floor(parseFloat(clean.slice(0, -1)) * 1000000000);
  }
  const num = parseInt(clean, 10);
  return isNaN(num) ? 0 : num;
}

// Convert month string dates like "Jun 03, 2025" or custom ISO formats to YYYY-MM-DD
function parseDate(dateStr: string): string | null {
  if (!dateStr) return null;
  const clean = dateStr.trim();
  // Standard format check
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
    return clean;
  }

  // Fallback Month-Day-Year parsing (relying on standard Date library parsing)
  const d = new Date(clean);
  if (!isNaN(d.getTime())) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  return null;
}

// Cleans numbers with potential commas
function parseCleanFloat(valStr: string): number | null {
  if (!valStr || valStr.trim() === "" || valStr.trim() === "null") return null;
  const clean = valStr.trim().replace(/,/g, "");
  const num = parseFloat(clean);
  return isNaN(num) ? null : num;
}

function processCSVFile(filePath: string, symbol: string, isIndex: boolean): { processedRows: number; errorsCount: number; errors: string[] } {
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length <= 1) {
    return { processedRows: 0, errorsCount: 0, errors: [] };
  }

  const headerRaw = lines[0].trim();
  const headerCols = headerRaw.split(",").map(c => c.trim().toLowerCase());

  let processedRows = 0;
  let errorsCount = 0;
  const errors: string[] = [];

  const rows: HistoryRow[] = [];

  // Determine format
  const isInvestingStyle = headerCols.includes("price") && headerCols.includes("date") && !headerCols.includes("symbol");

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const cols = line.split(",").map(c => c.trim());

    let dateRaw = "";
    let openStr = "";
    let highStr = "";
    let lowStr = "";
    let closeStr = "";
    let volStr = "";
    let sourceStr = "ImportedHistoricalCSV";

    if (isInvestingStyle) {
      // Investing.com CSV structure can contain comma in date which would break split(",") if enclosed in strings!
      // Example: "Jun 03, 2025,282.20,280.50,285.00,278.00,1.2M"
      // If we did split(","), "Jun 03" and " 2025" are separated because of comma.
      // Let's resolve dates with strings or rejoin splits
      // Simple quote-based capture regex or split rejoining:
      let columnsParsed: string[] = [];
      if (line.includes('"')) {
        // Handling quotes
        const match = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);
        if (match) {
          columnsParsed = match.map(m => m.replace(/"/g, "").trim());
        } else {
          columnsParsed = cols;
        }
      } else {
        // May contain "Jun 03, 2025"
        // Let's check headers indexes. Typically: Date, Price (Close), Open, High, Low, Vol., Change %
        // If first column contains letters and second column contains four digits, then the date is split
        const isDateSplit = isNaN(parseFloat(cols[0])) && cols[1] && /^\d{4}$/.test(cols[1].trim());
        if (isDateSplit) {
          dateRaw = `${cols[0]}, ${cols[1]}`;
          // Shift cols left to match header indices
          columnsParsed = [dateRaw, ...cols.slice(2)];
        } else {
          columnsParsed = cols;
        }
      }

      dateRaw = columnsParsed[0] || "";
      closeStr = columnsParsed[1] || "";
      openStr = columnsParsed[2] || "";
      highStr = columnsParsed[3] || "";
      lowStr = columnsParsed[4] || "";
      volStr = columnsParsed[5] || "";
    } else {
      // Standard structure: date,symbol,open,high,low,close,volume,source
      // Map header indices
      const indices: Record<string, number> = {};
      headerCols.forEach((col, idx) => {
        indices[col] = idx;
      });

      const getColVal = (name: string): string => {
        const id = indices[name];
        return id !== undefined && id < cols.length ? cols[id] : "";
      };

      dateRaw = getColVal("date") || cols[0];
      openStr = getColVal("open") || cols[2];
      highStr = getColVal("high") || cols[3];
      lowStr = getColVal("low") || cols[4];
      closeStr = getColVal("close") || cols[5];
      volStr = getColVal("volume") || cols[6];
      sourceStr = getColVal("source") || "ImportedHistoricalCSV";
    }

    const date = parseDate(dateRaw);
    if (!date) {
      errorsCount++;
      errors.push(`Row ${i + 1}: Unresolvable date string value: "${dateRaw}"`);
      continue;
    }

    const open = parseCleanFloat(openStr);
    const high = parseCleanFloat(highStr);
    const low = parseCleanFloat(lowStr);
    const close = parseCleanFloat(closeStr);
    const volume = parseVolume(volStr);

    // Business validation checks:
    if (close === null || isNaN(close)) {
      errorsCount++;
      errors.push(`Row ${i + 1} (${date}): Close pricing is missing or non-numeric`);
      continue;
    }

    rows.push({
      date,
      symbol,
      open: open ?? close, // fallback open to close if missing
      high: high ?? close,
      low: low ?? close,
      close,
      ltp: close,
      ycp: null,
      change: null,
      changePercent: null,
      volume,
      value: null,
      trade: null,
      source: sourceStr as HistorySource,
      snapshotType: "Imported" as const,
      lastUpdated: new Date().toISOString()
    });

    processedRows++;
  }

  if (rows.length > 0) {
    saveManyStockHistoryRows(rows);
  }

  return { processedRows, errorsCount, errors };
}

export function runPastOneYearImport(): void {
  ensureAllDirectoriesExist();

  console.log("=== Starting 1-Year Historical Backfill Importer ===");

  const report = {
    startedAt: new Date().toISOString(),
    stocksProcessed: 0,
    indicesProcessed: 0,
    totalRowsSavedCount: 0,
    totalErrorsCount: 0,
    filesSucceeded: [] as string[],
    filesFailed: [] as string[],
    details: [] as any[]
  };

  // 1. Process Stock CSV files
  if (fs.existsSync(RAW_STOCKS_DIR)) {
    const files = fs.readdirSync(RAW_STOCKS_DIR).filter(f => f.toLowerCase().endsWith(".csv"));
    files.forEach(file => {
      const sym = file.slice(0, -4).toUpperCase();
      const filePath = path.join(RAW_STOCKS_DIR, file);
      try {
        const stats = processCSVFile(filePath, sym, false);
        // Prune the compiled stock to the last 1 year
        pruneToOneYear(sym);

        report.stocksProcessed++;
        report.totalRowsSavedCount += stats.processedRows;
        report.totalErrorsCount += stats.errorsCount;
        report.filesSucceeded.push(file);

        report.details.push({
          file,
          symbol: sym,
          type: "stock",
          rowsLoaded: stats.processedRows,
          errorsCount: stats.errorsCount,
          errorsSample: stats.errors.slice(0, 5)
        });
      } catch (err: any) {
        report.totalErrorsCount++;
        report.filesFailed.push(file);
        report.details.push({
          file,
          symbol: sym,
          type: "stock",
          status: "exception",
          error: err.message
        });
      }
    });
  }

  // 2. Process Index CSV files
  if (fs.existsSync(RAW_INDICES_DIR)) {
    const files = fs.readdirSync(RAW_INDICES_DIR).filter(f => f.toLowerCase().endsWith(".csv"));
    files.forEach(file => {
      const sym = file.slice(0, -4).toUpperCase();
      const filePath = path.join(RAW_INDICES_DIR, file);
      try {
        const stats = processCSVFile(filePath, sym, true);
        // Prune the index to the last 1-year
        pruneToOneYear(sym);

        report.indicesProcessed++;
        report.totalRowsSavedCount += stats.processedRows;
        report.totalErrorsCount += stats.errorsCount;
        report.filesSucceeded.push(file);

        report.details.push({
          file,
          symbol: sym,
          type: "index",
          rowsLoaded: stats.processedRows,
          errorsCount: stats.errorsCount,
          errorsSample: stats.errors.slice(0, 5)
        });
      } catch (err: any) {
        report.totalErrorsCount++;
        report.filesFailed.push(file);
        report.details.push({
          file,
          symbol: sym,
          type: "index",
          status: "exception",
          error: err.message
        });
      }
    });
  }

  // Write Summary File
  const finishedAt = new Date().toISOString();
  const summaryData = {
    ...report,
    finishedAt,
    completionPercentage: report.filesSucceeded.length / Math.max(1, (report.filesSucceeded.length + report.filesFailed.length)) * 100
  };

  fs.writeFileSync(SUMMARY_FILE, JSON.stringify(summaryData, null, 2), "utf-8");
  console.log(`=== Backfill Complete! Processed ${report.stocksProcessed} stocks and ${report.indicesProcessed} indices. Total rows saved: ${report.totalRowsSavedCount}. Errors: ${report.totalErrorsCount} ===`);
}

// If run directly as a script
if (require.main === module) {
  runPastOneYearImport();
}
