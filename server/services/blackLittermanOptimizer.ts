import { BLInputs, BLOutput, BLPortfolioResult } from "../../src/types";

/**
 * Robust Matrix Inversion using Gaussian elimination with partial pivoting.
 */
export function invertMatrix(M: number[][]): number[][] {
  const n = M.length;
  // Initialize augmented matrix [M | I]
  const A: number[][] = [];
  for (let i = 0; i < n; i++) {
    A[i] = new Array(2 * n).fill(0);
    for (let j = 0; j < n; j++) {
      A[i][j] = M[i][j];
    }
    A[i][n + i] = 1.0;
  }

  for (let i = 0; i < n; i++) {
    // Search for maximum in this column
    let maxEl = Math.abs(A[i][i]);
    let maxRow = i;
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(A[k][i]) > maxEl) {
        maxEl = Math.abs(A[k][i]);
        maxRow = k;
      }
    }

    // Swap maximum row with current row
    if (maxRow !== i) {
      const temp = A[i];
      A[i] = A[maxRow];
      A[maxRow] = temp;
    }

    const diagVal = A[i][i];
    if (Math.abs(diagVal) < 1e-12) {
      throw new Error("Matrix is singular and cannot be inverted.");
    }

    // Make the diagonal element 1
    for (let k = i; k < 2 * n; k++) {
      A[i][k] /= diagVal;
    }

    // Subtract this row from other rows
    for (let k = 0; k < n; k++) {
      if (k !== i) {
        const c = A[k][i];
        for (let j = i; j < 2 * n; j++) {
          A[k][j] -= c * A[i][j];
        }
      }
    }
  }

  // Get the inverse part of augmented matrix
  const inverse: number[][] = [];
  for (let i = 0; i < n; i++) {
    inverse[i] = A[i].slice(n);
  }
  return inverse;
}

/**
 * Regularized safe matrix inversion that adds a tiny ridge on the diagonal in case of collinearity.
 */
export function safeInvertMatrix(M: number[][], ridge = 1e-6): number[][] {
  try {
    return invertMatrix(M);
  } catch (err) {
    const n = M.length;
    const regularized = M.map((row, i) =>
      row.map((val, j) => (i === j ? val + ridge : val))
    );
    return invertMatrix(regularized);
  }
}

/**
 * Projects an arbitrary vector y onto the simplex { w | sum(w) = targetSum, 0 <= w_i <= maxWeight }
 * using an exact binary search on the dual variable.
 */
export function projectToConstrainedSimplex(y: number[], maxWeight: number, targetSum: number): number[] {
  let low = Math.min(...y) - targetSum - 1.0;
  let high = Math.max(...y) + targetSum + 1.0;
  const w = new Array(y.length).fill(0);
  
  for (let iter = 0; iter < 100; iter++) {
    const mid = (low + high) / 2;
    let sum = 0;
    for (let i = 0; i < y.length; i++) {
      w[i] = Math.max(0, Math.min(maxWeight, y[i] - mid));
      sum += w[i];
    }
    if (sum > targetSum) {
      low = mid;
    } else {
      high = mid;
    }
  }
  
  // Final projection assignment
  const mid = (low + high) / 2;
  let sum = 0;
  for (let i = 0; i < y.length; i++) {
    w[i] = Math.max(0, Math.min(maxWeight, y[i] - mid));
    sum += w[i];
  }
  
  // Clean up floating point error slightly
  if (Math.abs(sum - targetSum) > 1e-9 && sum > 0) {
    for (let i = 0; i < w.length; i++) {
      w[i] = (w[i] / sum) * targetSum;
    }
  }
  
  return w;
}

/**
 * Solves Mean-Variance Optimization using Projected Gradient Descent (PGD) with stability scaling.
 */
export function solveMeanVariance(
  ER: number[],
  Sigma: number[][],
  delta: number,
  maxPositionWeight: number,
  targetSum: number
): number[] {
  const N = ER.length;
  let w = new Array(N).fill(targetSum / N);
  
  // Calculate trace for stability scaling of step size (learning rate)
  let trace = 0;
  for (let i = 0; i < N; i++) {
    trace += Sigma[i][i];
  }
  
  const eta = Math.min(0.2, 0.1 / (delta * trace + 1e-5));
  const maxIterations = 3000;
  const tol = 1e-8;

  for (let iter = 0; iter < maxIterations; iter++) {
    const grad = new Array(N).fill(0);
    for (let i = 0; i < N; i++) {
      let sigmaW = 0;
      for (let j = 0; j < N; j++) {
        sigmaW += Sigma[i][j] * w[j];
      }
      // Objective gradient for w'ER - (delta / 2) * w'Sigma * w
      grad[i] = ER[i] - delta * sigmaW;
    }
    
    // Gradient ascent step
    const nextW = new Array(N);
    for (let i = 0; i < N; i++) {
      nextW[i] = w[i] + eta * grad[i];
    }
    
    // Project back onto simplex constraints
    const projectedW = projectToConstrainedSimplex(nextW, maxPositionWeight, targetSum);
    
    // Check projection convergence
    let diff = 0;
    for (let i = 0; i < N; i++) {
      const d = projectedW[i] - w[i];
      diff += d * d;
    }
    
    w = projectedW;
    if (Math.sqrt(diff) < tol) {
      break;
    }
  }
  
  return w;
}

/**
 * Core Black-Litterman Portfolio Optimization service.
 */
export function calculateBlackLitterman(inputs: BLInputs): BLPortfolioResult {
  const riskAversion = inputs.riskAversion ?? 2.5;
  const tau = inputs.tau ?? 0.05;
  const maxPositionWeight = inputs.maxPositionWeight ?? 0.25;

  // 1. Filter out assets with insufficient returns history (< 30 data points)
  const allHoldings = inputs.holdings;
  const insufficientSet = new Set<string>();
  const activeHoldings = allHoldings.filter(h => {
    const returns = inputs.returnsHistory[h.symbol] || [];
    if (returns.length < 30) {
      insufficientSet.add(h.symbol);
      return false;
    }
    return true;
  });

  // Calculate market caps weight sum of excluded holdings
  let excludedWeightSum = 0;
  const excludedAllocations: BLOutput[] = allHoldings
    .filter(h => insufficientSet.has(h.symbol))
    .map(h => {
      excludedWeightSum += h.marketWeight;
      return {
        symbol: h.symbol,
        currentWeight: h.marketWeight,
        recommendedWeight: h.marketWeight,
        weightChange: 0,
        impliedReturn: 0,
        viewReturn: 0,
        blendedReturn: 0,
        action: "Hold" as const,
        rationale: "Insufficient return history for optimization (held at current weight)."
      };
    });

  // Remaining active target weight
  const activeTargetSum = Math.max(0, 1.0 - excludedWeightSum);
  const N = activeHoldings.length;

  if (N === 0) {
    // If no active stocks remain, return holds
    return {
      allocations: excludedAllocations,
      expectedPortfolioReturn: 0,
      expectedPortfolioRisk: 0,
      sharpeEstimate: 0,
      rebalanceRequired: false,
      diversificationNote: "No holdings with sufficient historical points (>=30 days) to optimize.",
      generatedAt: new Date().toISOString()
    };
  }

  // 2. Normalize weights of active holdings to sum to activeTargetSum for equilibrium calculations
  const totalActiveMarketWeight = activeHoldings.reduce((sum, h) => sum + h.marketWeight, 0);
  const activeMarketWeights = activeHoldings.map(h => 
    totalActiveMarketWeight > 0 ? (h.marketWeight / totalActiveMarketWeight) * activeTargetSum : activeTargetSum / N
  );

  // 3. Build covariance matrix Σ (annualized)
  const Sigma: number[][] = [];
  for (let i = 0; i < N; i++) {
    Sigma[i] = new Array(N).fill(0);
  }

  // Retrieve returns
  const activeReturns = activeHoldings.map(h => inputs.returnsHistory[h.symbol] || []);
  const M = Math.min(...activeReturns.map(r => r.length)); // aligned sample count

  // Means
  const means = activeReturns.map(returns => {
    const slice = returns.slice(-M);
    return slice.reduce((sum, r) => sum + r, 0) / (slice.length || 1);
  });

  // Covariance calculation
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      const retI = activeReturns[i].slice(-M);
      const retJ = activeReturns[j].slice(-M);
      let cov = 0;
      for (let k = 0; k < M; k++) {
        cov += (retI[k] - means[i]) * (retJ[k] - means[j]);
      }
      const div = M > 1 ? M - 1 : 1;
      // Annualized covariance (daily return covariance scaled by 252 trading days)
      Sigma[i][j] = (cov / div) * 252;
    }
  }

  // 4. Compute market-implied equilibrium returns (Π)
  // Π = riskAversion * Sigma * activeMarketWeights
  const Pi = new Array(N).fill(0);
  for (let i = 0; i < N; i++) {
    let sigmaW = 0;
    for (let j = 0; j < N; j++) {
      sigmaW += Sigma[i][j] * activeMarketWeights[j];
    }
    Pi[i] = riskAversion * sigmaW;
  }

  // 5. Investor views Q and Ω
  // View return Q_i = (finalScore_i - 50) / 50 * maxViewDeviation
  const maxViewDeviation = 0.05; // 5% configurable
  const Q = new Array(N).fill(0);
  for (let i = 0; i < N; i++) {
    const finalScore = activeHoldings[i].finalScore;
    Q[i] = ((finalScore - 50) / 50) * maxViewDeviation;
  }

  // Confidence index to variance of view error matrix Ω
  const OmegaInvDiag = new Array(N).fill(0);
  for (let i = 0; i < N; i++) {
    const confidence = activeHoldings[i].confidence;
    // Map higher confidence directly to smaller uncertainty (i.e. larger OmegaInv)
    const uncertainty = (101 - confidence) / Math.max(1, confidence);
    const omegaVal = tau * Sigma[i][i] * uncertainty;
    OmegaInvDiag[i] = 1.0 / Math.max(1e-8, omegaVal);
  }

  // 6. Calculate Black-Litterman blended returns: E[R]
  // E[R] = [ (tau * Sigma)^-1 + P'*Omega^-1*P ]^-1 * [ (tau * Sigma)^-1 * Pi + P'*Omega^-1*Q ]
  // Since P = Identity, we have:
  // E[R] = [ (tau * Sigma)^-1 + OmegaInvDiag ]^-1 * [ (tau * Sigma)^-1 * Pi + OmegaInvDiag * Q ]
  
  // Let TauSigma = tau * Sigma
  const TauSigma: number[][] = [];
  for (let i = 0; i < N; i++) {
    TauSigma[i] = new Array(N).fill(0);
    for (let j = 0; j < N; j++) {
      TauSigma[i][j] = tau * Sigma[i][j];
    }
  }

  // Inverse (tau * Sigma)^-1
  const TauSigmaInv = safeInvertMatrix(TauSigma);

  // Augmented matrices
  // Left matrix: (tau * Sigma)^-1 + Omega^-1
  const LeftMatrix: number[][] = [];
  for (let i = 0; i < N; i++) {
    LeftMatrix[i] = new Array(N).fill(0);
    for (let j = 0; j < N; j++) {
      LeftMatrix[i][j] = TauSigmaInv[i][j] + (i === j ? OmegaInvDiag[i] : 0);
    }
  }

  // Right column vector: (tau * Sigma)^-1 * Pi + Omega^-1 * Q
  const RightVector = new Array(N).fill(0);
  for (let i = 0; i < N; i++) {
    let term1 = 0;
    for (let j = 0; j < N; j++) {
      term1 += TauSigmaInv[i][j] * Pi[j];
    }
    const term2 = OmegaInvDiag[i] * Q[i];
    RightVector[i] = term1 + term2;
  }

  // Final Blended returns: E[R] = LeftMatrix^-1 * RightVector
  const LeftMatrixInv = safeInvertMatrix(LeftMatrix);
  const ER = new Array(N).fill(0);
  for (let i = 0; i < N; i++) {
    let sum = 0;
    for (let j = 0; j < N; j++) {
      sum += LeftMatrixInv[i][j] * RightVector[j];
    }
    ER[i] = sum;
  }

  // 7. Solve Mean-Variance Optimization for active weights
  const recommendedActiveWeights = solveMeanVariance(
    ER,
    Sigma,
    riskAversion,
    maxPositionWeight,
    activeTargetSum
  );

  // 8. Gather allocations
  const activeAllocations: BLOutput[] = activeHoldings.map((h, i) => {
    const curW = h.marketWeight;
    const recW = recommendedActiveWeights[i];
    const weightChange = recW - curW;

    // Determine Action
    let action: "Increase" | "Decrease" | "Hold" | "New Position" | "Exit";
    if (curW < 0.005 && recW >= 0.005) {
      action = "New Position";
    } else if (curW >= 0.005 && recW < 0.005) {
      action = "Exit";
    } else if (weightChange > 0.01) {
      action = "Increase";
    } else if (weightChange < -0.01) {
      action = "Decrease";
    } else {
      action = "Hold";
    }

    // Dynamic Rationale Builder
    let rationale = "";
    if (action === "New Position") {
      rationale = `Extremely strong technical/fundamental indicators (AI score ${h.finalScore}) suggest capital allocation.`;
    } else if (action === "Exit") {
      rationale = `High correlation risk or low score indicators (AI score ${h.finalScore}) trigger partial/total capitulation.`;
    } else if (action === "Increase") {
      rationale = `Strong equilibrium risk-adjusted returns (Score: ${h.finalScore}) warrant adding ${(weightChange * 100).toFixed(1)}% weight.`;
    } else if (action === "Decrease") {
      rationale = `Trim portfolio concentration to lock in alpha gains or manage systemic volatility deviation.`;
    } else {
      rationale = `Current position is optimally aligned with AI equilibrium target.`;
    }

    return {
      symbol: h.symbol,
      currentWeight: parseFloat(curW.toFixed(4)),
      recommendedWeight: parseFloat(recW.toFixed(4)),
      weightChange: parseFloat(weightChange.toFixed(4)),
      impliedReturn: parseFloat((Pi[i] * 100).toFixed(2)),
      viewReturn: parseFloat((Q[i] * 100).toFixed(2)),
      blendedReturn: parseFloat((ER[i] * 100).toFixed(2)),
      action,
      rationale
    };
  });

  // Combine allocations chronological sort
  const allRawAllocations = [...activeAllocations, ...excludedAllocations];
  // Sort allocations descending by recommendedWeight
  const allocations = allRawAllocations.sort((a, b) => b.recommendedWeight - a.recommendedWeight);

  // 9. Calculate Overall Portfolio Expected Return, Risk, Sharpe Ratio
  const totalRecommendedWeights = allocations.map(a => a.recommendedWeight);
  
  // Blended Portfolio return
  let expectedPortfolioReturn = 0;
  for (let i = 0; i < allocations.length; i++) {
    expectedPortfolioReturn += totalRecommendedWeights[i] * allocations[i].blendedReturn;
  }

  // Blended Portfolio risk (annualized standard deviation)
  let pVar = 0;
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      pVar += recommendedActiveWeights[i] * Sigma[i][j] * recommendedActiveWeights[j];
    }
  }
  const expectedPortfolioRisk = Math.sqrt(pVar) * 100;

  // Sharpe estimate (assuming 3% proxy BD risk free rate)
  const BD_RISK_FREE_RATE = 5.0; // elevated in recent BD market
  const sharpeEstimate = expectedPortfolioRisk > 0 
    ? parseFloat(((expectedPortfolioReturn - BD_RISK_FREE_RATE) / expectedPortfolioRisk).toFixed(2))
    : 0;

  // rebalanceRequired if any absolute weight change > 5%
  const rebalanceRequired = allocations.some(a => Math.abs(a.weightChange) > 0.05);

  // Dynamic diversification note
  const activeCount = activeAllocations.filter(a => a.recommendedWeight > 0.02).length;
  let diversificationNote = "";
  if (activeCount >= 5) {
    diversificationNote = "Well-diversified portfolio! Strong risk-mitigation across multiple liquid correlation sectors.";
  } else if (activeCount >= 3) {
    diversificationNote = "Moderate diversification. Consider broad sectoral allocations to insulate from individual shocks.";
  } else {
    diversificationNote = "Highly concentrated portfolio! Vulnerable to asymmetric systemic volatility inside single sectors.";
  }

  return {
    allocations,
    expectedPortfolioReturn: parseFloat(expectedPortfolioReturn.toFixed(2)),
    expectedPortfolioRisk: parseFloat(expectedPortfolioRisk.toFixed(2)),
    sharpeEstimate,
    rebalanceRequired,
    diversificationNote,
    generatedAt: new Date().toISOString()
  };
}
