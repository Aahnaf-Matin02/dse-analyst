import { getStockHistory } from "../repositories/historicalRepository";
import { getStockBySymbol } from "../repositories/stockRepository";

export interface OptimizeInput {
  user_id?: string;
  holdings: Array<{ symbol: string; weight?: number; quantity?: number; buyPrice?: number }>;
  risk_profile?: "conservative" | "moderate" | "aggressive" | "low" | "high";
}

export interface OptimizedAsset {
  symbol: string;
  weight: number;
}

export interface OptimizeOutput {
  optimized_allocation: OptimizedAsset[];
  expected_return: number;
  risk_score: number;
  sharpe_ratio: number;
}

// Fixed characteristics for known assets (supporting both simulated DSE and typical user inputs)
interface AssetStats {
  expectedReturn: number; // in %
  volatility: number;    // in %
  beta: number;
  sector: string;
}

const ASSET_DATABASE: Record<string, AssetStats> = {
  GP: { expectedReturn: 12.0, volatility: 13.0, beta: 0.85, sector: "Telecommunications" },
  SQURPHARMA: { expectedReturn: 12.8, volatility: 11.5, beta: 0.75, sector: "Pharmaceuticals" },
  BRACBANK: { expectedReturn: 13.5, volatility: 14.5, beta: 0.90, sector: "Banking" },
  BATBC: { expectedReturn: 11.2, volatility: 12.0, beta: 0.80, sector: "Food & Allied" },
  BEXIMCO: { expectedReturn: 9.5, volatility: 22.0, beta: 1.35, sector: "Miscellaneous" },
  RENATA: { expectedReturn: 11.8, volatility: 13.2, beta: 0.82, sector: "Pharmaceuticals" },
  LHBL: { expectedReturn: 10.5, volatility: 18.0, beta: 1.15, sector: "Cement" },
  EBL: { expectedReturn: 12.2, volatility: 13.8, beta: 0.88, sector: "Banking" },
  DSEX_ETF: { expectedReturn: 10.8, volatility: 10.0, beta: 0.70, sector: "Index Fund" },
  AAPL: { expectedReturn: 11.8, volatility: 16.0, beta: 1.10, sector: "Technology" },
  TSLA: { expectedReturn: 15.2, volatility: 28.0, beta: 1.55, sector: "Automotive" },
  MSFT: { expectedReturn: 11.2, volatility: 15.0, beta: 1.00, sector: "Technology" },
  NVDA: { expectedReturn: 18.0, volatility: 32.5, beta: 1.75, sector: "Technology" },
};

function getAssetStats(symbol: string): AssetStats {
  const cleanSym = symbol.toUpperCase().trim();
  if (ASSET_DATABASE[cleanSym]) {
    return ASSET_DATABASE[cleanSym];
  }
  
  // Try to find in the stock repository dynamically
  try {
    const stock = getStockBySymbol(cleanSym);
    if (stock) {
      const stockAny = stock as any;
      const beta = stockAny.beta ?? 1.0;
      const peVal = stockAny.peRatio || stockAny.pe || 15;
      const expectedReturn = 11.5 + (1 / peVal) * 10 - (beta - 1) * 2;
      return {
        expectedReturn: parseFloat(Math.max(6.0, Math.min(22.0, expectedReturn)).toFixed(2)),
        volatility: parseFloat(Math.max(8.0, Math.min(35.0, (beta * 15 + 4))).toFixed(2)),
        beta,
        sector: stock.sector || "Miscellaneous"
      };
    }
  } catch (err) {
    // Ignore
  }

  // General default fallback
  return {
    expectedReturn: 11.0,
    volatility: 16.0,
    beta: 1.0,
    sector: "Miscellaneous"
  };
}

/**
 * Optimizes a portfolio combining Mean-Variance allocation, Risk Parity, and risk-appetite constraints.
 */
export function optimizePortfolio(input: OptimizeInput): OptimizeOutput {
  const rawHoldings = input.holdings || [];
  const profileInput = (input.risk_profile || "moderate").toLowerCase();
  
  // Map risk profile string to a target risk profile
  let riskProfile: "conservative" | "moderate" | "aggressive" = "moderate";
  if (profileInput === "conservative" || profileInput === "low") {
    riskProfile = "conservative";
  } else if (profileInput === "aggressive" || profileInput === "high") {
    riskProfile = "aggressive";
  }

  // Extract assets. We need standard portfolio constituents.
  // If holdings are empty, seed some default standard entities as options.
  const symbols = Array.from(new Set(rawHoldings.map(h => h.symbol.toUpperCase().trim())));
  
  // If there's fewer than 3 symbols, we proactively introduce benchmark hedges (e.g. DSEX_ETF, SQURPHARMA, BRACBANK)
  // to build a fully structured diversified recommendation.
  if (symbols.length === 0) {
    symbols.push("GP", "SQURPHARMA", "BRACBANK", "DSEX_ETF");
  } else if (symbols.length < 3) {
    if (!symbols.includes("DSEX_ETF")) symbols.push("DSEX_ETF");
    if (!symbols.includes("SQURPHARMA") && !symbols.includes("GP")) {
      symbols.push("SQURPHARMA");
    }
    if (symbols.length < 4 && !symbols.includes("BRACBANK")) {
      symbols.push("BRACBANK");
    }
  }

  const n = symbols.length;
  const assetsStats = symbols.map(sym => ({
    symbol: sym,
    stats: getAssetStats(sym)
  }));

  // Build covariance matrix model: we simulate correlation and calculate covariance
  // Rho = 0.25 (modest correlation for stock market)
  const correlationMatrix: number[][] = [];
  for (let i = 0; i < n; i++) {
    correlationMatrix[i] = [];
    for (let j = 0; j < n; j++) {
      if (i === j) {
        correlationMatrix[i][j] = 1.0;
      } else {
        // Lower correlation between different sectors, slightly higher inside same sector
        const secI = assetsStats[i].stats.sector;
        const secJ = assetsStats[j].stats.sector;
        correlationMatrix[i][j] = secI === secJ ? 0.40 : 0.20;
      }
    }
  }

  const covarianceMatrix: number[][] = [];
  for (let i = 0; i < n; i++) {
    covarianceMatrix[i] = [];
    for (let j = 0; j < n; j++) {
      const volI = assetsStats[i].stats.volatility / 100;
      const volJ = assetsStats[j].stats.volatility / 100;
      covarianceMatrix[i][j] = correlationMatrix[i][j] * volI * volJ;
    }
  }

  // Solver: Iterative random search / gradient ascent or similar that maximizes utility
  // We maximize: U = E[R] - lambda * Var(Rp) 
  // with constraints w_i >= 0.05 (diversification), w_i <= maxWeight, sum(w_i) = 1.0
  let lambda = 2.5; // risk aversion
  let maxWeight = 0.45;
  let minWeight = 0.05;

  if (riskProfile === "conservative") {
    lambda = 5.0;
    maxWeight = 0.30;
    minWeight = 0.08; // force higher diversification
  } else if (riskProfile === "aggressive") {
    lambda = 1.2;
    maxWeight = 0.60;
    minWeight = 0.02;
  }

  let bestWeights = new Array(n).fill(1 / n);
  let bestUtility = -Infinity;

  // Let's run a fine-grained grid search / random walkers optimizer (10,000 runs)
  // which works extraordinarily well and fast for n <= 10.
  const iterations = 8000;
  for (let iter = 0; iter < iterations; iter++) {
    const raw: number[] = [];
    let sum = 0;
    for (let i = 0; i < n; i++) {
      // Draw uniform random weights matching risk bounds
      const val = Math.random();
      raw.push(val);
      sum += val;
    }
    
    // Normalize to sum up to 1.0
    const w = raw.map(v => v / sum);
    
    // Apply bounds strictly: project onto [minWeight, maxWeight]
    let boundedW = w.map(weight => Math.max(minWeight, Math.min(maxWeight, weight)));
    let boundedSum = boundedW.reduce((sum, v) => sum + v, 0);
    boundedW = boundedW.map(v => v / boundedSum);

    // Calculate Portfolio Expected Return
    let pReturn = 0;
    for (let i = 0; i < n; i++) {
      pReturn += boundedW[i] * assetsStats[i].stats.expectedReturn;
    }

    // Calculate Portfolio Variance
    let pVar = 0;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        pVar += boundedW[i] * boundedW[j] * covarianceMatrix[i][j];
      }
    }
    const pVol = Math.sqrt(pVar) * 100; // in %

    // Sharpe Ratio (using risk-free rate 6.5% standard in Bangladesh / treasury rates)
    const rf = 6.5;
    const sharpe = pVol > 0 ? (pReturn - rf) / pVol : 0;

    // Multi-factor utility optimization: combine return, variance, and Risk Parity objective
    // Risk parity penalty: we penalize unequal risk contributions.
    let riskParityPenalty = 0;
    const riskContributions: number[] = [];
    for (let i = 0; i < n; i++) {
      let marginalContrib = 0;
      for (let j = 0; j < n; j++) {
        marginalContrib += boundedW[j] * covarianceMatrix[i][j];
      }
      const rc = boundedW[i] * (marginalContrib / (pVol / 100));
      riskContributions.push(rc);
    }
    const meanRC = riskContributions.reduce((sum, v) => sum + v, 0) / n;
    for (let i = 0; i < n; i++) {
      riskParityPenalty += Math.pow(riskContributions[i] - meanRC, 2);
    }

    // Custom utility score
    // - High lambda penalizes volatility more
    // - High risk profile values return more
    // - Support risk parity convergence via penalty
    let utility = pReturn - lambda * (pVol * 0.15) - 15 * riskParityPenalty;
    
    if (utility > bestUtility) {
      bestUtility = utility;
      bestWeights = boundedW;
    }
  }

  // Format final optimized allocation
  const optimized_allocation = assetsStats.map((asset, index) => ({
    symbol: asset.symbol,
    weight: parseFloat(bestWeights[index].toFixed(4)) // 4 decimal accuracy
  }));

  // Re-verify cumulative portfolio statistics
  let expected_return = 0;
  let portfolioVar = 0;
  for (let i = 0; i < n; i++) {
    expected_return += bestWeights[i] * assetsStats[i].stats.expectedReturn;
    for (let j = 0; j < n; j++) {
      portfolioVar += bestWeights[i] * bestWeights[j] * covarianceMatrix[i][j];
    }
  }
  const expectedVolatility = Math.sqrt(portfolioVar) * 100;
  const sharpe_ratio = parseFloat(((expected_return - 6.5) / expectedVolatility).toFixed(4));
  
  // Risk Score model out of 100 (combination of volatility and asset betas)
  // Low: ~20-35, Moderate: ~36-55, High: ~56-85
  let portfolioBeta = 0;
  for (let i = 0; i < n; i++) {
    portfolioBeta += bestWeights[i] * assetsStats[i].stats.beta;
  }
  
  const risk_score = Math.round(
    Math.min(99, Math.max(10, (portfolioBeta * 40) + (expectedVolatility * 1.2)))
  );

  return {
    optimized_allocation,
    expected_return: parseFloat(expected_return.toFixed(2)),
    risk_score,
    sharpe_ratio
  };
}
