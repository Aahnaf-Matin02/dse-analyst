// scripts/seedAllDseStocks.ts
// Run command: tsx scripts/seedAllDseStocks.ts

import fs from "fs";
import path from "path";

const SOURCE_JSON_PATH_LATEST = path.join(process.cwd(), "data", "cache", "dse-latest.json");
const SOURCE_JSON_PATH_FALLBACK = path.join(process.cwd(), "data", "DSE_STOCKS_FALLBACK.json");
const TARGET_TS_PATH = path.join(process.cwd(), "src", "data", "dseData.ts");

function runSeeder() {
  console.log(`[Seeder] Starting seed process...`);
  
  let sourcePath = SOURCE_JSON_PATH_LATEST;
  if (!fs.existsSync(sourcePath)) {
    sourcePath = SOURCE_JSON_PATH_FALLBACK;
  }
  
  console.log(`[Seeder] Reading raw companies from: ${sourcePath}`);

  if (!fs.existsSync(sourcePath)) {
    console.error(`[Seeder] ERROR: Source JSON file not found at ${sourcePath}`);
    process.exit(1);
  }

  const rawJsonContent = fs.readFileSync(sourcePath, "utf-8");
  let companiesData;
  try {
    const parsed = JSON.parse(rawJsonContent);
    if (parsed && typeof parsed === "object" && "stocks" in parsed) {
      companiesData = parsed.stocks;
    } else {
      companiesData = parsed;
    }
  } catch (err: any) {
    console.error(`[Seeder] ERROR parsing source JSON: ${err.message}`);
    process.exit(1);
  }

  const numCompanies = Object.keys(companiesData).length;
  console.log(`[Seeder] Successfully loaded ${numCompanies} companies.`);

  // Prepare TARGET file header and footer with dynamic functions and sector overlays
  const content = `import { StockData } from '../types';
import { DSE_SECTOR_MAP } from './dseSectors';

export const DSE_COMPANIES: Record<string, StockData> = ${JSON.stringify(companiesData, null, 2)};

// Apply official DSE sector, subSector and formal company name mapping
Object.keys(DSE_COMPANIES).forEach(sym => {
  const sectorInfo = DSE_SECTOR_MAP[sym];
  if (sectorInfo) {
    DSE_COMPANIES[sym].sector = sectorInfo.sector;
    DSE_COMPANIES[sym].subSector = sectorInfo.subSector;
    DSE_COMPANIES[sym].name = sectorInfo.name;
  }
});

// Generates simulated historical daily prices for chart visualization
export function generateHistoricalData(symbol: string, days: number = 60) {
  const company = DSE_COMPANIES[symbol];
  if (!company) {
    // Fallback company
    return Array.from({ length: days }).map((_, i) => {
      const idx = days - i;
      const date = new Date();
      date.setDate(date.getDate() - idx);
      const baseVal = 100 + Math.sin(i * 0.1) * 10;
      return {
        date: date.toISOString().split('T')[0],
        open: baseVal,
        high: baseVal + 2,
        low: baseVal - 2,
        close: baseVal + Math.sin(i * 0.2) * 1.5,
        volume: 50000 + Math.floor(Math.random() * 20000),
        sma20: baseVal,
        ema50: baseVal,
        rsi: 50
      };
    });
  }

  const basePrice = company.price;
  const history = [];
  let currentPrice = basePrice - (company.change * days * 0.1); // reverse back in time a bit
  
  // Use a pseudo-random seed based on symbol name to make the chart deterministic
  let seed = symbol.charCodeAt(0) + (symbol.charCodeAt(1) || 0);
  function seededRandom() {
    const x = Math.sin(seed++) * 10000;
    return x - Math.floor(x);
  }

  for (let i = 0; i < days; i++) {
    const d = days - i;
    const date = new Date();
    // skip weekends for accurate market look
    let offsetDays = d * 1.4; 
    date.setDate(date.getDate() - Math.floor(offsetDays));
    
    const changePct = (seededRandom() - 0.49) * 0.03; // volatile path
    const open = currentPrice;
    const close = currentPrice * (1 + changePct);
    const high = Math.max(open, close) * (1 + seededRandom() * 0.015);
    const low = Math.min(open, close) * (1 - seededRandom() * 0.015);
    const volume = Math.floor(company.volume * (0.6 + seededRandom() * 0.8));

    // Update currentPrice for next day in loop
    currentPrice = close;

    history.push({
      date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      open: parseFloat(open.toFixed(2)),
      high: parseFloat(high.toFixed(2)),
      low: parseFloat(low.toFixed(2)),
      close: parseFloat(close.toFixed(2)),
      volume: volume
    });
  }

  // Smooth prices to match current price precisely at the end
  const priceDiff = basePrice - history[history.length - 1].close;
  for (let i = 0; i < history.length; i++) {
    const adjustment = (i / (history.length - 1)) * priceDiff;
    history[i].open = parseFloat((history[i].open + adjustment).toFixed(2));
    history[i].high = parseFloat((history[i].high + adjustment).toFixed(2));
    history[i].low = parseFloat((history[i].low + adjustment).toFixed(2));
    history[i].close = parseFloat((history[i].close + adjustment).toFixed(2));

    // Calculate indicators sequentially
    const idx = i;
    if (idx >= 20) {
      let sum = 0;
      for (let j = idx - 20; j < idx; j++) sum += history[j].close;
      history[i].sma20 = parseFloat((sum / 20).toFixed(2));
    } else {
      history[i].sma20 = history[i].close;
    }

    if (idx >= 50) {
      let sum = 0;
      for (let j = idx - 50; j < idx; j++) sum += history[j].close;
      history[i].ema50 = parseFloat((sum / 50).toFixed(2));
    } else {
      history[i].ema50 = history[i].close;
    }

    // RSI calculation (simplified seeded wave)
    const rawRsi = 30 + (seededRandom() * 40) + Math.sin(idx * 0.15) * 15;
    history[i].rsi = parseFloat(Math.min(95, Math.max(5, rawRsi)).toFixed(1));
  }

  return history;
}
`;

  fs.writeFileSync(TARGET_TS_PATH, content, "utf-8");
  console.log(`[Seeder] Successfully seeded all ${numCompanies} stocks into ${TARGET_TS_PATH}`);
}

runSeeder();
