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
`;

  fs.writeFileSync(TARGET_TS_PATH, content, "utf-8");
  console.log(`[Seeder] Successfully seeded all ${numCompanies} stocks into ${TARGET_TS_PATH}`);
}

runSeeder();
