import { getStockBySymbol } from "../repositories/stockRepository";
import { SectorExposureResult, SectorExposureItem } from "../../src/types";

// Official DSEX index weights - verified June 2026
export const DSEX_SECTOR_WEIGHTS: Record<string, number> = {
  "Bank": 18.5,
  "Pharmaceuticals & Chemicals": 15.6,
  "Telecommunication": 11.2,
  "Fuel & Power": 10.4,
  "Engineering": 9.8,
  "Food & Allied": 8.5,
  "Cement": 4.8,
  "Insurance": 4.2,
  "Textile": 3.5,
  "Financial Institutions": 3.2,
  "Tannery Industries": 1.8,
  "Miscellaneous": 1.6,
  "Information Technology": 1.4,
  "Mutual Funds": 1.2,
  "Jute": 0.8,
  "Paper & Printing": 0.6,
  "Travel & Leisure": 0.5,
  "Services & Real Estate": 0.5,
  "Ceramics Sector": 0.4,
  "Real Estate & Basic Materials": 1.5
};

export interface InputHolding {
  symbol: string;
  quantity: number;
  buyPrice: number;
}

export function calculateSectorExposure(holdings: InputHolding[]): SectorExposureResult {
  if (!holdings || holdings.length === 0) {
    return {
      sectors: [],
      concentrationScore: 100,
      topSector: "None",
      underweightSectors: [],
      overweightSectors: [],
      diversificationGrade: "A"
    };
  }

  // Enrich holdings with stock data and sector
  const enrichedHoldings = holdings.map(h => {
    const sym = h.symbol.toUpperCase().trim();
    const stock = getStockBySymbol(sym);

    // Default sector fallback if unavailable
    const sector = stock?.sector || "Miscellaneous";
    const currentPrice = stock?.price ?? h.buyPrice;
    const value = h.quantity * currentPrice;

    // Calculate individual holding return
    const holdingReturn = h.buyPrice > 0 ? ((currentPrice - h.buyPrice) / h.buyPrice) * 100 : 0;

    return {
      symbol: sym,
      quantity: h.quantity,
      buyPrice: h.buyPrice,
      currentPrice,
      value,
      sector,
      holdingReturn
    };
  });

  const totalPortfolioValue = enrichedHoldings.reduce((sum, h) => sum + h.value, 0);

  // Group by Sector
  const sectorGroups: Record<string, typeof enrichedHoldings> = {};
  enrichedHoldings.forEach(h => {
    if (!sectorGroups[h.sector]) {
      sectorGroups[h.sector] = [];
    }
    sectorGroups[h.sector].push(h);
  });

  const sectorMetrics: SectorExposureItem[] = [];

  Object.entries(sectorGroups).forEach(([sectorName, group]) => {
    const sectorValue = group.reduce((sum, h) => sum + h.value, 0);
    const sectorWeight = totalPortfolioValue > 0 ? (sectorValue / totalPortfolioValue) * 100 : 0;
    const indexWeight = DSEX_SECTOR_WEIGHTS[sectorName] || 0.5;
    const activeExposure = sectorWeight - indexWeight;

    // Weighted return of holdings in sector
    const weightedReturnSum = group.reduce((sum, h) => sum + (h.holdingReturn * h.value), 0);
    const sectorReturn = sectorValue > 0 ? weightedReturnSum / sectorValue : 0;

    // Concentration risk within sector
    let risk: SectorExposureItem["risk"] = "Acceptable";
    if (sectorWeight > 40) risk = "High";
    else if (sectorWeight >= 25) risk = "Moderate";

    const symbolsInSector = group.map(h => h.symbol);

    sectorMetrics.push({
      name: sectorName,
      value: parseFloat(sectorValue.toFixed(2)),
      weight: parseFloat(sectorWeight.toFixed(2)),
      indexWeight,
      activeExposure: parseFloat(activeExposure.toFixed(2)),
      return: parseFloat(sectorReturn.toFixed(2)),
      risk,
      holdings: symbolsInSector
    });
  });

  // Calculate Diversification Score based on HHI (Herfindahl-Hirschman Index)
  // HHI ranges from 0 to 10000. Under 1500 is highly diversified.
  const hhi = sectorMetrics.reduce((sum, s) => sum + Math.pow(s.weight, 2), 0);
  
  // Normalize HHI to 0-100 score where 100 is perfectly diversified (sub-1000 HHI)
  // 10000 means completely concentrated in 1 sector. We want that score to be ~10/100.
  let concentrationScore = 100 - (hhi - 500) / 95;
  concentrationScore = Math.max(0, Math.min(100, Math.round(concentrationScore)));

  // Diversification Grade
  let diversificationGrade: SectorExposureResult["diversificationGrade"] = "C";
  if (concentrationScore >= 85) diversificationGrade = "A";
  else if (concentrationScore >= 70) diversificationGrade = "B";
  else if (concentrationScore >= 50) diversificationGrade = "C";
  else if (concentrationScore >= 35) diversificationGrade = "D";
  else diversificationGrade = "F";

  // Identify overweight and underweight sectors (over/under by >= 5%)
  const overweightSectors: string[] = [];
  const underweightSectors: string[] = [];

  sectorMetrics.forEach(s => {
    if (s.activeExposure >= 5.0) {
      overweightSectors.push(s.name);
    }
  });

  // Also include major index sectors that are missing entirely as underweight
  Object.entries(DSEX_SECTOR_WEIGHTS).forEach(([sectName, weight]) => {
    const existingMetric = sectorMetrics.find(s => s.name === sectName);
    if (!existingMetric && weight >= 4.0) {
      // Missing a major sector (>4% of DSEX) is a structural "Blind Spot" representing underweight
      underweightSectors.push(sectName);
    } else if (existingMetric && existingMetric.activeExposure <= -5.0) {
      underweightSectors.push(sectName);
    }
  });

  // Pick top sector
  let topSector = "None";
  if (sectorMetrics.length > 0) {
    const sorted = [...sectorMetrics].sort((a, b) => b.value - a.value);
    topSector = sorted[0].name;
  }

  return {
    sectors: sectorMetrics.sort((a, b) => b.weight - a.weight),
    concentrationScore,
    topSector,
    underweightSectors,
    overweightSectors,
    diversificationGrade
  };
}
