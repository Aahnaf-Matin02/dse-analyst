import { getStockBySymbol, getAllStocks } from "../repositories/stockRepository";
import { getStockHistory } from "../repositories/historicalRepository";
import { calculateTechnicalIndicators } from "./technicalIndicators";
import { TradingSignalResult } from "../../src/types";

/**
 * Calculates the CS-FHR corporate solvency health rate from 0-100
 */
export function calculateCsFhr(stock: any): number {
  let score = 55; // Base
  if (stock.financials) {
    const roe = stock.financials.roe ?? 0.12;
    const debt = stock.financials.debtRatio ?? 0.35;
    const pe = stock.peRatio ?? 15;
    const roa = stock.financials.roa ?? 0.05;

    if (pe > 0 && pe < 11) score += 10;
    else if (pe >= 18) score -= 10;

    if (roe > 0.18) score += 15;
    else if (roe > 0.12) score += 10;
    else if (roe < 0.06) score -= 10;

    if (debt <= 0.35) score += 15;
    else if (debt <= 0.50) score += 5;
    else score -= 15;

    if (roa > 0.08) score += 10;
  } else {
    const pe = stock.peRatio ?? 15;
    const divYield = stock.divYield ?? 4;
    const profitGrowth = stock.profitGrowth ?? 5;

    if (pe > 0 && pe < 11) score += 10;
    else if (pe > 25) score -= 10;

    if (divYield > 6.0) score += 10;
    if (profitGrowth > 15) score += 10;
    else if (profitGrowth < 0) score -= 10;
  }
  return Math.max(10, Math.min(100, score));
}

/**
 * Calculates a robust trading opportunity signal for a stock
 */
export async function calculateTradingOpportunitySignal(symbol: string): Promise<TradingSignalResult> {
  const sym = symbol.toUpperCase().trim();
  const stock = getStockBySymbol(sym);
  if (!stock) {
    throw new Error(`Stock not found with symbol ${sym}`);
  }

  // Get historical data
  const hist = getStockHistory(sym, 260);
  const ind = calculateTechnicalIndicators(hist.data);

  // Fallback defaults for indicators if we don't have enough history
  const rsi = ind.rsi14 ?? 50;
  const macd = ind.macd ?? 0;
  const macdSignal = ind.macdSignal ?? 0;
  const price = stock.price || 10;
  const sma20 = ind.sma20 ?? price;
  const sma50 = ind.sma50 ?? price;
  const avgVol = ind.avgVolume20D ?? stock.avgVolume ?? 10000;
  const todayVol = stock.volume ?? (hist.data.length > 0 ? (hist.data[hist.data.length - 1].volume ?? 0) : 0);
  
  const bUpper = ind.bollingerUpper ?? price * 1.1;
  const bLower = ind.bollingerLower ?? price * 0.9;
  const bbWidth = bUpper - bLower;
  const bbPosition = bbWidth > 0 ? (price - bLower) / bbWidth : 0.5;

  const fhr = calculateCsFhr(stock);

  // Dynamic sector PE average calculation from live stock cache
  const allStocks = getAllStocks();
  const sectorStocks = allStocks.filter(s => s.sector === stock.sector && s.peRatio !== null && s.peRatio > 0);
  const sectPE = sectorStocks.length > 0 
    ? sectorStocks.reduce((sum, s) => sum + (s.peRatio || 0), 0) / sectorStocks.length 
    : 14.0;

  const pe = stock.peRatio ?? 15;

  // Signal Calculation
  const subScores: Record<string, number> = {};
  const reasoning: string[] = [];

  // RSI subscore
  if (rsi < 30) {
    subScores.rsi = 2;
    reasoning.push(`RSI is oversold at ${rsi.toFixed(1)} (Bullish rebound signal)`);
  } else if (rsi > 70) {
    subScores.rsi = -2;
    reasoning.push(`RSI is overbought at ${rsi.toFixed(1)} (Bearish cooling signal)`);
  } else {
    subScores.rsi = 0;
    reasoning.push(`RSI is neutral at ${rsi.toFixed(1)}`);
  }

  // MACD crossover subscore
  if (macd > macdSignal) {
    subScores.macd = 2;
    reasoning.push(`MACD Line (${macd.toFixed(2)}) is above signal line (${macdSignal.toFixed(2)}) (Bullish Crossover)`);
  } else {
    subScores.macd = -2;
    reasoning.push(`MACD Line (${macd.toFixed(2)}) is below signal line (${macdSignal.toFixed(2)}) (Bearish Crossover)`);
  }

  // Price trend (price vs SMAs)
  if (price > sma20 && sma20 > sma50) {
    subScores.trend = 2;
    reasoning.push(`Price showing upward momentum trend (Price > SMA20 > SMA50)`);
  } else if (price < sma20 && sma20 < sma50) {
    subScores.trend = -2;
    reasoning.push(`Price showing structural downward trend (Price < SMA20 < SMA50)`);
  } else {
    subScores.trend = 0;
    reasoning.push(`Shorter/longer term trend is mixed`);
  }

  // Relative volume subscore
  const volRatio = avgVol > 0 ? todayVol / avgVol : 1.0;
  if (volRatio > 1.5) {
    subScores.volume = 1;
    reasoning.push(`Volume spike of ${(volRatio).toFixed(1)}x over 20-day average confirms trend pressure`);
  } else {
    subScores.volume = 0;
    reasoning.push(`Volume of ${(volRatio).toFixed(1)}x is within historic range`);
  }

  // Bollinger Band Position
  if (bbPosition <= 0.15) {
    subScores.bollinger = 1;
    reasoning.push(`Price is sitting at/near lower Bollinger Band (${price} vs lower ${bLower.toFixed(1)}) indicating mean reversion support`);
  } else if (bbPosition >= 0.85) {
    subScores.bollinger = -1;
    reasoning.push(`Price is sitting at/near upper Bollinger Band (${price} vs upper ${bUpper.toFixed(1)}) indicating resistance risk`);
  } else {
    subScores.bollinger = 0;
    reasoning.push(`Price in lower/upper standard standard deviation range`);
  }

  // Solvency health rating (CS-FHR)
  if (fhr >= 65) {
    subScores.fundamentals = 1;
    reasoning.push(`Excellent solvency rating (CS-FHR: ${fhr}/100) confirms fundamental protection`);
  } else if (fhr < 45) {
    subScores.fundamentals = -1;
    reasoning.push(`Weak solvency warning (CS-FHR: ${fhr}/100) indicates structural debt risk`);
  } else {
    subScores.fundamentals = 0;
    reasoning.push(`Solvency score is comfortable (CS-FHR: ${fhr}/100)`);
  }

  // P/E valuation vs sector average
  if (pe > 0 && pe < sectPE) {
    subScores.valuation = 1;
    reasoning.push(`Valuation is undervalued compared to ${stock.sector} average (${pe.toFixed(1)}x vs Sector Avg ${sectPE.toFixed(1)}x)`);
  } else if (pe > 2 * sectPE) {
    subScores.valuation = -1;
    reasoning.push(`Premium pricing alert: PE multiple is 2x above sector average (${pe.toFixed(1)}x vs Sector Avg ${sectPE.toFixed(1)}x)`);
  } else {
    subScores.valuation = 0;
    reasoning.push(`P/E is within sector boundaries (${pe.toFixed(1)}x vs Sector Avg ${sectPE.toFixed(1)}x)`);
  }

  // Aggregate Total Scores
  const totalScore = Object.values(subScores).reduce((a, b) => a + b, 0);

  // Neutral Indicator Alignment Map (No investment recommendations)
  let signal: TradingSignalResult["signal"] = "NEUTRAL ALIGNMENT";
  if (totalScore >= 6) signal = "STRONG POSITIVE MOMENTUM";
  else if (totalScore >= 3) signal = "MODERATE POSITIVE MOMENTUM";
  else if (totalScore >= 1) signal = "SLIGHT POSITIVE BIAS";
  else if (totalScore === 0) signal = "NEUTRAL ALIGNMENT";
  else if (totalScore >= -2) signal = "SLIGHT NEGATIVE BIAS";
  else if (totalScore >= -5) signal = "MODERATE NEGATIVE MOMENTUM";
  else signal = "STRONG NEGATIVE MOMENTUM";

  // Educational Framing
  const whatItShows: string[] = [
    `Multi-factor technical & fundamental momentum balance score: ${totalScore > 0 ? `+${totalScore}` : totalScore} / 10.`,
    `Moving average alignment (SMA20: ${ind.sma20 ? `৳${ind.sma20.toFixed(1)}` : "N/A"}, SMA50: ${ind.sma50 ? `৳${ind.sma50.toFixed(1)}` : "N/A"}).`,
    `RSI momentum wave index: ${ind.rsi14 ? ind.rsi14.toFixed(1) : (rsi ? rsi.toFixed(1) : "N/A")}.`
  ];

  const whatItCannotTellYou: string[] = [
    "Does not predict future price direction or account for upcoming regulatory circulars.",
    "Does not audit private promoter actions or off-market block placements.",
    "Indicator values can lag sudden shifts in market-wide liquidity."
  ];

  const questionsToInvestigate: string[] = [
    "Are the underlying earnings (EPS) driven by recurring core business or one-off asset sales?",
    "How does this company's debt-to-equity and finance cost ratio compare with sector peers?",
    "Is the current daily trading volume driven by broad retail turnover or concentrated accounts?"
  ];

  // Confidence % calculation
  let confidenceScore = 65; // base
  if (ind.dataQuality === "Sufficient") confidenceScore += 10;
  if (Math.abs(totalScore) >= 5) confidenceScore += 10; // high convergence
  if (volRatio > 1.5) confidenceScore += 10; // trend validation
  if ((ind.volatility ?? 0) < 3.0) confidenceScore += 5; // reliable low variance

  // Bound to 0-100
  const confidence = Math.max(20, Math.min(100, confidenceScore));

  return {
    symbol: sym,
    signal,
    score: totalScore,
    subScores,
    reasoning,
    confidence,
    whatItShows,
    whatItCannotTellYou,
    questionsToInvestigate,
    generatedAt: new Date().toISOString()
  };
}
