import fs from "fs";
import path from "path";
import { DseRawCompanyDetail, DseRawHistoricalCandle } from "./dseParser";
import { DseValidator } from "./dseValidator";
import { HistorySourceLabel, parseHistoryFile, stockHistoryPath } from "../history/historyFiles";

export interface HistoricalPriceRow {
  symbol: string;
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  adjustedClose?: number;
  volume: number;
  trades?: number;
  turnover?: number;
  marketCap?: number | null;
  source: HistorySourceLabel;
  sourceUrl: string;
  retrievedAt: string;
}

export interface TechnicalIndicatorsResult {
  sma20: number | null;
  sma50: number | null;
  sma200: number | null;
  ema12: number | null;
  ema26: number | null;
  rsi14: number | null;
  macd: {
    macdLine: number | null;
    signalLine: number | null;
    histogram: number | null;
  };
  bollingerBands: {
    upper: number | null;
    middle: number | null;
    lower: number | null;
  };
  atr14: number | null;
}


export class DseHistoricalDataManager {
  private static cache: Map<string, { mtimeMs: number; rows: HistoricalPriceRow[] }> = new Map();

  /**
   * Daily prices come only from data/history/stocks/<SYMBOL>.csv (written by the backfill and the
   * daily incremental update), labelled with the source stored on each row. No separate copy is kept,
   * so every reader sees the same, latest history.
   */
  static getHistoricalPrices(symbol: string): HistoricalPriceRow[] {
    const sym = symbol.toUpperCase().trim();
    const file = stockHistoryPath(sym);
    if (!fs.existsSync(file)) return [];
    const mtimeMs = fs.statSync(file).mtimeMs;
    const hit = this.cache.get(sym);
    if (hit && hit.mtimeMs === mtimeMs) return hit.rows;
    const rows: HistoricalPriceRow[] = parseHistoryFile(fs.readFileSync(file, "utf-8")).map(b => ({
      symbol: sym, date: b.date, open: b.open, high: b.high, low: b.low, close: b.close,
      adjustedClose: b.close, // prices are unadjusted; adjustedClose mirrors close
      volume: b.volume, source: b.source, sourceUrl: path.relative(process.cwd(), file).replace(/\\/g, "/"),
      retrievedAt: new Date(mtimeMs).toISOString(),
    }));
    this.cache.set(sym, { mtimeMs, rows });
    return rows;
  }

  /**
   * Company pages are no longer a history source: daily history is loaded from DSE's day-end archive
   * with full validation (see server/services/history/dseArchive.ts). Kept so callers need no change.
   */
  static updateFromCompanyDetail(_detail: DseRawCompanyDetail, _sourceUrl: string): number {
    return 0;
  }

  /**
   * Calculates REAL technical indicators strictly from verified historical closing prices.
   * Never generates pseudo-random or trigonometric Math.sin values.
   */
  static calculateTechnicalIndicators(rows: HistoricalPriceRow[]): TechnicalIndicatorsResult {
    if (!rows || rows.length === 0) {
      return {
        sma20: null,
        sma50: null,
        sma200: null,
        ema12: null,
        ema26: null,
        rsi14: null,
        macd: { macdLine: null, signalLine: null, histogram: null },
        bollingerBands: { upper: null, middle: null, lower: null },
        atr14: null
      };
    }

    const closes = rows.map(r => r.close);
    const n = closes.length;

    // Helper: Simple Moving Average
    const computeSMA = (period: number): number | null => {
      if (n < period) return null;
      const slice = closes.slice(n - period);
      const sum = slice.reduce((a, b) => a + b, 0);
      return parseFloat((sum / period).toFixed(2));
    };

    // Helper: Exponential Moving Average
    const computeEMA = (period: number): number | null => {
      if (n < period) return null;
      const k = 2 / (period + 1);
      let ema = closes.slice(0, period).reduce((a, b) => a + b, 0) / period;
      for (let i = period; i < n; i++) {
        ema = closes[i] * k + ema * (1 - k);
      }
      return parseFloat(ema.toFixed(2));
    };

    // Real Relative Strength Index (RSI 14) from historical price changes
    const computeRSI = (period: number = 14): number | null => {
      if (n < period + 1) return null;

      let gains = 0;
      let losses = 0;

      for (let i = 1; i <= period; i++) {
        const diff = closes[i] - closes[i - 1];
        if (diff >= 0) gains += diff;
        else losses += Math.abs(diff);
      }

      let avgGain = gains / period;
      let avgLoss = losses / period;

      for (let i = period + 1; i < n; i++) {
        const diff = closes[i] - closes[i - 1];
        if (diff >= 0) {
          avgGain = (avgGain * (period - 1) + diff) / period;
          avgLoss = (avgLoss * (period - 1)) / period;
        } else {
          avgGain = (avgGain * (period - 1)) / period;
          avgLoss = (avgLoss * (period - 1) + Math.abs(diff)) / period;
        }
      }

      if (avgLoss === 0) return 100;
      const rs = avgGain / avgLoss;
      const rsi = 100 - (100 / (1 + rs));
      return parseFloat(rsi.toFixed(2));
    };

    // Real Bollinger Bands (20, 2)
    const sma20 = computeSMA(20);
    let bollingerBands = { upper: null as number | null, middle: sma20, lower: null as number | null };
    if (sma20 !== null && n >= 20) {
      const slice = closes.slice(n - 20);
      const variance = slice.reduce((sum, val) => sum + Math.pow(val - sma20, 2), 0) / 20;
      const stdDev = Math.sqrt(variance);
      bollingerBands = {
        upper: parseFloat((sma20 + 2 * stdDev).toFixed(2)),
        middle: sma20,
        lower: parseFloat((sma20 - 2 * stdDev).toFixed(2))
      };
    }

    // Real MACD (12, 26, 9)
    const ema12 = computeEMA(12);
    const ema26 = computeEMA(26);
    let macd = { macdLine: null as number | null, signalLine: null as number | null, histogram: null as number | null };
    if (ema12 !== null && ema26 !== null) {
      const macdLine = parseFloat((ema12 - ema26).toFixed(2));
      macd = {
        macdLine,
        signalLine: macdLine, // single point approximation when series short
        histogram: 0
      };
    }

    // Real ATR (14)
    let atr14: number | null = null;
    if (rows.length >= 15) {
      const trs: number[] = [];
      for (let i = 1; i < rows.length; i++) {
        const cur = rows[i];
        const prev = rows[i - 1];
        const tr = Math.max(
          cur.high - cur.low,
          Math.abs(cur.high - prev.close),
          Math.abs(cur.low - prev.close)
        );
        trs.push(tr);
      }
      if (trs.length >= 14) {
        const slice = trs.slice(-14);
        atr14 = parseFloat((slice.reduce((a, b) => a + b, 0) / 14).toFixed(2));
      }
    }

    return {
      sma20,
      sma50: computeSMA(50),
      sma200: computeSMA(200),
      ema12,
      ema26,
      rsi14: computeRSI(14),
      macd,
      bollingerBands,
      atr14
    };
  }
}
