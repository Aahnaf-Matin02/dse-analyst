// scripts/researchSectors.ts
// Run command: npx tsx scripts/researchSectors.ts

import fs from "fs";
import path from "path";
import { DSE_COMPANIES } from "../src/data/dseData";

// Helper to determine outstanding shares for major DSE tickers or sector-wise standard averages
const getEstimatedOutstandingShares = (symbol: string, sector: string, price: number): number => {
  // Authentic known approximate outstanding share counts for core DSE heavyweights
  if (symbol === "GP") return 1350300022;          // 1.35 Billion shares
  if (symbol === "ROBI") return 5237930000;        // 5.23 Billion shares
  if (symbol === "BATBC") return 540000000;         // 540 Million shares
  if (symbol === "SQURPHARMA") return 886450000;    // 886 Million shares
  if (symbol === "RENATA") return 114000000;        // 114 Million shares
  if (symbol === "BXPHARMA") return 446000000;      // 446 Million shares
  if (symbol === "BRACBANK") return 1608000000;     // 1.6 Billion shares
  if (symbol === "ISLAMIBANK") return 1610000000;   // 1.61 Billion shares
  if (symbol === "UPGDCL") return 579700000;        // 579 Million shares
  if (symbol === "BEXIMCO") return 876300000;       // 876 Million shares
  if (symbol === "LHBL") return 1161000000;         // 1.16 Billion shares
  if (symbol === "MARICO") return 31500000;         // 31.5 Million shares
  if (symbol === "BERGERPBL") return 46380000;      // 46.38 Million shares
  if (symbol === "WALTONHIL") return 302920000;     // 302.9 Million shares
  if (symbol === "POWERGRID") return 712730000;     // 712 Million shares
  if (symbol === "MJLBD") return 338160000;         // 338 Million shares

  // Sector general outstanding share count averages (in units of shares)
  const officialSector = (sector || "").trim();
  switch (officialSector) {
    case "Telecommunication":
      return 1200000000;
    case "Bank":
      return 650000000; // Banks typically have high outstanding shares to meet capital requirements
    case "Pharmaceuticals & Chemicals":
      return price > 150 ? 120000000 : 45000000;
    case "Fuel & Power":
      return price > 100 ? 110000000 : 40000000;
    case "Food & Allied":
      return price > 400 ? 25000000 : 12000000;
    case "Cement":
      return 90000000;
    case "Engineering":
      return 65000000;
    case "Financial Institutions":
      return 140000000;
    case "Insurance":
      return 45000000; // Small-cap to mid-cap heavy listings
    case "Textile":
      return 40000000;
    case "IT Sector":
      return 50000000;
    case "Tannery Industries":
      return 22000000;
    case "Ceramics Sector":
      return 45000000;
    case "Miscellaneous":
      return 35000000;
    case "Paper & Printing":
      return 25000000;
    case "Services & Real Estate":
      return 85000000;
    case "Travel & Leisure":
      return 30000000;
    case "Jute":
      return 5000000; // Extremely low outstanding float
    default:
      return 40000000;
  }
};

// Formatting helper for logs
function formatCurrency(value: number): string {
  if (value >= 1_000_000_000_000) {
    return `BDT ${(value / 1_000_000_000_000).toFixed(2)}T`;
  }
  if (value >= 1_000_000_000) {
    return `BDT ${(value / 1_000_000_000).toFixed(2)}B`;
  }
  if (value >= 1_000_000) {
    return `BDT ${(value / 1_000_000).toFixed(2)}M`;
  }
  return `BDT ${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

async function performSectorResearch() {
  console.log("==========================================================");
  console.log("      DHAKA STOCK EXCHANGE SECTOR RESEARCH ENGINE        ");
  console.log("==========================================================");

  const stocks = Object.values(DSE_COMPANIES);
  console.log(`Loaded ${stocks.length} active listings.`);

  const sectorMap: Record<string, {
    name: string;
    stockCount: number;
    totalMarketCap: number;
    avgPE: number;
    peCount: number;
    avgDivYield: number;
    divCount: number;
    weightedReturn: number;
    simpleAvgReturn: number;
    totalChangePct: number;
    topStockByCap: { symbol: string; name: string; cap: number; price: number };
    topGainerToday: { symbol: string; changePercent: number; price: number };
  }> = {};

  let totalDseMarketCap = 0;
  let DseTotalPE = 0;
  let DsePEStocks = 0;
  let DseTotalDiv = 0;
  let DseDivStocks = 0;

  // Track breadth
  let advancing = 0;
  let declining = 0;
  let unchanged = 0;

  // Process stocks
  stocks.forEach(s => {
    if (!s.sector) return;
    const secName = s.sector.trim();
    
    // Calculate raw market cap
    let cap = 0;
    const sharesCount = getEstimatedOutstandingShares(s.symbol, s.sector, s.price);
    cap = sharesCount * s.price;

    // Track total market cap
    totalDseMarketCap += cap;

    // Track breadth
    if (s.changePercent > 0) advancing++;
    else if (s.changePercent < 0) declining++;
    else unchanged++;

    if (!sectorMap[secName]) {
      sectorMap[secName] = {
        name: secName,
        stockCount: 0,
        totalMarketCap: 0,
        avgPE: 0,
        peCount: 0,
        avgDivYield: 0,
        divCount: 0,
        weightedReturn: 0,
        simpleAvgReturn: 0,
        totalChangePct: 0,
        topStockByCap: { symbol: "N/A", name: "None", cap: 0, price: 0 },
        topGainerToday: { symbol: "N/A", changePercent: -999, price: 0 }
      };
    }

    const sec = sectorMap[secName];
    sec.stockCount += 1;
    sec.totalMarketCap += cap;
    sec.totalChangePct += s.changePercent || 0;

    // P/E Ratio Accumulator (ignore extreme anomalies > 150)
    if (s.peRatio !== null && s.peRatio > 0 && s.peRatio < 150) {
      sec.avgPE += s.peRatio;
      sec.peCount += 1;

      DseTotalPE += s.peRatio;
      DsePEStocks += 1;
    }

    // Dividend Yield Accumulator
    if (s.divYield !== null && s.divYield >= 0) {
      sec.avgDivYield += s.divYield;
      sec.divCount += 1;

      DseTotalDiv += s.divYield;
      DseDivStocks += 1;
    }

    // Top Stock by Cap tracker
    if (cap > sec.topStockByCap.cap || sec.topStockByCap.cap === 0) {
      sec.topStockByCap = {
        symbol: s.symbol,
        name: s.name,
        cap: cap,
        price: s.price
      };
    }

    // Top Gainer today tracker
    const changePct = s.changePercent || 0;
    if (changePct > sec.topGainerToday.changePercent) {
      sec.topGainerToday = {
        symbol: s.symbol,
        changePercent: changePct,
        price: s.price
      };
    }
  });

  // Calculate averages per sector
  const sectorList = Object.values(sectorMap).map(sec => {
    const rawPE = sec.peCount > 0 ? sec.avgPE / sec.peCount : 0;
    const rawDiv = sec.divCount > 0 ? sec.avgDivYield / sec.divCount : 0;
    const simReturn = sec.stockCount > 0 ? sec.totalChangePct / sec.stockCount : 0;

    return {
      name: sec.name,
      stockCount: sec.stockCount,
      totalMarketCap: sec.totalMarketCap,
      marketCapFormatted: formatCurrency(sec.totalMarketCap),
      avgPE: parseFloat(rawPE.toFixed(1)),
      avgDivYield: parseFloat(rawDiv.toFixed(2)),
      avgDailyReturn: parseFloat(simReturn.toFixed(2)),
      topStock: sec.topStockByCap,
      topGainer: sec.topGainerToday,
      weightPercent: 0 // to be calculated below
    };
  });

  // Calculate weight percentages & sort by capitalization
  sectorList.forEach(sec => {
    sec.weightPercent = parseFloat(((sec.totalMarketCap / (totalDseMarketCap || 1)) * 100).toFixed(2));
  });

  // Sort by Market Cap descending
  const sortedByCap = [...sectorList].sort((a, b) => b.totalMarketCap - a.totalMarketCap);

  // Sort by Daily Performance descending
  const sortedByPerf = [...sectorList].sort((a, b) => b.avgDailyReturn - a.avgDailyReturn);

  console.log(`\n--- ALL DSE MARKET CAP AGGREGATE SUMMARY ---`);
  console.log(`Total Estimated Capitalization : ${formatCurrency(totalDseMarketCap)}`);
  console.log(`Overall Benchmark P/E Ratio   : ${(DseTotalPE / (DsePEStocks || 1)).toFixed(2)}x (based on ${DsePEStocks} active listings)`);
  console.log(`Overall Benchmark Div Yield   : ${(DseTotalDiv / (DseDivStocks || 1)).toFixed(2)}% (based on ${DseDivStocks} active listings)`);
  console.log(`Breadth Ratio                 : ${advancing} Advancing / ${declining} Declining / ${unchanged} Unchanged`);

  console.log(`\n--- SECTORS RANKED BY TOTAL CAPITALIZATION ---`);
  sortedByCap.forEach((sec, idx) => {
    const formattedCap = formatCurrency(sec.totalMarketCap);
    console.log(`${idx + 1}. [${sec.name}] - Weight: ${sec.weightPercent}% - Cap: ${formattedCap} (${sec.stockCount} equities)`);
    console.log(`   - P/E Multiple: ${sec.avgPE > 0 ? `${sec.avgPE}x` : "N/A"}`);
    console.log(`   - Dividend Yield: ${sec.avgDivYield}%`);
    console.log(`   - Daily Change: ${sec.avgDailyReturn >= 0 ? "+" : ""}${sec.avgDailyReturn}%`);
    console.log(`   - Anchor Heavyweight: ${sec.topStock.symbol} (${sec.topStock.name}) priced at BDT ${sec.topStock.price} | Cap: ${formatCurrency(sec.topStock.cap)}`);
  });

  console.log(`\n--- TOP 5 SECTOR RETURN OUTPERFORMERS ---`);
  sortedByPerf.slice(0, 5).forEach((sec, idx) => {
    console.log(`${idx + 1}. ${sec.name}: ${sec.avgDailyReturn >= 0 ? "+" : ""}${sec.avgDailyReturn}% (P/E: ${sec.avgPE}x, Stock Count: ${sec.stockCount})`);
  });

  console.log(`\n--- TOP 5 SECTOR UNDERPERFORMERS ---`);
  sortedByPerf.slice(-5).reverse().forEach((sec, idx) => {
    console.log(`${idx + 1}. ${sec.name}: ${sec.avgDailyReturn >= 0 ? "+" : ""}${sec.avgDailyReturn}% (P/E: ${sec.avgPE}x, Stock Count: ${sec.stockCount})`);
  });

  // Write research report data to JSON for persistent storage
  const outputDir = path.join(process.cwd(), "data", "history", "processed");
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const outputPayload = {
    generatedAt: new Date().toISOString(),
    totalMarketCap: totalDseMarketCap,
    totalMarketCapFormatted: formatCurrency(totalDseMarketCap),
    benchmarks: {
      averagePE: parseFloat((DseTotalPE / (DsePEStocks || 1)).toFixed(2)),
      averageYield: parseFloat((DseTotalDiv / (DseDivStocks || 1)).toFixed(2)),
      breadth: { advancing, declining, unchanged, total: stocks.length }
    },
    sectors: sortedByCap
  };

  const outputPath = path.join(outputDir, "sector-research-summary.json");
  fs.writeFileSync(outputPath, JSON.stringify(outputPayload, null, 2), "utf-8");
  console.log(`\n[Research] Successfully saved core sector results to ${outputPath}`);
  console.log("==========================================================");
}

performSectorResearch().catch(err => {
  console.error("Research processing failed:", err);
  process.exit(1);
});
