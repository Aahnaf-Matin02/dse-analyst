import { getStockBySymbol } from "../repositories/stockRepository";
import { getStockHistory } from "../repositories/historicalRepository";
import { calculateTechnicalIndicators } from "./technicalIndicators";
import { calculateRelativeVolume } from "./relativeVolume";
import { BreakoutResult } from "../../src/types";

export async function calculateBreakoutScore(symbol: string): Promise<BreakoutResult> {
  const sym = symbol.toUpperCase().trim();
  const stock = getStockBySymbol(sym);
  if (!stock) {
    throw new Error(`Stock not found with symbol ${sym}`);
  }

  const hist = getStockHistory(sym, 260);
  const data = hist.data || [];
  const price = stock.price || 10;

  // Technical calculations
  const ind = calculateTechnicalIndicators(data);
  const relVolInfo = await calculateRelativeVolume(sym);

  const sma20 = ind.sma20 ?? price;
  const bUpper = ind.bollingerUpper ?? price * 1.1;
  const bLower = ind.bollingerLower ?? price * 0.9;
  const bandwidth = bUpper - bLower;
  const relVol20 = relVolInfo.relVol20;

  // Let's derive clean S1, R1 from last 30 trade rows pivots (similar to entry/exit)
  const last30 = data.slice(-30);
  let s1 = price * 0.95;
  let r1 = price * 1.05;
  if (last30.length > 0) {
    const high = Math.max(...last30.map(r => r.high ?? r.close ?? price));
    const low = Math.min(...last30.map(r => r.low ?? r.close ?? price));
    const close = last30[last30.length - 1].close ?? price;
    const pivot = (high + low + close) / 3;
    r1 = 2 * pivot - low;
    s1 = 2 * pivot - high;

    s1 = Math.min(price, s1);
    r1 = Math.max(price, r1);
  }

  // Count tests of R1 in past 20 trading days
  const last20 = data.slice(-20);
  const testedMargin = r1 * 0.98; // high is within 2% of resistance R1
  const resistanceTests = last20.filter(r => (r.high ?? r.close ?? 0) >= testedMargin).length;

  // Scoring
  const components: Record<string, number> = {};

  // 1. Proximity to resistance R1
  const proxDenom = (r1 - s1) > 0 ? (r1 - s1) : 1;
  const proxFraction = (price - s1) / proxDenom;
  components.proximity = parseFloat(Math.max(0, Math.min(25, proxFraction * 25)).toFixed(2));

  // 2. Bollinger Band squeeze (bandwidth < 0.05 * price => +20 pts, bandwidth < 0.08 * price => +10 pts)
  if (bandwidth < 0.05 * price) {
    components.squeeze = 20;
  } else if (bandwidth < 0.08 * price) {
    components.squeeze = 10;
  } else {
    components.squeeze = 0;
  }

  // 3. Volume confirmation
  if (relVol20 > 1.5) {
    components.volume = 20;
  } else if (relVol20 > 1.0) {
    components.volume = 10;
  } else {
    components.volume = 0;
  }

  // 4. Resistance test frequency
  if (resistanceTests >= 3) {
    components.resistanceTests = 20;
  } else if (resistanceTests >= 1) {
    components.resistanceTests = 10;
  } else {
    components.resistanceTests = 0;
  }

  // 5. Trend Alignment
  if (price > sma20) {
    components.trendAlignment = 15;
  } else {
    components.trendAlignment = 0;
  }

  const breakoutScore = Object.values(components).reduce((sum, v) => sum + v, 0);
  const roundedScore = Math.min(100, Math.max(0, Math.round(breakoutScore)));

  // Signals
  let signal = "No Setup";
  let interpretation = "";

  if (roundedScore >= 80) {
    signal = "Imminent Breakout";
    interpretation = "Squeeze consolidation with high volume buildup suggests an energetic upward breakout is imminent.";
  } else if (roundedScore >= 60) {
    signal = "Breakout Building";
    interpretation = "Bullish momentum is accumulating as the resistance level is repeatedly tested under rising volume.";
  } else if (roundedScore >= 40) {
    signal = "Consolidating";
    interpretation = "Trading range-bound in normal consolidation. No clear breakout pattern active.";
  } else if (roundedScore >= 20) {
    signal = "No Setup";
    interpretation = "Lack of volume growth, narrow tests, and weak price trend indicators. Low opportunity setups.";
  } else {
    signal = "Breakdown Risk";
    interpretation = "Weak support levels combined with bearish distribution signals indicate severe downside breakdown risk.";
  }

  return {
    symbol: sym,
    breakoutScore: roundedScore,
    signal,
    proximityToR1: parseFloat((proxFraction * 100).toFixed(1)),
    bandWidth: parseFloat(((bandwidth / price) * 100).toFixed(2)),
    resistanceTests,
    components,
    interpretation
  };
}
