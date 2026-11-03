import { getStockBySymbol } from "../repositories/stockRepository";
import { getStockHistory } from "../repositories/historicalRepository";
import { RelativeVolumeResult } from "../../src/types";

/**
 * Helper to calculate Pearson correlation coefficient
 */
function calculatePearsonCorrelation(x: number[], y: number[]): number {
  const n = x.length;
  if (n === 0 || n !== y.length) return 0;

  const meanX = x.reduce((a, b) => a + b, 0) / n;
  const meanY = y.reduce((a, b) => a + b, 0) / n;

  let num = 0;
  let denX = 0;
  let denY = 0;

  for (let i = 0; i < n; i++) {
    const diffX = x[i] - meanX;
    const diffY = y[i] - meanY;
    num += diffX * diffY;
    denX += diffX * diffX;
    denY += diffY * diffY;
  }

  if (denX === 0 || denY === 0) return 0;
  return num / Math.sqrt(denX * denY);
}

export async function calculateRelativeVolume(symbol: string): Promise<RelativeVolumeResult> {
  const sym = symbol.toUpperCase().trim();
  const stock = getStockBySymbol(sym);
  if (!stock) {
    throw new Error(`Stock not found with symbol ${sym}`);
  }

  const hist = getStockHistory(sym, 30);
  const data = hist.data || [];

  // Get current day's trade figures from stock repository or history
  const todayVolume = stock.volume ?? (data.length > 0 ? (data[data.length - 1].volume ?? 1000) : 1000);
  const priceChange = stock.changePercent ?? (data.length > 0 ? (data[data.length - 1].changePercent ?? 0) : 0);

  // Take last 20 rows (excluding today's live price to make average clean)
  const last20Rows = data.slice(-21);
  const volumes = last20Rows.map(r => r.volume ?? 0).filter(v => v > 0);

  const avgVolume20D = volumes.length > 0
    ? Math.floor(volumes.slice(-20).reduce((sum, v) => sum + v, 0) / Math.min(20, volumes.length))
    : 10000;

  const avgVolume5D = volumes.length > 0
    ? Math.floor(volumes.slice(-5).reduce((sum, v) => sum + v, 0) / Math.min(5, volumes.length))
    : 10000;

  // Relative volumes
  const relVol20 = avgVolume20D > 0 ? todayVolume / avgVolume20D : 1.0;
  const relVol5 = avgVolume5D > 0 ? todayVolume / avgVolume5D : 1.0;

  // Signal categorization
  let volumeSignal = "Normal Volume";
  if (relVol20 >= 3.0) volumeSignal = "Extremely High Volume";
  else if (relVol20 >= 2.0) volumeSignal = "Very High Volume";
  else if (relVol20 >= 1.5) volumeSignal = "Above Average Volume";
  else if (relVol20 < 0.8) volumeSignal = "Below Average Volume";

  // Volume trend (slope indicator over last 10 trading days closes)
  let volumeTrend: "Rising" | "Falling" | "Flat" = "Flat";
  if (data.length >= 10) {
    const last10 = data.slice(-10);
    const firstHalfAvg = last10.slice(0, 5).reduce((sum, r) => sum + (r.volume ?? 0), 0) / 5;
    const secondHalfAvg = last10.slice(-5).reduce((sum, r) => sum + (r.volume ?? 0), 0) / 5;

    if (secondHalfAvg > firstHalfAvg * 1.15) {
      volumeTrend = "Rising";
    } else if (secondHalfAvg < firstHalfAvg * 0.85) {
      volumeTrend = "Falling";
    }
  }

  // Price and Volume correlation over 10 trading days
  let priceVolCorr = 0;
  if (data.length >= 10) {
    const last10 = data.slice(-10);
    const pChanges = last10.map((r, i) => {
      if (i === 0) return r.changePercent ?? 0;
      const prevClose = last10[i - 1].close || 1;
      return parseFloat((((r.close || 1) - prevClose) / prevClose * 100).toFixed(2));
    });
    const pVols = last10.map(r => r.volume ?? 0);
    priceVolCorr = calculatePearsonCorrelation(pChanges, pVols);
  }

  // Divergence Detection
  let divergence: string | null = null;
  const priceDirection = priceChange > 0.3 ? "UP" : priceChange < -0.3 ? "DOWN" : "SIDEWAYS";

  if (priceDirection === "UP" && relVol20 < 0.8) {
    divergence = "Bearish Volume Divergence (Low volume rally suggests potential exhaustion)";
  } else if (priceDirection === "DOWN" && relVol20 >= 1.5) {
    divergence = "Bearish Distribution Event (Heavy volume on a down day signals institutional exit)";
  } else if (priceDirection === "UP" && relVol20 >= 1.5) {
    divergence = "Bullish Volume Confirmation (High volume breakout validates upward momentum)";
  } else if (priceDirection === "DOWN" && relVol20 < 0.8) {
    divergence = "Healthy Pullback (Declining volume on consolidations indicates low seller conviction)";
  }

  // Dynamic interpretation summary
  let interpretation = "";
  if (divergence) {
    interpretation = divergence;
  } else if (relVol20 >= 2.0) {
    interpretation = "Unusually high trading activity detected. Institutional block accumulation or distribution might be active.";
  } else if (relVol20 <= 0.6) {
    interpretation = "Interest in this asset is drying up. Low volume consolidation indicates absence of strong market participants.";
  } else {
    interpretation = "Volume is flowing in line with average historic parameters. Price action is normal.";
  }

  return {
    symbol: sym,
    todayVolume,
    avgVolume20D,
    avgVolume5D,
    relVol20: parseFloat(relVol20.toFixed(2)),
    relVol5: parseFloat(relVol5.toFixed(2)),
    volumeSignal,
    divergence,
    volumeTrend,
    interpretation
  };
}
