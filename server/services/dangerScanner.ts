import { getAllStocks } from "../repositories/stockRepository";
import { getStockHistory } from "../repositories/historicalRepository";
import { calculateTechnicalIndicators } from "./technicalIndicators";
import { calculateCsFhr } from "./tradingSignal";
import { DangerResult } from "../../src/types";

// In-Memory Cache to prevent recurring heavy database sweeps
let dangerCache: {
  timestamp: number;
  data: DangerResult[];
} | null = null;

const CACHE_HOURS = 15 * 60 * 1000; // 15 mins TTL

export async function scanDangers(forceRefresh = false): Promise<DangerResult[]> {
  const now = Date.now();
  if (!forceRefresh && dangerCache && (now - dangerCache.timestamp < CACHE_HOURS)) {
    return dangerCache.data;
  }

  const allStocks = getAllStocks();
  const results: DangerResult[] = [];

  // Pre-calculate sector PEs to compute "PE > 2x sector average"
  const sectorPEs: Record<string, { sum: number; count: number }> = {};
  allStocks.forEach(s => {
    if (s.sector && s.peRatio !== null && s.peRatio > 0) {
      if (!sectorPEs[s.sector]) {
        sectorPEs[s.sector] = { sum: 0, count: 0 };
      }
      sectorPEs[s.sector].sum += s.peRatio;
      sectorPEs[s.sector].count += 1;
    }
  });

  const sectorAvgs: Record<string, number> = {};
  Object.entries(sectorPEs).forEach(([sectorName, val]) => {
    sectorAvgs[sectorName] = val.sum / val.count;
  });

  for (const stock of allStocks) {
    try {
      const sym = stock.symbol;
      const price = stock.price || 10;
      const change = stock.changePercent ?? 0;

      // 1. Fetch small history segment to keep scans extremely fast
      const hist = getStockHistory(sym, 35);
      const data = hist.data || [];
      const ind = calculateTechnicalIndicators(data);

      const rsi = ind.rsi14 ?? 50;
      const macd = ind.macd ?? 0;
      const macdSignal = ind.macdSignal ?? 0;
      const sma50 = ind.sma50 ?? price;
      
      const todayVol = stock.volume ?? (data.length > 0 ? (data[data.length - 1].volume ?? 0) : 0);
      const avgVol = ind.avgVolume20D ?? stock.avgVolume ?? 10000;
      const relVol20 = avgVol > 0 ? todayVol / avgVol : 1.0;

      const fhr = calculateCsFhr(stock);
      const pe = stock.peRatio ?? 15;
      const sectorAvgPE = sectorAvgs[stock.sector] || 14.0;
      const revGrowth = stock.revGrowth ?? 0;
      const profitGrowth = stock.profitGrowth ?? 0;
      const divYield = stock.divYield ?? 0;

      // Breakout score estimation
      const bUpper = ind.bollingerUpper ?? price * 1.1;
      const bLower = ind.bollingerLower ?? price * 0.9;
      const bandwidth = bUpper - bLower;

      let breakoutScore = 50;
      let proxFraction = 0.5;
      let resistanceTests = 0;

      const last30 = data.slice(-30);
      if (last30.length > 0) {
        const hMax = Math.max(...last30.map(r => r.high ?? r.close ?? price));
        const lMin = Math.min(...last30.map(r => r.low ?? r.close ?? price));
        const close = last30[last30.length - 1].close ?? price;
        const pivot = (hMax + lMin + close) / 3;
        const r1 = 2 * pivot - lMin;
        const s1 = 2 * pivot - hMax;
        proxFraction = (r1 - s1) > 0 ? (price - s1) / (r1 - s1) : 0.5;

        const last20 = data.slice(-20);
        resistanceTests = last20.filter(r => (r.high ?? r.close ?? 0) >= r1 * 0.98).length;
      }

      let bScore = proxFraction * 25;
      if (bandwidth < 0.05 * price) bScore += 20;
      else if (bandwidth < 0.08 * price) bScore += 10;
      if (relVol20 > 1.5) bScore += 20;
      else if (relVol20 > 1.0) bScore += 10;
      if (resistanceTests >= 3) bScore += 20;
      else if (resistanceTests >= 1) bScore += 10;
      const sma20 = ind.sma20 ?? price;
      if (price > sma20) bScore += 15;
      breakoutScore = Math.min(100, Math.max(0, Math.round(bScore)));

      // Danger calculation parameters
      let dangerScore = 0;
      const warnings: string[] = [];

      // A. Technical Warnings (up to 14)
      if (rsi > 70) {
        dangerScore += 3;
        warnings.push(`RSI is overbought at ${rsi.toFixed(1)}`);
      }
      if (macd < macdSignal) {
        dangerScore += 3;
        warnings.push("Bearish MACD crossover registered");
      }
      if (price < sma50) {
        dangerScore += 2;
        warnings.push("Price hovering below structural SMA50");
      }

      const high52W = ind.high52W || stock.week52High || (price * 1.15);
      const isNearHigh = price >= high52W * 0.95;
      if (isNearHigh && relVol20 < 1.0) {
        dangerScore += 2;
        warnings.push("Exhaustive consolidation near 52W high under low volume");
      }

      const isDownDay = change < -0.5;
      if (isDownDay && relVol20 > 1.5) {
        dangerScore += 2;
        warnings.push("Severe high-volume distribution event");
      }

      if (breakoutScore < 20) {
        dangerScore += 2;
        warnings.push("Technical downside breakdown breakout warning");
      }

      // B. Fundamental deterioration (up to 10)
      if (fhr < 45) {
        dangerScore += 3;
        warnings.push(`Vulnerable solvency rating (CS-FHR: ${fhr})`);
      }
      if (pe > 2 * sectorAvgPE) {
        dangerScore += 2;
        warnings.push(`P/E multiple is 2x above sector average (${pe.toFixed(1)}x)`);
      }
      if (revGrowth < 0) {
        dangerScore += 2;
        warnings.push(`Declining sales revenues (${revGrowth}%)`);
      }
      if (profitGrowth < 0) {
        dangerScore += 2;
        warnings.push(`Contracting net profits (${profitGrowth}%)`);
      }
      if (divYield < 1.0) {
        dangerScore += 1;
        warnings.push(`Extremely low dividend compensation (${divYield.toFixed(1)}%)`);
      }

      // C. Price Action (up to 7)
      // Change over last 30 calendar/trade days
      let price30DChangePct = 0;
      if (data.length >= 20) {
        const oldPrice = data[0].close || price;
        price30DChangePct = oldPrice > 0 ? ((price - oldPrice) / oldPrice) * 100 : 0;
      }
      if (price30DChangePct <= -15.0) {
        dangerScore += 3;
        warnings.push(`Steep price crash of ${price30DChangePct.toFixed(1)}% in last 30 days`);
      }

      // Consecutive down days >= 5
      let consecutiveDown = 0;
      for (let j = data.length - 1; j >= 0; j--) {
        const rChange = data[j].changePercent ?? 0;
        if (rChange < 0) {
          consecutiveDown++;
        } else {
          break;
        }
      }
      if (consecutiveDown >= 5) {
        dangerScore += 2;
        warnings.push(`Under consecutive sell down pressure for ${consecutiveDown} days`);
      }

      // Volume drying up on positive day
      if (change > 0.3 && relVol20 < 0.6) {
        dangerScore += 1;
        warnings.push("Unconvincing positive session on sub-average volume");
      }

      // Map Severity levels
      let severity: DangerResult["severity"] = "Elevated";
      if (dangerScore >= 20) severity = "Critical";
      else if (dangerScore >= 15) severity = "High";
      else if (dangerScore >= 10) severity = "Elevated";

      // Only push if dangerScore reaches 4 to keep scanner clean & relevant
      if (dangerScore >= 4) {
        results.push({
          symbol: sym,
          name: stock.name,
          sector: stock.sector,
          dangerScore,
          severity,
          currentPrice: price,
          warnings,
          tradingSignal: dangerScore >= 18 ? "ELEVATED DOWNSIDE VOLATILITY" : dangerScore >= 10 ? "MODERATE NEGATIVE MOMENTUM" : "MILD NEGATIVE BIAS",
          priceChange30D: parseFloat(price30DChangePct.toFixed(2)),
          fundamentalScore: fhr
        });
      }

    } catch (err) {
      console.warn(`Error scanning risks for ${stock.symbol}:`, err);
    }
  }

  // Sort by danger score descending and limit
  const sorted = results.sort((a, b) => b.dangerScore - a.dangerScore);

  dangerCache = {
    timestamp: now,
    data: sorted
  };

  return sorted;
}
