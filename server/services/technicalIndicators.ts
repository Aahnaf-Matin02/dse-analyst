import { HistoryRow } from "../repositories/historicalRepository";

export interface TechnicalIndicators {
  return7D: number | null;
  return30D: number | null;
  return90D: number | null;
  return180D: number | null;
  return1Y: number | null;
  sma5: number | null;
  sma10: number | null;
  sma20: number | null;
  sma50: number | null;
  sma100: number | null;
  sma200: number | null;
  ema12: number | null;
  ema26: number | null;
  rsi14: number | null;
  macd: number | null;
  macdSignal: number | null;
  bollingerUpper: number | null;
  bollingerMiddle: number | null;
  bollingerLower: number | null;
  support: number | null;
  resistance: number | null;
  volatility: number | null; // represented as 30D StdDev percentage
  high52W: number | null;
  low52W: number | null;
  avgVolume20D: number | null;
  volumeTrend: "Up" | "Down" | "Flat" | null;
  drawdown: number | null;
  priceEnvelopeUpper: number | null;
  priceEnvelopeLower: number | null;
  dataQuality: "Sufficient" | "PartialHistory" | "InsufficientHistory";
  rowsUsed: number;
  minimumRowsRequired: number;
}

export function calculateTechnicalIndicators(rows: HistoryRow[]): TechnicalIndicators {
  const result: TechnicalIndicators = {
    return7D: null,
    return30D: null,
    return90D: null,
    return180D: null,
    return1Y: null,
    sma5: null,
    sma10: null,
    sma20: null,
    sma50: null,
    sma100: null,
    sma200: null,
    ema12: null,
    ema26: null,
    rsi14: null,
    macd: null,
    macdSignal: null,
    bollingerUpper: null,
    bollingerMiddle: null,
    bollingerLower: null,
    support: null,
    resistance: null,
    volatility: null,
    high52W: null,
    low52W: null,
    avgVolume20D: null,
    volumeTrend: null,
    drawdown: null,
    priceEnvelopeUpper: null,
    priceEnvelopeLower: null,
    dataQuality: "InsufficientHistory",
    rowsUsed: rows.length,
    minimumRowsRequired: 50
  };

  if (rows.length === 0) {
    return result;
  }

  // Determine data quality
  if (rows.length < 50) {
    result.dataQuality = "InsufficientHistory";
  } else if (rows.length < 200) {
    result.dataQuality = "PartialHistory";
  } else {
    result.dataQuality = "Sufficient";
  }

  // Sort rows ascending chronologically to compute correctly
  const sorted = [...rows].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const closes = sorted.map(r => r.close ?? r.ltp ?? 0);
  const volumes = sorted.map(r => r.volume ?? 0);
  const len = sorted.length;

  // Closes checks: make sure none is null
  const cleanCloses = closes.map((c, idx) => c === 0 ? (closes[idx - 1] || closes[idx + 1] || 1) : c);

  // 1. Returns calculation (using closing prices)
  const getReturn = (period: number): number | null => {
    if (len > period) {
      const today = cleanCloses[len - 1];
      const prev = cleanCloses[len - 1 - period];
      if (prev > 0) {
        return parseFloat((((today - prev) / prev) * 100).toFixed(2));
      }
    }
    return null;
  };

  result.return7D = getReturn(7);
  result.return30D = getReturn(30);
  result.return90D = getReturn(90);
  result.return180D = getReturn(180);
  result.return1Y = getReturn(250); // ~250 trading days in a year

  // Helper inside to calculate SMA
  const calcSMA = (prices: number[], period: number, endIndex: number): number | null => {
    if (endIndex - period + 1 < 0) return null;
    let sum = 0;
    for (let i = endIndex - period + 1; i <= endIndex; i++) {
      sum += prices[i];
    }
    return sum / period;
  };

  // Helper inside to calculate EMA
  const calcEMA = (prices: number[], period: number): number[] => {
    const k = 2 / (period + 1);
    const ema: number[] = new Array(prices.length).fill(0);
    
    // Seed first EMA with SMA
    let seedSum = 0;
    const actualPeriod = Math.min(period, prices.length);
    for (let i = 0; i < actualPeriod; i++) {
      seedSum += prices[i];
    }
    const seedSMA = seedSum / Math.max(1, actualPeriod);
    ema[actualPeriod - 1] = seedSMA;

    for (let i = actualPeriod; i < prices.length; i++) {
      ema[i] = prices[i] * k + ema[i - 1] * (1 - k);
    }
    return ema;
  };

  // 2. SMAs (return null if insufficient elements)
  const v5 = calcSMA(cleanCloses, 5, len - 1);
  const v10 = calcSMA(cleanCloses, 10, len - 1);
  const v20 = calcSMA(cleanCloses, 20, len - 1);
  const v50 = calcSMA(cleanCloses, 50, len - 1);
  const v100 = calcSMA(cleanCloses, 100, len - 1);
  const v200 = calcSMA(cleanCloses, 200, len - 1);

  result.sma5 = v5 !== null ? parseFloat(v5.toFixed(2)) : null;
  result.sma10 = v10 !== null ? parseFloat(v10.toFixed(2)) : null;
  result.sma20 = v20 !== null ? parseFloat(v20.toFixed(2)) : null;
  result.sma50 = v50 !== null ? parseFloat(v50.toFixed(2)) : null;
  result.sma100 = v100 !== null ? parseFloat(v100.toFixed(2)) : null;
  result.sma200 = v200 !== null ? parseFloat(v200.toFixed(2)) : null;

  // 3. EMAs
  const ema12Arr = calcEMA(cleanCloses, 12);
  const ema26Arr = calcEMA(cleanCloses, 26);
  result.ema12 = len >= 12 ? parseFloat(ema12Arr[len - 1].toFixed(2)) : null;
  result.ema26 = len >= 26 ? parseFloat(ema26Arr[len - 1].toFixed(2)) : null;

  // MACD & Signal Line
  if (len >= 26) {
    const macdLine: number[] = [];
    for (let i = 0; i < len; i++) {
      macdLine.push(ema12Arr[i] - ema26Arr[i]);
    }
    result.macd = parseFloat((ema12Arr[len - 1] - ema26Arr[len - 1]).toFixed(2));

    const macdK = 2 / (9 + 1);
    const macdSignalArr: number[] = new Array(len).fill(0);
    
    let macdSeedSum = 0;
    const seedStart = 25;
    if (len >= seedStart + 9) {
      for (let i = seedStart; i < seedStart + 9; i++) {
        macdSeedSum += macdLine[i];
      }
      macdSignalArr[seedStart + 8] = macdSeedSum / 9;

      for (let i = seedStart + 9; i < len; i++) {
        macdSignalArr[i] = macdLine[i] * macdK + macdSignalArr[i - 1] * (1 - macdK);
      }
      result.macdSignal = parseFloat(macdSignalArr[len - 1].toFixed(2));
    }
  }

  // 4. RSI (14)
  if (len >= 15) {
    let gains = 0;
    let losses = 0;

    for (let i = 1; i <= 14; i++) {
      const diff = cleanCloses[i] - cleanCloses[i - 1];
      if (diff > 0) gains += diff;
      else losses -= diff;
    }
    let avgGain = gains / 14;
    let avgLoss = losses / 14;

    for (let i = 15; i < len; i++) {
      const change = cleanCloses[i] - cleanCloses[i - 1];
      const currentGain = change > 0 ? change : 0;
      const currentLoss = change < 0 ? -change : 0;

      avgGain = (avgGain * 13 + currentGain) / 14;
      avgLoss = (avgLoss * 13 + currentLoss) / 14;
    }
    
    if (avgLoss === 0) {
      result.rsi14 = 100;
    } else {
      const rs = avgGain / avgLoss;
      result.rsi14 = parseFloat((100 - 100 / (1 + rs)).toFixed(2));
    }
  }

  // 5. Bollinger Bands (20, 2)
  if (result.sma20 !== null) {
    const bbMiddle = result.sma20;
    let stdDevSum = 0;
    for (let i = len - 20; i < len; i++) {
      stdDevSum += Math.pow(cleanCloses[i] - bbMiddle, 2);
    }
    const stdDev = Math.sqrt(stdDevSum / 20);

    result.bollingerMiddle = bbMiddle;
    result.bollingerUpper = parseFloat((bbMiddle + 2 * stdDev).toFixed(2));
    result.bollingerLower = parseFloat((bbMiddle - 2 * stdDev).toFixed(2));
  }

  // 6. Support & Resistance (Minimum & Maximum of past 30 trading days closes)
  const localPrices = cleanCloses.slice(-30);
  if (localPrices.length > 0) {
    result.support = parseFloat(Math.min(...localPrices).toFixed(2));
    result.resistance = parseFloat(Math.max(...localPrices).toFixed(2));
  }

  // 7. Volatility (30D daily close changes StdDev)
  const rangeVol = Math.min(30, len);
  const returns: number[] = [];
  for (let i = len - rangeVol + 1; i < len; i++) {
    const prev = cleanCloses[i - 1] || cleanCloses[i];
    if (prev > 0) {
      returns.push((cleanCloses[i] - prev) / prev);
    }
  }
  if (returns.length > 0) {
    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const returnVarianceSum = returns.reduce((cur, val) => cur + Math.pow(val - avgReturn, 2), 0);
    result.volatility = parseFloat((Math.sqrt(returnVarianceSum / returns.length) * 100).toFixed(2));
  }

  // 8. 52-Week High & Low (up to last 250 rows)
  const yearlyPrices = cleanCloses.slice(-250);
  if (yearlyPrices.length > 0) {
    result.high52W = parseFloat(Math.max(...yearlyPrices).toFixed(2));
    result.low52W = parseFloat(Math.min(...yearlyPrices).toFixed(2));
  }

  // 9. Volume Indicators (20D Avg)
  const last20Volumes = volumes.slice(-20);
  if (last20Volumes.length > 0) {
    result.avgVolume20D = Math.floor(last20Volumes.reduce((a, b) => a + b, 0) / last20Volumes.length);

    const last5VolAvg = volumes.slice(-5).reduce((a, b) => a + b, 0) / 5;
    const prev15VolAvg = volumes.slice(-20, -5).reduce((a, b) => a + b, 0) / Math.max(1, volumes.slice(-20, -5).length);

    if (last5VolAvg > prev15VolAvg * 1.1) {
      result.volumeTrend = "Up";
    } else if (last5VolAvg < prev15VolAvg * 0.9) {
      result.volumeTrend = "Down";
    } else {
      result.volumeTrend = "Flat";
    }
  }

  // 10. Max Drawdown
  let peak = -Infinity;
  let maxDrawdown = 0;
  cleanCloses.forEach(price => {
    if (price > peak) peak = price;
    if (peak > 0) {
      const dd = (peak - price) / peak;
      if (dd > maxDrawdown) maxDrawdown = dd;
    }
  });
  result.drawdown = parseFloat((maxDrawdown * 100).toFixed(2));

  // 11. Price Envelope Upper & Lower Bands (drawn at 5% width around 20 SMA)
  if (result.sma20 !== null) {
    result.priceEnvelopeUpper = parseFloat((result.sma20 * 1.05).toFixed(2));
    result.priceEnvelopeLower = parseFloat((result.sma20 * 0.95).toFixed(2));
  }

  return result;
}
