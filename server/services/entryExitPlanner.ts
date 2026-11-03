import { getStockBySymbol } from "../repositories/stockRepository";
import { getStockHistory } from "../repositories/historicalRepository";
import { calculateTechnicalIndicators } from "./technicalIndicators";
import { EntryExitPlan } from "../../src/types";

/**
 * Calculates ATR (Average True Range) on 14 periods chronologically
 */
export function calculateATR(rows: any[], period = 14): number {
  if (!rows || rows.length < period + 1) {
    // Return a realistic fraction (2.5%) of the last close as a fallback
    if (rows && rows.length > 0) {
      return (rows[rows.length - 1].close || 10) * 0.025;
    }
    return 1.5;
  }

  const trs: number[] = [];
  for (let i = 1; i < rows.length; i++) {
    const high = rows[i].high ?? rows[i].close ?? 0;
    const low = rows[i].low ?? rows[i].close ?? 0;
    const prevClose = rows[i - 1].close ?? rows[i - 1].ltp ?? 0;

    const tr = Math.max(
      high - low,
      Math.abs(high - prevClose),
      Math.abs(low - prevClose)
    );
    trs.push(tr);
  }

  // Calculate simple moving average of first 14 TRs
  let atr = trs.slice(0, period).reduce((sum, tr) => sum + tr, 0) / period;

  // Smoother Wilder's EMA for trailing rows
  for (let i = period; i < trs.length; i++) {
    atr = (atr * (period - 1) + trs[i]) / period;
  }

  return Math.max(0.01, atr);
}

/**
 * Compute suggested technical price support corridors, resistance boundaries, and trailing volatility envelopes
 */
export async function planEntryExit(symbol: string): Promise<EntryExitPlan> {
  const sym = symbol.toUpperCase().trim();
  const stock = getStockBySymbol(sym);
  if (!stock) {
    throw new Error(`Stock not found with symbol ${sym}`);
  }

  const hist = getStockHistory(sym, 260);
  const data = hist.data || [];
  const currentPrice = stock.price || 10;

  // Calculate generic indicators
  const ind = calculateTechnicalIndicators(data);
  const atr = calculateATR(data, 14);

  // Derive R1, R2, S1, S2 from last 30 trade rows (pivot points)
  const last30 = data.slice(-30);
  let pivot = currentPrice;
  let s1 = currentPrice * 0.95;
  let s2 = currentPrice * 0.90;
  let r1 = currentPrice * 1.05;
  let r2 = currentPrice * 1.10;

  if (last30.length > 0) {
    const high = Math.max(...last30.map(r => r.high ?? r.close ?? currentPrice));
    const low = Math.min(...last30.map(r => r.low ?? r.close ?? currentPrice));
    const close = last30[last30.length - 1].close ?? currentPrice;

    pivot = (high + low + close) / 3;
    r1 = 2 * pivot - low;
    s1 = 2 * pivot - high;
    r2 = pivot + (high - low);
    s2 = pivot - (high - low);

    // Sanity bounding of support and resistance
    s1 = Math.min(currentPrice, s1);
    s2 = Math.min(s1 - 0.1, s2);
    r1 = Math.max(currentPrice, r1);
    r2 = Math.max(r1 + 0.1, r2);
  }

  // S1/S2 should not be zero or negative
  s1 = Math.max(0.1, s1);
  s2 = Math.max(0.05, s2);

  // Technical Support Corridor calculations
  const aggressiveEntry = parseFloat(Math.max(s1, currentPrice - 0.5 * atr).toFixed(2));
  const conservativeEntry = parseFloat(Math.max(s2, currentPrice - 1.0 * atr).toFixed(2));

  // Stop loss relative to Conservative Entry (more baseline protection)
  const tightStop = parseFloat(Math.max(0.02, conservativeEntry - 1.5 * atr).toFixed(2));
  const normalStop = parseFloat(Math.max(0.01, conservativeEntry - 2.0 * atr).toFixed(2));
  const wideStop = parseFloat(Math.max(0.01, conservativeEntry - 3.0 * atr).toFixed(2));

  // Exit Targets
  const bollingerUpper = ind.bollingerUpper ?? currentPrice * 1.08;
  const t1 = parseFloat(r1.toFixed(2));
  const t2 = parseFloat(r2.toFixed(2));
  const t3 = parseFloat(bollingerUpper.toFixed(2));
  const stretch = ind.high52W ? parseFloat(ind.high52W.toFixed(2)) : parseFloat((bollingerUpper * 1.05).toFixed(2));

  // Trailing Stop from current price
  const trailingStop = parseFloat(Math.max(0.01, currentPrice - 1.5 * atr).toFixed(2));

  // Educational commentary on technical reference channels
  const notes: string[] = [];
  if (currentPrice > (ind.sma20 ?? currentPrice)) {
    notes.push("Short-term momentum: Stock price is currently above its 20-day SMA, indicating upward short-term trend momentum.");
  } else {
    notes.push("Short-term momentum: Stock price is tracking beneath its 20-day SMA, indicating short-term consolidation or soft momentum.");
  }

  if (atr / currentPrice > 0.05) {
    notes.push("Volatility Profile: Historical ATR reflects elevated daily price variance. Notice wider statistical dispersion corridors.");
  } else {
    notes.push("Volatility Profile: Compressed daily volatility. The stock is oscillating within narrower historical price bands.");
  }

  if (currentPrice >= s1 && currentPrice <= r1) {
    notes.push(`Channel Range: Current quotation is positioned between mathematical Support ৳${s1.toFixed(1)} and Resistance ৳${r1.toFixed(1)}.`);
  }

  return {
    symbol: sym,
    currentPrice,
    entryZone: {
      aggressive: aggressiveEntry,
      conservative: conservativeEntry
    },
    stopLoss: {
      tight: tightStop,
      normal: normalStop,
      wide: wideStop
    },
    targets: {
      t1,
      t2,
      t3,
      stretch
    },
    trailingStop,
    atr: parseFloat(atr.toFixed(2)),
    notes
  };
}
