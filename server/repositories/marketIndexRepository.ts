import fs from "fs";
import path from "path";

export interface IndexRecord {
  timestamp: string;      // ISO string: e.g. "2026-06-11T14:30:00.000Z"
  index_name: string;     // "DSEX" | "DSES" | "DS30"
  index_value: number;
  change_value: number;
  change_percent: number;
  trading_date: string;   // YYYY-MM-DD
}

export interface IndexPrediction {
  timestamp: string;      // ISO string when prediction was made
  index_name: string;
  prediction_target_date: string; // YYYY-MM-DD
  predicted_value: number;
  confidence_score: number;       // 0 - 100
  model_name: string;             // "DSE-AI-LSTM-V2" or "ArimaRegressor"
  indicators: string[];           // key metrics factored in
}

const HISTORY_PATH = path.join(process.cwd(), "data", "market_index_history.json");
const INTRADAY_PATH = path.join(process.cwd(), "data", "market_index_intraday.json");
const PREDICTIONS_PATH = path.join(process.cwd(), "data", "market_index_predictions.json");

let historyCache: IndexRecord[] | null = null;
let intradayCache: IndexRecord[] | null = null;
let predictionsCache: IndexPrediction[] | null = null;

// Helpers to read/write files safely
function readJSONFile<T>(filePath: string, defaultVal: T): T {
  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, "utf-8");
      return JSON.parse(content) as T;
    }
  } catch (err) {
    console.warn(`[MarketIndexRepository] Error reading ${filePath}:`, err);
  }
  return defaultVal;
}

function writeJSONFile<T>(filePath: string, data: T): void {
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.warn(`[MarketIndexRepository] Error writing to ${filePath}:`, err);
  }
}

// 1. SEED 3-YEAR DEEP HISTORY FROM EMBEDDED CSVs FOR ALL THREE INDICES
export function initializeHistoryFromCSVs(): IndexRecord[] {
  if (historyCache && historyCache.length > 0) return historyCache;

  // Let's load existing history if any
  historyCache = readJSONFile<IndexRecord[]>(HISTORY_PATH, []);
  if (historyCache.length > 50) {
    return historyCache;
  }

  console.log("[MarketIndexRepository] Seeding market_index_history from local CSV files...");
  const records: IndexRecord[] = [];
  const indices = ["DSEX", "DSES", "DS30"];

  for (const sym of indices) {
    const csvPath = path.join(process.cwd(), "data", "history", "indices", `${sym}.csv`);
    if (!fs.existsSync(csvPath)) {
      console.warn(`[MarketIndexRepository] Index CSV not found: ${csvPath}`);
      continue;
    }

    try {
      const content = fs.readFileSync(csvPath, "utf-8");
      const lines = content.split(/\r?\n/).filter(line => line.trim());
      if (lines.length <= 1) continue;

      // Header: date,open,high,low,close,volume,source
      const rawRows: { date: string; open: number; close: number }[] = [];
      for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(",");
        if (parts.length < 5) continue;
        const date = parts[0].trim();
        const open = parseFloat(parts[1].trim());
        const close = parseFloat(parts[4].trim());
        if (date && !isNaN(open) && !isNaN(close)) {
          rawRows.push({ date, open, close });
        }
      }

      // Sort rows chronologically (ascending dates)
      rawRows.sort((a, b) => a.date.localeCompare(b.date));

      // Map to Record with continuous close change calculation
      let previousClose = 0;
      for (const row of rawRows) {
        let change_value = 0;
        let change_percent = 0;

        if (previousClose > 0) {
          change_value = parseFloat((row.close - previousClose).toFixed(5));
          change_percent = parseFloat(((change_value / previousClose) * 100).toFixed(5));
        } else {
          change_value = parseFloat((row.close - row.open).toFixed(5));
          change_percent = parseFloat(((change_value / row.open) * 100).toFixed(5));
        }

        records.push({
          timestamp: `${row.date}T14:30:00.000Z`, // EOD trading time
          index_name: sym,
          index_value: row.close,
          change_value,
          change_percent,
          trading_date: row.date
        });

        previousClose = row.close;
      }
    } catch (csvErr) {
      console.error(`[MarketIndexRepository] Failed to parse CSV for ${sym}:`, csvErr);
    }
  }

  // Fallback to auto-generated indices if the records list is completely empty
  if (records.length === 0) {
    console.log("[MarketIndexRepository] No CSV indices found. Creating dynamic three-year historical seed data.");
    const indicesConfig: Record<string, { startVal: number; vol: number; baseTrend: number }> = {
      DSEX: { startVal: 5000, vol: 0.005, baseTrend: 0.0001 },
      DSES: { startVal: 1100, vol: 0.004, baseTrend: 0.00008 },
      DS30: { startVal: 1800, vol: 0.006, baseTrend: 0.00012 }
    };

    const daysCount = 3 * 365; // three years
    let dateSeed = new Date("2023-06-12T14:30:00.000Z");

    for (let d = 0; d < daysCount; d++) {
      const isWeekend = dateSeed.getDay() === 5 || dateSeed.getDay() === 6; // DSE Friday, Saturday are holidays
      if (!isWeekend) {
        const trading_date = dateSeed.toISOString().split("T")[0];
        for (const [sym, config] of Object.entries(indicesConfig)) {
          const rand = Math.sin(d * 0.05 + sym.charCodeAt(0)) * 0.4 + Math.cos(d * 0.08 + sym.charCodeAt(0)) * 0.3;
          const percentChange = config.baseTrend + rand * config.vol;
          
          const prevDayValue = records.filter(r => r.index_name === sym).slice(-1)[0]?.index_value || config.startVal;
          const change_value = parseFloat((prevDayValue * percentChange).toFixed(5));
          const index_value = parseFloat((prevDayValue + change_value).toFixed(5));
          const change_percent = parseFloat((percentChange * 100).toFixed(5));

          records.push({
            timestamp: dateSeed.toISOString(),
            index_name: sym,
            index_value,
            change_value,
            change_percent,
            trading_date
          });
        }
      }
      dateSeed.setDate(dateSeed.getDate() + 1);
    }
  }

  // Save to file
  historyCache = records;
  writeJSONFile(HISTORY_PATH, historyCache);
  console.log(`[MarketIndexRepository] Successfully seeded ${historyCache.length} index history records!`);
  return historyCache;
}

// 2. REAL-TIME AND HISTORICAL INDEX READ AND WRITE (DUP PROTECTION FOR SNAPSHOTS INTRADAY)
export function getHistory(symbol?: string, limitDays = 365 * 3): IndexRecord[] {
  const all = initializeHistoryFromCSVs();
  let filtered = symbol ? all.filter(r => r.index_name === symbol) : all;
  
  // Sort by date chronologically
  filtered.sort((a, b) => a.trading_date.localeCompare(b.trading_date));
  
  if (limitDays > 0) {
    // Get unique trading dates and slice
    const uniqueDates = Array.from(new Set(filtered.map(f => f.trading_date))).slice(-limitDays);
    filtered = filtered.filter(f => uniqueDates.includes(f.trading_date));
  }
  return filtered;
}

export function saveDailyHistoryRecord(record: IndexRecord): void {
  const all = initializeHistoryFromCSVs();
  
  // Clean symbol name
  const name = record.index_name.toUpperCase().trim();
  const date = record.trading_date;

  // Let's find if a record for this index and trading_date already exists
  const existingIdx = all.findIndex(r => r.index_name === name && r.trading_date === date);
  const cleanRec = { ...record, index_name: name };

  if (existingIdx !== -1) {
    all[existingIdx] = cleanRec;
  } else {
    all.push(cleanRec);
  }

  historyCache = all;
  writeJSONFile(HISTORY_PATH, historyCache);
}

// 3. INTRADAY TICK READ AND WRITE with strict duplication block
export function getIntradayTicks(symbol?: string): IndexRecord[] {
  if (!intradayCache) {
    intradayCache = readJSONFile<IndexRecord[]>(INTRADAY_PATH, []);
  }

  // If intraday is totally empty, we can seed it with a beautiful list of mock ticked data for the current trading day (e.g. 2026-06-11 and 2026-06-12)
  if (intradayCache.length === 0) {
    console.log("[MarketIndexRepository] Seeding intraday market ticks...");
    const ticks: IndexRecord[] = [];
    const basePrices = { DSEX: 5420.50, DSES: 1180.20, DS30: 1950.40 };
    const dateStr = "2026-06-12";
    
    // Simulate intraday movement from 10:00 AM to 2:30 PM (every 10 minutes)
    for (let hour = 10; hour <= 14; hour++) {
      const maxMin = hour === 14 ? 30 : 50;
      for (let min = 0; min <= maxMin; min += 10) {
        const timeStr = `${hour.toString().padStart(2, "0")}:${min.toString().padStart(2, "0")}:00`;
        const timestamp = `${dateStr}T${timeStr}.000Z`;
        
        for (const [sym, baseVal] of Object.entries(basePrices)) {
          // Semi-deterministic walk based on timestamp
          const seedStr = timestamp + sym;
          let hash = 0;
          for (let c = 0; c < seedStr.length; c++) hash = seedStr.charCodeAt(c) + ((hash << 5) - hash);
          const randPct = ((Math.abs(hash) % 1000) / 1000 - 0.48) * 0.4; // between -0.192% and +0.208%
          
          const tickValue = parseFloat((baseVal * (1 + randPct / 100)).toFixed(5));
          const change = parseFloat((tickValue - baseVal).toFixed(5));
          const pct = parseFloat(((change / baseVal) * 100).toFixed(5));

          ticks.push({
            timestamp,
            index_name: sym,
            index_value: tickValue,
            change_value: change,
            change_percent: pct,
            trading_date: dateStr
          });
        }
      }
    }
    intradayCache = ticks;
    writeJSONFile(INTRADAY_PATH, intradayCache);
  }

  let filtered = symbol ? intradayCache.filter(r => r.index_name === symbol) : intradayCache;
  return filtered.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

export function saveIntradayTick(record: IndexRecord): boolean {
  const all = getIntradayTicks();
  const name = record.index_name.toUpperCase().trim();
  const ts = record.timestamp;

  // Strict Duplication Prevention: Check if this specific timestamp and index_name has already been recorded
  const exists = all.some(r => r.index_name === name && r.timestamp === ts);
  if (exists) {
    return false; // prevent duplication
  }

  const cleanRec = { ...record, index_name: name };
  all.push(cleanRec);
  intradayCache = all;
  writeJSONFile(INTRADAY_PATH, intradayCache);
  return true;
}

// 4. PREDICTIONS READ AND WRITE
export function getIndexPredictions(symbol?: string): IndexPrediction[] {
  if (!predictionsCache) {
    predictionsCache = readJSONFile<IndexPrediction[]>(PREDICTIONS_PATH, []);
  }

  // Pre-seed some predictions if empty
  if (predictionsCache.length === 0) {
    const today = "2026-06-12";
    const tomorrow = "2026-06-15"; // next trading day (Monday)
    predictionsCache = [
      {
        timestamp: new Date().toISOString(),
        index_name: "DSEX",
        prediction_target_date: tomorrow,
        predicted_value: 5462.80,
        confidence_score: 84.5,
        model_name: "DSE-AI-LSTM-V2",
        indicators: ["RSI oversold rebound", "Strong sector breadth (Textile accumulation)", "Bullish MACD crossover"]
      },
      {
        timestamp: new Date().toISOString(),
        index_name: "DSES",
        prediction_target_date: tomorrow,
        predicted_value: 1192.40,
        confidence_score: 79.2,
        model_name: "ArimaRegressor",
        indicators: ["Shariah volume expansion", "Positive breadth ratio in Mutual Funds"]
      },
      {
        timestamp: new Date().toISOString(),
        index_name: "DS30",
        prediction_target_date: tomorrow,
        predicted_value: 1965.10,
        confidence_score: 81.0,
        model_name: "DSE-AI-LSTM-V2",
        indicators: ["Heavy foreign participation", "Pharma sector strong earnings reports"]
      }
    ];
    writeJSONFile(PREDICTIONS_PATH, predictionsCache);
  }

  return symbol ? predictionsCache.filter(r => r.index_name === symbol) : predictionsCache;
}

export function saveIndexPrediction(pred: IndexPrediction): void {
  const all = getIndexPredictions();
  all.push(pred);
  predictionsCache = all;
  writeJSONFile(PREDICTIONS_PATH, predictionsCache);
}
