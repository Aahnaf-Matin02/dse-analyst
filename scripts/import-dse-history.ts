import fs from "fs";
import path from "path";
import { saveManyStockHistoryRows, HistoryRow } from "../server/repositories/historicalRepository";

const RAW_CSV_PATH = path.join(process.cwd(), "data", "history", "imports", "dse-history.csv");
const SUMMARY_PATH = path.join(process.cwd(), "data", "history", "processed", "history-summary.json");
const PROCESSED_DIR = path.join(process.cwd(), "data", "history", "processed");

function validateHistoryRows(parsedRows: any[]): { valid: HistoryRow[]; invalid: any[]; errors: string[] } {
  const valid: HistoryRow[] = [];
  const invalid: any[] = [];
  const errors: string[] = [];

  for (const row of parsedRows) {
    const symbol = (row.symbol || "").toUpperCase().trim();
    const date = (row.date || "").trim();
    const close = parseFloat(row.close);
    const open = parseFloat(row.open || row.close);
    const high = parseFloat(row.high || row.close);
    const low = parseFloat(row.low || row.close);
    const volume = parseInt(row.volume || "0", 10);

    if (!symbol || !date || isNaN(close)) {
      invalid.push(row);
      errors.push(`Invalid syntax for row: ${JSON.stringify(row)}`);
      continue;
    }

    const validRow: HistoryRow = {
      date,
      symbol,
      open: isNaN(open) ? close : open,
      high: isNaN(high) ? close : high,
      low: isNaN(low) ? close : low,
      close,
      ltp: close,
      ycp: close,
      change: 0,
      changePercent: 0,
      volume: isNaN(volume) ? 0 : volume,
      value: 0,
      trade: 0,
      source: "ImportedHistoricalCSV",
      snapshotType: "Imported",
      lastUpdated: new Date().toISOString()
    };
    valid.push(validRow);
  }

  return { valid, invalid, errors };
}

function ensureDirectoryExistence(filePath: string) {
  const dirname = path.dirname(filePath);
  if (!fs.existsSync(dirname)) {
    fs.mkdirSync(dirname, { recursive: true });
  }
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function runImport() {
  console.log(`[Import Script] Starting historical data bulk import...`);
  console.log(`[Import Script] Reading raw CSV from: ${RAW_CSV_PATH}`);

  if (!fs.existsSync(RAW_CSV_PATH)) {
    console.error(`[Import Script] ERROR: Raw CSV file not found at ${RAW_CSV_PATH}.`);
    process.exit(1);
  }

  const rawContent = fs.readFileSync(RAW_CSV_PATH, "utf-8");
  const lines = rawContent.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

  if (lines.length === 0) {
    console.error(`[Import Script] ERROR: Root CSV file is empty.`);
    process.exit(1);
  }

  // 1. Parse header row
  const rawHeaders = parseCSVLine(lines[0]);
  console.log(`[Import Script] Identified columns: ${rawHeaders.join(" | ")}`);

  // Map header indexes
  let indexSymbol = -1;
  let indexDate = -1;
  let indexOpen = -1;
  let indexHigh = -1;
  let indexLow = -1;
  let indexClose = -1;
  let indexVolume = -1;
  let indexSource = -1;

  for (let i = 0; i < rawHeaders.length; i++) {
    const h = rawHeaders[i].toLowerCase().trim();
    if (h === "trading code" || h === "symbol" || h === "ticker") indexSymbol = i;
    else if (h === "date" || h === "timestamp") indexDate = i;
    else if (h === "open" || h === "open_price") indexOpen = i;
    else if (h === "high" || h === "high_price") indexHigh = i;
    else if (h === "low" || h === "low_price") indexLow = i;
    else if (h === "close" || h === "close_price" || h === "last_traded_price") indexClose = i;
    else if (h === "volume" || h === "total_volume") indexVolume = i;
    else if (h === "source" || h === "data_source") indexSource = i;
  }

  if (indexSymbol === -1 || indexDate === -1 || indexClose === -1) {
    console.error(`[Import Script] ERROR: Missing required columns (Symbol, Date, and Close are required).`);
    console.error(`Columns found instead: ${rawHeaders.join(", ")}`);
    process.exit(1);
  }

  console.log(`[Import Script] Header mapping: Symbol[${indexSymbol}], Date[${indexDate}], Open[${indexOpen}], High[${indexHigh}], Low[${indexLow}], Close[${indexClose}], Volume[${indexVolume}], Source[${indexSource}]`);

  // 2. Parse data rows
  const parsedRows: any[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    if (cols.length < 3) continue; // Skip lines with too few values

    const rowObj: any = {
      symbol: cols[indexSymbol] || "",
      date: cols[indexDate] || "",
      open: indexOpen !== -1 ? cols[indexOpen] : cols[indexClose], // Fallback close as open if missing
      high: indexHigh !== -1 ? cols[indexHigh] : cols[indexClose], // Fallback high
      low: indexLow !== -1 ? cols[indexLow] : cols[indexClose],   // Fallback low
      close: cols[indexClose],
      volume: indexVolume !== -1 ? cols[indexVolume] : "0",
      source: indexSource !== -1 ? cols[indexSource] : "ManualCSV"
    };

    parsedRows.push(rowObj);
  }

  console.log(`[Import Script] Parsed ${parsedRows.length} data rows. Starting validation...`);

  // 3. Validation
  const { valid, invalid, errors } = validateHistoryRows(parsedRows);
  console.log(`[Import Script] Validation Result: ${valid.length} valid rows, ${invalid.length} invalid rows.`);

  // 4. Group rows by symbol
  const symbolGroups: Record<string, HistoryRow[]> = {};
  for (const row of valid) {
    if (!symbolGroups[row.symbol]) {
      symbolGroups[row.symbol] = [];
    }
    symbolGroups[row.symbol].push(row);
  }

  // 5. Save per-symbol cleaned CSV files
  console.log(`[Import Script] Saving split CSV files per ticker...`);
  saveManyStockHistoryRows(valid);
  const symbolsMeta: Record<string, { rows: number; startDate: string; endDate: string; source: string }> = {};

  for (const [symbol, rows] of Object.entries(symbolGroups)) {
    const sorted = [...rows].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    symbolsMeta[symbol] = {
      rows: rows.length,
      startDate: sorted[0].date,
      endDate: sorted[sorted.length - 1].date,
      source: sorted[sorted.length - 1].source
    };
  }

  // 6. Save summary statistics
  const summaryObj = {
    totalRowsImported: parsedRows.length,
    validRows: valid.length,
    invalidRows: invalid.length,
    symbols: symbolsMeta
  };

  ensureDirectoryExistence(SUMMARY_PATH);
  fs.writeFileSync(SUMMARY_PATH, JSON.stringify(summaryObj, null, 2), "utf-8");
  console.log(`[Import Script] Summary saved to: ${SUMMARY_PATH}`);
  console.log(`[Import Script] Clean stock-split process completed successfully.`);
}

runImport();
export {};
