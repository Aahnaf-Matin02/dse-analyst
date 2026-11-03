import { getAllStocks, getStockBySymbol } from "../repositories/stockRepository";
import { getStockHistory } from "../repositories/historicalRepository";
import { calculateTechnicalIndicators } from "./technicalIndicators";
import { calculateCsFhr } from "./tradingSignal";
import { calculateBreakoutScore } from "./breakoutScorer";
import { OpportunityResult } from "../../src/types";

// In-Memory Cache to prevent recurring heavy chronological reads
let opportunityCache: {
  timestamp: number;
  data: OpportunityResult[];
} | null = null;

const CACHE_HOURS = 15 * 60 * 1000; // 15 mins TTL

export async function scanOpportunities(forceRefresh = false): Promise<OpportunityResult[]> {
  const now = Date.now();
  if (!forceRefresh && opportunityCache && (now - opportunityCache.timestamp < CACHE_HOURS)) {
    return opportunityCache.data;
  }

  const allStocks = getAllStocks();
  const results: OpportunityResult[] = [];

  // Pre-calculate sector PEs to compute "PE < sector average"
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

  // Since scanning 381 stocks with chronological file operations takes some time,
  // we do the calculations carefully, restricting history slicing and falling back elegantly
  for (const stock of allStocks) {
    try {
      const sym = stock.symbol;
      const price = stock.price || 10;
      const rsiTargetRange = 40;

      // 1. Fetch small history segment to keep reads extremely fast
      const hist = getStockHistory(sym, 30);
      const data = hist.data || [];
      const ind = calculateTechnicalIndicators(data);

      const rsi = ind.rsi14 ?? 50;
      const macd = ind.macd ?? 0;
      const macdSignal = ind.macdSignal ?? 0;
      const sma20 = ind.sma20 ?? price;
      
      const todayVol = stock.volume ?? (data.length > 0 ? (data[data.length - 1].volume ?? 0) : 0);
      const avgVol = ind.avgVolume20D ?? stock.avgVolume ?? 10000;
      const relVol20 = avgVol > 0 ? todayVol / avgVol : 1.0;

      const fhr = calculateCsFhr(stock);
      const pe = stock.peRatio ?? 15;
      const sectorAvgPE = sectorAvgs[stock.sector] || 14.0;
      const revGrowth = stock.revGrowth ?? 0;
      const divYield = stock.divYield ?? 0;

      // Calculate Breakout Score
      const bUpper = ind.bollingerUpper ?? price * 1.1;
      const bLower = ind.bollingerLower ?? price * 0.9;
      const bandwidth = bUpper - bLower;

      let breakoutScore = 50;
      let proxFraction = 0.5;
      let resistanceTests = 0;

      const last30 = data.slice(-30);
      if (last30.length > 0) {
        const high = Math.max(...last30.map(r => r.high ?? r.close ?? price));
        const low = Math.min(...last30.map(r => r.low ?? r.close ?? price));
        const close = last30[last30.length - 1].close ?? price;
        const pivot = (high + low + close) / 3;
        const r1 = 2 * pivot - low;
        const s1 = 2 * pivot - high;
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
      if (price > sma20) bScore += 15;
      breakoutScore = Math.min(100, Math.max(0, Math.round(bScore)));

      // Score computations
      let score = 0;
      const signals: string[] = [];

      // A. Technical Signals (up to 13)
      if (rsi < rsiTargetRange) {
        score += 3;
        signals.push(`RSI recovering oversold (${rsi.toFixed(1)})`);
      }
      if (macd > macdSignal) {
        score += 3;
        signals.push("Bullish MACD crossover");
      }
      if (price > sma20 && (data.length > 1 && (data[data.length - 2]?.close ?? 0) <= sma20)) {
        score += 2;
        signals.push("Price crossed above SMA20");
      } else if (price > sma20) {
        score += 1; // minor signal
      }
      if (breakoutScore > 70) {
        score += 3;
        signals.push(`High Breakout score (${breakoutScore})`);
      }
      if (relVol20 > 1.5) {
        score += 2;
        signals.push("Institutional volume spike");
      }

      // B. Fundamentals (up to 6)
      if (fhr >= 65) {
        score += 2;
        signals.push(`Exceptional solvency (CS-FHR: ${fhr})`);
      }
      if (pe > 0 && pe < sectorAvgPE) {
        score += 2;
        signals.push(`Undervalued vs Sector PE (PE: ${pe.toFixed(1)})`);
      }
      if (revGrowth > 10) {
        score += 1;
        signals.push(`Strong top-line growth (+${revGrowth}%)`);
      }
      if (divYield > 4.0) {
        score += 1;
        signals.push(`High dividend safety yield (${divYield}%)`);
      }

      // C. Price Action (up to 5)
      const low52W = ind.low52W || stock.week52Low || (price * 0.85);
      const isNearLow = price <= low52W * 1.10;
      if (isNearLow) {
        score += 2;
        signals.push("Trade range near 52-week low");
      }

      // 5% recovery from recent low (using lowest close in past 30 days)
      const minClose30D = data.length > 0 ? Math.min(...data.map(r => r.close ?? price)) : price;
      if (price >= minClose30D * 1.05) {
        score += 2;
        signals.push("Recovered 5%+ from near support low");
      }

      // Low volatility consolidation
      if ((ind.volatility ?? 0) < 2.0) {
        score += 1;
        signals.push("Low variance consolidation");
      }

      // Determine indicator momentum profile
      let tradingSignal = "NEUTRAL";
      if (score >= 15) tradingSignal = "STRONG POSITIVE MOMENTUM";
      else if (score >= 10) tradingSignal = "MODERATE POSITIVE MOMENTUM";
      else if (score >= 6) tradingSignal = "MILD POSITIVE BIAS";

      results.push({
        symbol: sym,
        name: stock.name,
        sector: stock.sector,
        opportunityScore: score,
        currentPrice: price,
        signals,
        tradingSignal,
        breakoutScore,
        relVol20: parseFloat(relVol20.toFixed(2)),
        fundamentalScore: fhr
      });

    } catch (err) {
      // Fail-safe skip to ensure build safety
      console.warn(`Error scanning stock ${stock.symbol}:`, err);
    }
  }

  // Sort by opportunityScore descending and limit
  const sorted = results.sort((a, b) => b.opportunityScore - a.opportunityScore);

  opportunityCache = {
    timestamp: now,
    data: sorted
  };

  return sorted;
}
