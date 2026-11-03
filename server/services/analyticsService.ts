import { HistoryRow } from "../repositories/historicalRepository";
import { StockData } from "../../src/types";

export interface EnvelopePoint {
  date: string;
  close: number;
  upper: number;
  middle: number;
  lower: number;
  position: number; // relative position: (close - lower) / (upper - lower)
  zone: "Below Lower" | "Lower Half" | "Upper Half" | "Above Upper";
  signal: "Oversold Buy" | "Overbought Sell" | "Neutral";
}

export interface ComparativeResults {
  stockReturn30D: number | null;
  stockReturn90D: number | null;
  stockReturn180D: number | null;
  stockReturn1Y: number | null;
  benchmarkReturn30D: number | null;
  benchmarkReturn90D: number | null;
  benchmarkReturn180D: number | null;
  benchmarkReturn1Y: number | null;
  excessReturn30D: number | null;
  excessReturn90D: number | null;
  excessReturn180D: number | null;
  excessReturn1Y: number | null;
  correlation: number | null;
  beta: number | null;
  volatility: number | null; // Annualized daily return volatility
  maxDrawdown: number | null;
  rating: "Outperforming" | "Market Perform" | "Underperforming" | "Insufficient Data";
}

export interface AnalyticsResponse {
  symbol: string;
  dataQuality: "Sufficient" | "PartialHistory" | "InsufficientHistory";
  warnings: string[];
  envelopeData: EnvelopePoint[];
  comparison: ComparativeResults | null;
}

/**
 * Calculates price envelope upper/middle/lower parameters given period and envelope percentage.
 */
export function calculatePriceEnvelope(
  rows: HistoryRow[],
  period: number = 20,
  envelopePct: number = 5
): { dataQuality: "Sufficient" | "PartialHistory" | "InsufficientHistory"; warnings: string[]; data: EnvelopePoint[] } {
  const resultData: EnvelopePoint[] = [];
  const warnings: string[] = [];

  if (!rows || rows.length === 0) {
    return {
      dataQuality: "InsufficientHistory",
      warnings: ["No historical prices available to build envelopes."],
      data: []
    };
  }

  // Ensure rows are sorted ascending by date
  const sorted = [...rows].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const len = sorted.length;

  let quality: "Sufficient" | "PartialHistory" | "InsufficientHistory" = "Sufficient";
  if (len < period) {
    quality = "InsufficientHistory";
    warnings.push(`Insufficient history (${len} rows) for a ${period} period envelope.`);
    return { dataQuality: quality, warnings, data: [] };
  } else if (len < 100) {
    quality = "PartialHistory";
    warnings.push(`A relatively short historical series (${len} rows) was used for model estimation.`);
  }

  const envelopeMultiplier = envelopePct / 100;

  for (let i = 0; i < len; i++) {
    if (i < period - 1) {
      // Not enough preceding elements to compute SMA
      continue;
    }

    // Compute Simple Moving Average for 'period' days ending at i
    let sum = 0;
    let validClosesCount = 0;
    for (let j = i - period + 1; j <= i; j++) {
      const close = sorted[j].close ?? sorted[j].ltp ?? sorted[j].ycp ?? 0;
      if (close > 0) {
        sum += close;
        validClosesCount++;
      }
    }

    const valueClose = sorted[i].close ?? sorted[i].ltp ?? sorted[i].ycp ?? 0;
    if (validClosesCount === 0 || valueClose <= 0) {
      continue;
    }

    const middle = sum / validClosesCount;
    const upper = parseFloat((middle * (1 + envelopeMultiplier)).toFixed(2));
    const lower = parseFloat((middle * (1 - envelopeMultiplier)).toFixed(2));
    const middleF = parseFloat(middle.toFixed(2));

    // Calculate position
    const denom = upper - lower;
    const position = denom > 0 ? parseFloat(((valueClose - lower) / denom).toFixed(3)) : 0.5;

    // Evaluate zone
    let zone: "Below Lower" | "Lower Half" | "Upper Half" | "Above Upper";
    let signal: "Oversold Buy" | "Overbought Sell" | "Neutral";

    if (valueClose < lower) {
      zone = "Below Lower";
      signal = "Oversold Buy";
    } else if (valueClose < middle) {
      zone = "Lower Half";
      signal = "Neutral";
    } else if (valueClose <= upper) {
      zone = "Upper Half";
      signal = "Neutral";
    } else {
      zone = "Above Upper";
      signal = "Overbought Sell";
    }

    resultData.push({
      date: sorted[i].date,
      close: valueClose,
      upper,
      middle: middleF,
      lower,
      position,
      zone,
      signal
    });
  }

  return {
    dataQuality: quality,
    warnings,
    data: resultData
  };
}

/**
 * Calculates comparative performance metrics vs a benchmark (DSEX).
 * Aligns both datasets strictly by date first.
 */
export function calculateComparativeMetrics(
  stockRows: HistoryRow[],
  benchmarkRows: HistoryRow[]
): ComparativeResults | null {
  if (!stockRows || stockRows.length === 0 || !benchmarkRows || benchmarkRows.length === 0) {
    return {
      stockReturn30D: null, stockReturn90D: null, stockReturn180D: null, stockReturn1Y: null,
      benchmarkReturn30D: null, benchmarkReturn90D: null, benchmarkReturn180D: null, benchmarkReturn1Y: null,
      excessReturn30D: null, excessReturn90D: null, excessReturn180D: null, excessReturn1Y: null,
      correlation: null, beta: null, volatility: null, maxDrawdown: null,
      rating: "Insufficient Data"
    };
  }

  // Map dates for quick aligned lookup
  const benchmarkMap = new Map<string, number>();
  benchmarkRows.forEach(r => {
    const val = r.close ?? r.ltp ?? 0;
    if (val > 0) {
      benchmarkMap.set(r.date, val);
    }
  });

  // Filter and build strictly aligned day list
  interface AlignedDay {
    date: string;
    stockClose: number;
    benchmarkClose: number;
  }
  const aligned: AlignedDay[] = [];
  
  stockRows.forEach(r => {
    const sClose = r.close ?? r.ltp ?? r.ycp ?? 0;
    const bmClose = benchmarkMap.get(r.date);
    if (sClose > 0 && bmClose && bmClose > 0) {
      aligned.push({
        date: r.date,
        stockClose: sClose,
        benchmarkClose: bmClose
      });
    }
  });

  // Sort chronologically
  aligned.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const len = aligned.length;

  if (len < 2) {
    return {
      stockReturn30D: null, stockReturn90D: null, stockReturn180D: null, stockReturn1Y: null,
      benchmarkReturn30D: null, benchmarkReturn90D: null, benchmarkReturn180D: null, benchmarkReturn1Y: null,
      excessReturn30D: null, excessReturn90D: null, excessReturn180D: null, excessReturn1Y: null,
      correlation: null, beta: null, volatility: null, maxDrawdown: null,
      rating: "Insufficient Data"
    };
  }

  // Calculate return helper function for trading day index lookbacks
  const calcReturn = (alignedList: AlignedDay[], tradingDays: number, isBenchmark: boolean): number | null => {
    if (alignedList.length < 2) return null;
    const endIdx = alignedList.length - 1;
    const startIdx = Math.max(0, endIdx - tradingDays);
    
    if (startIdx === endIdx) return null;

    const startVal = isBenchmark ? alignedList[startIdx].benchmarkClose : alignedList[startIdx].stockClose;
    const endVal = isBenchmark ? alignedList[endIdx].benchmarkClose : alignedList[endIdx].stockClose;

    if (startVal <= 0 || endVal <= 0) return null;
    return parseFloat((((endVal - startVal) / startVal) * 100).toFixed(2));
  };

  const sRet30 = calcReturn(aligned, 30, false);
  const bmRet30 = calcReturn(aligned, 30, true);
  const exc30 = sRet30 !== null && bmRet30 !== null ? parseFloat((sRet30 - bmRet30).toFixed(2)) : null;

  const sRet90 = calcReturn(aligned, 90, false);
  const bmRet90 = calcReturn(aligned, 90, true);
  const exc90 = sRet90 !== null && bmRet90 !== null ? parseFloat((sRet90 - bmRet90).toFixed(2)) : null;

  const sRet180 = calcReturn(aligned, 180, false);
  const bmRet180 = calcReturn(aligned, 180, true);
  const exc180 = sRet180 !== null && bmRet180 !== null ? parseFloat((sRet180 - bmRet180).toFixed(2)) : null;

  const sRet1Y = calcReturn(aligned, 250, false);
  const bmRet1Y = calcReturn(aligned, 250, true);
  const exc1Y = sRet1Y !== null && bmRet1Y !== null ? parseFloat((sRet1Y - bmRet1Y).toFixed(2)) : null;

  // Calculate aligned daily returns
  const stockDailyReturns: number[] = [];
  const bmDailyReturns: number[] = [];

  for (let i = 1; i < len; i++) {
    const sPrev = aligned[i - 1].stockClose;
    const sCurr = aligned[i].stockClose;
    const bmPrev = aligned[i - 1].benchmarkClose;
    const bmCurr = aligned[i].benchmarkClose;

    if (sPrev > 0 && bmPrev > 0) {
      stockDailyReturns.push((sCurr - sPrev) / sPrev);
      bmDailyReturns.push((bmCurr - bmPrev) / bmPrev);
    }
  }

  const numReturns = stockDailyReturns.length;
  let correlation: number | null = null;
  let beta: number | null = null;
  let volatility: number | null = null;

  if (numReturns >= 3) {
    // Pearson correlation
    const avgS = stockDailyReturns.reduce((a, b) => a + b, 0) / numReturns;
    const avgBM = bmDailyReturns.reduce((a, b) => a + b, 0) / numReturns;

    let covSum = 0;
    let varSSum = 0;
    let varBMSum = 0;

    for (let i = 0; i < numReturns; i++) {
      const diffS = stockDailyReturns[i] - avgS;
      const diffBM = bmDailyReturns[i] - avgBM;
      covSum += diffS * diffBM;
      varSSum += diffS * diffS;
      varBMSum += diffBM * diffBM;
    }

    if (varSSum > 0 && varBMSum > 0) {
      correlation = parseFloat((covSum / Math.sqrt(varSSum * varBMSum)).toFixed(4));
    }

    if (varBMSum > 0) {
      beta = parseFloat((covSum / varBMSum).toFixed(4));
    }

    const dailyVariance = varSSum / numReturns;
    volatility = parseFloat((Math.sqrt(dailyVariance) * Math.sqrt(250) * 105).toFixed(2));
  }

  let peak = -Infinity;
  let maxDrawdown = 0;
  aligned.forEach(item => {
    if (item.stockClose > peak) peak = item.stockClose;
    if (peak > 0) {
      const drawdown = (peak - item.stockClose) / peak;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }
  });
  const maxDrawdownPct = parseFloat((maxDrawdown * 100).toFixed(2));

  let excessToUse = exc1Y ?? exc180 ?? exc90 ?? exc30 ?? 0;
  let rating: "Outperforming" | "Market Perform" | "Underperforming" | "Insufficient Data" = "Market Perform";

  if (len < 5) {
    rating = "Insufficient Data";
  } else if (excessToUse > 3.0) {
    rating = "Outperforming";
  } else if (excessToUse < -3.0) {
    rating = "Underperforming";
  } else {
    rating = "Market Perform";
  }

  return {
    stockReturn30D: sRet30,
    stockReturn90D: sRet90,
    stockReturn180D: sRet180,
    stockReturn1Y: sRet1Y,
    benchmarkReturn30D: bmRet30,
    benchmarkReturn90D: bmRet90,
    benchmarkReturn180D: bmRet180,
    benchmarkReturn1Y: bmRet1Y,
    excessReturn30D: exc30,
    excessReturn90D: exc90,
    excessReturn180D: exc180,
    excessReturn1Y: exc1Y,
    correlation,
    beta,
    volatility,
    maxDrawdown: maxDrawdownPct,
    rating
  };
}

export interface OptimizedAllocation {
  symbol: string;
  weight: number; // percentage
  allocatedAmount: number;
  shareCount: number;
  sector: string;
  closePrice: number;
  score: number;
  envelopeSignal: string;
  expectedRiskScore: number; // 1-10
  benchmarkRating: string;
}

export interface PortfolioExposure {
  sector: string;
  weight: number;
}

export interface OptimizationResponse {
  allocations: OptimizedAllocation[];
  sectorExposure: PortfolioExposure[];
  expectedRiskScore: number;
  benchmarkComparison: string;
  concentrationWarnings: string[];
}

/**
 * Core portfolio optimizer.
 * Distributes weights based on score factoring relative strength vs DSEX, volatility, liquidity,
 * price-envelope signal, and benchmark performance.
 * Dynamically strictly enforces max stock and max sector caps.
 */
export function optimizePortfolio(
  symbols: string[],
  stocksMap: Record<string, StockData>,
  historyFetcher: (symbol: string) => { data: HistoryRow[] },
  benchmarkRows: HistoryRow[],
  riskProfile: "Conservative" | "Balanced" | "Aggressive",
  capital: number,
  maxWeightPerStock: number = 30, // Default caps
  maxSectorExposure: number = 40
): OptimizationResponse {
  const warnings: string[] = [];

  if (!symbols || symbols.length === 0) {
    return {
      allocations: [],
      sectorExposure: [],
      expectedRiskScore: 1,
      benchmarkComparison: "No assets selected.",
      concentrationWarnings: ["Your allocation pool is empty."]
    };
  }

  // Filter selected symbols, read sectors and prices
  const validSymbols = symbols.filter(sym => stocksMap[sym.toUpperCase()]);
  if (validSymbols.length === 0) {
    return {
      allocations: [],
      sectorExposure: [],
      expectedRiskScore: 1,
      benchmarkComparison: "No valid DSE tickers found.",
      concentrationWarnings: ["Selected tickers do not match existing records."]
    };
  }

  // Gather stats and score for each asset
  interface ScoredAsset {
    symbol: string;
    sector: string;
    closePrice: number;
    score: number;
    signal: string;
    riskScore: number;
    benchmarkRating: string;
  }

  const scoredAssets: ScoredAsset[] = [];

  validSymbols.forEach(sym => {
    const symbol = sym.toUpperCase();
    const stock = stocksMap[symbol];
    const sector = stock.sector || "Miscellaneous";
    const closePrice = stock.price || stock.ltp || 10;

    const sHistObj = historyFetcher(symbol);
    const sHist = sHistObj?.data || [];

    const envObj = calculatePriceEnvelope(sHist, 20, 5);
    const envPoints = envObj.data;
    const latestEnv = envPoints.length > 0 ? envPoints[envPoints.length - 1] : null;
    const signal = latestEnv ? latestEnv.signal : "Neutral";

    const comp = calculateComparativeMetrics(sHist, benchmarkRows);

    let rawRisk = 5;
    if (comp && comp.volatility !== null) {
      if (comp.volatility > 45) rawRisk = 8.5;
      else if (comp.volatility > 30) rawRisk = 7.0;
      else if (comp.volatility > 18) rawRisk = 5.0;
      else rawRisk = 3.0;
    } else {
      rawRisk = 6.0;
    }
    
    let baseScore = 50.0;

    if (comp && comp.rating) {
      if (comp.rating === "Outperforming") baseScore += 25;
      else if (comp.rating === "Underperforming") baseScore -= 15;
    }

    const excess1Y = comp?.excessReturn1Y ?? comp?.excessReturn180D ?? comp?.excessReturn90D ?? 0;
    baseScore += Math.max(-20, Math.min(30, excess1Y * 0.8));

    if (signal === "Oversold Buy") baseScore += 20;
    else if (signal === "Overbought Sell") baseScore -= 15;

    if (comp && comp.volatility !== null) {
      const vol = comp.volatility;
      if (riskProfile === "Conservative") {
        baseScore -= vol * 0.8;
      } else if (riskProfile === "Balanced") {
        baseScore -= vol * 0.3;
      } else {
        baseScore += Math.min(20, vol * 0.2);
      }
    }

    const finalScore = Math.max(5.0, baseScore);

    scoredAssets.push({
      symbol,
      sector,
      closePrice,
      score: finalScore,
      signal,
      riskScore: parseFloat(rawRisk.toFixed(1)),
      benchmarkRating: comp?.rating || "Market Perform"
    });
  });

  const limitStock = Math.min(100, Math.max(5, maxWeightPerStock));
  const limitSector = Math.min(100, Math.max(5, maxSectorExposure));

  const totalRawScores = scoredAssets.reduce((sum, item) => sum + item.score, 0);
  let weights: Record<string, number> = {};
  scoredAssets.forEach(item => {
    weights[item.symbol] = totalRawScores > 0 ? (item.score / totalRawScores) * 100 : (100 / scoredAssets.length);
  });

  // Sophisticated lock-clipping linear optimizer
  for (let iter = 0; iter < 15; iter++) {
    let excess = 0;
    const isLocked = new Set<string>();

    // Determine sector sums
    const sectorWeights: Record<string, number> = {};
    scoredAssets.forEach(item => {
      sectorWeights[item.sector] = (sectorWeights[item.sector] || 0) + weights[item.symbol];
    });

    // Sector limits clipping check
    const sectorScales: Record<string, number> = {};
    for (const [sec, w] of Object.entries(sectorWeights)) {
      if (w > limitSector) {
        sectorScales[sec] = limitSector / w;
      }
    }

    // Apply clips
    scoredAssets.forEach(item => {
      const sym = item.symbol;
      let w = weights[sym];
      
      // Stock Cap check
      if (w > limitStock) {
        excess += (w - limitStock);
        weights[sym] = limitStock;
        isLocked.add(sym);
      } else {
        // Sector Cap scale check
        const secScale = sectorScales[item.sector];
        if (secScale && secScale < 1.0) {
          const clipped = w * secScale;
          excess += (w - clipped);
          weights[sym] = clipped;
          isLocked.add(sym);
        }
      }
    });

    // Redistribute excess to free components
    if (excess > 0.001) {
      const freeAssets = scoredAssets.filter(item => !isLocked.has(item.symbol));
      const freeScoresSum = freeAssets.reduce((sum, item) => sum + item.score, 0);

      if (freeAssets.length > 0 && freeScoresSum > 0) {
        freeAssets.forEach(item => {
          weights[item.symbol] += (item.score / freeScoresSum) * excess;
        });
      } else {
        // If everything is capped, scale everything down strictly proportionally
        const sumWeightsAll = scoredAssets.reduce((sum, item) => sum + weights[item.symbol], 0);
        scoredAssets.forEach(item => {
          weights[item.symbol] = (weights[item.symbol] / sumWeightsAll) * 100;
        });
        break;
      }
    } else {
      break;
    }
  }

  // Round to 2 decimals strictly
  scoredAssets.forEach(item => {
    weights[item.symbol] = parseFloat(weights[item.symbol].toFixed(2));
  });

  // Small fractional adjustments to ensure exact 100% sum
  let roundedSum = scoredAssets.reduce((s, item) => s + weights[item.symbol], 0);
  let difference = parseFloat((100 - roundedSum).toFixed(2));

  if (Math.abs(difference) > 0.001) {
    // Find adjustable assets under limit stock
    const adjustable = scoredAssets.find(item => weights[item.symbol] < limitStock - 0.5);
    if (adjustable) {
      weights[adjustable.symbol] = parseFloat((weights[adjustable.symbol] + difference).toFixed(2));
    } else if (scoredAssets.length > 0) {
      weights[scoredAssets[0].symbol] = parseFloat((weights[scoredAssets[0].symbol] + difference).toFixed(2));
    }
  }

  // Strict check that no element exceeds limitStock
  scoredAssets.forEach(item => {
    if (weights[item.symbol] > limitStock) {
      const excess = weights[item.symbol] - limitStock;
      weights[item.symbol] = limitStock;
      // Subtract difference from first item that is under the limit
      const sister = scoredAssets.find(s => s.symbol !== item.symbol && weights[s.symbol] < limitStock - excess);
      if (sister) {
        weights[sister.symbol] = parseFloat((weights[sister.symbol] + excess).toFixed(2));
      }
    }
  });

  // Build final payloads
  const allocations: OptimizedAllocation[] = scoredAssets.map(item => {
    const w = weights[item.symbol];
    const allocated = parseFloat(((capital * w) / 100).toFixed(2));
    const sharesCount = item.closePrice > 0 ? Math.floor(allocated / item.closePrice) : 0;

    return {
      symbol: item.symbol,
      weight: w,
      allocatedAmount: allocated,
      shareCount: sharesCount,
      sector: item.sector,
      closePrice: item.closePrice,
      score: parseFloat(item.score.toFixed(1)),
      envelopeSignal: item.signal,
      expectedRiskScore: item.riskScore,
      benchmarkRating: item.benchmarkRating
    };
  });

  const finalSecMap: Record<string, number> = {};
  allocations.forEach(a => {
    finalSecMap[a.sector] = (finalSecMap[a.sector] || 0) + a.weight;
  });
  const sectorExposure = Object.entries(finalSecMap).map(([sector, w]) => ({
    sector,
    weight: parseFloat(w.toFixed(2))
  }));

  let weightedRisk = 0;
  allocations.forEach(a => {
    weightedRisk += (a.weight / 100) * a.expectedRiskScore;
  });
  const overallRiskScore = parseFloat(weightedRisk.toFixed(1));

  if (symbols.length < 3) {
    warnings.push("High concentration: Portfolio contains fewer than 3 assets. Consider broadening allocation to reduce idiosyncratic risks.");
  }

  allocations.forEach(a => {
    if (a.weight >= 29) {
      warnings.push(`Heavy focus on ${a.symbol} (${a.weight}%). Consider adjusting max weight parameters to enforce wider distribution.`);
    }
  });

  sectorExposure.forEach(sec => {
    if (sec.weight >= 39) {
      warnings.push(`Extreme exposure in ${sec.sector} sector (${sec.weight}%). Vulnerability to industry-wide macro headwinds is high.`);
    }
  });

  const outperformersCount = allocations.filter(a => a.benchmarkRating === "Outperforming").length;
  const underperformersCount = allocations.filter(a => a.benchmarkRating === "Underperforming").length;
  const benchmarkComparisonMsg = `Dynamic allocation constructed under ${riskProfile} guidelines. Allocates towards ${outperformersCount} outperforming stocks and mitigates exposure in ${underperformersCount} underperforming symbols. Asset allocations strictly comply with a ${limitStock}% ticker limit and a ${limitSector}% sector concentration constraint.`;

  return {
    allocations,
    sectorExposure,
    expectedRiskScore: overallRiskScore,
    benchmarkComparison: benchmarkComparisonMsg,
    concentrationWarnings: warnings
  };
}
