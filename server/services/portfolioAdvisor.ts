import { getStockBySymbol, loadStocks } from "../repositories/stockRepository";
import { getStockHistory, getIndexHistory } from "../repositories/historicalRepository";
import { calculateTechnicalIndicators } from "./technicalIndicators";
import { Holding, SignalResult, PortfolioRecommendation, MacroSignals } from "../../src/types";

// Active/current macro constants for Bangladesh Capital Market
export const ACTIVE_MACRO_SIGNALS: MacroSignals = {
  interestRate: "High (Contractionary, Policy Rate 10.0%)",
  inflation: "9.8% (Elevated, Above Target)",
  exchangeRate: "118.5 BDT/USD (Depreciating Pressure)",
  floorPriceStatus: "Lifted (Active Trading Restored)",
  creditRating: "B1 (Moody's Outlook: Negative)",
  overallCountryRisk: "Moderate"
};

/**
 * Returns a custom dividend list for calculation
 */
function getDividendsData(symbol: string, stock: any) {
  const dividendDb: Record<string, any[]> = {
    GP: [
      { year: "2025", percentage: 125, valuePerShare: 12.5 },
      { year: "2024", percentage: 115, valuePerShare: 11.5 },
      { year: "2023", percentage: 125, valuePerShare: 12.5 },
      { year: "2022", percentage: 125, valuePerShare: 12.5 }
    ],
    BATBC: [
      { year: "2025", percentage: 150, valuePerShare: 15.0 },
      { year: "2024", percentage: 200, valuePerShare: 20.0 },
      { year: "2023", percentage: 200, valuePerShare: 20.0 },
      { year: "2022", percentage: 150, valuePerShare: 15.0 }
    ],
    SQURPHARMA: [
      { year: "2025", percentage: 110, valuePerShare: 11.0 },
      { year: "2024", percentage: 105, valuePerShare: 10.5 },
      { year: "2023", percentage: 100, valuePerShare: 10.0 },
      { year: "2022", percentage: 100, valuePerShare: 10.0 }
    ],
    BEXIMCO: [
      { year: "2025", percentage: 0, valuePerShare: 0.0 },
      { year: "2024", percentage: 5, valuePerShare: 0.5 },
      { year: "2023", percentage: 10, valuePerShare: 1.0 },
      { year: "2022", percentage: 30, valuePerShare: 3.0 }
    ],
    BRACBANK: [
      { year: "2025", percentage: 25, valuePerShare: 1.5 },
      { year: "2024", percentage: 20, valuePerShare: 1.0 },
      { year: "2023", percentage: 15, valuePerShare: 0.75 },
      { year: "2022", percentage: 15, valuePerShare: 1.5 }
    ],
    RENATA: [
      { year: "2025", percentage: 92, valuePerShare: 9.2 },
      { year: "2024", percentage: 80, valuePerShare: 8.0 },
      { year: "2023", percentage: 140, valuePerShare: 14.0 },
      { year: "2022", percentage: 145, valuePerShare: 14.5 }
    ]
  };

  if (dividendDb[symbol]) {
    return dividendDb[symbol];
  }

  // Fallback generation matching DividendsRouter
  const yieldsPercent = stock.divYield || 4.5;
  const currentPrice = stock.price || 50;
  const standardPayoutRatio = (currentPrice * (yieldsPercent / 100));

  return [
    { year: "2025", percentage: Math.round(yieldsPercent * 10), valuePerShare: parseFloat(standardPayoutRatio.toFixed(2)) },
    { year: "2024", percentage: Math.round((yieldsPercent * 0.95) * 10), valuePerShare: parseFloat((standardPayoutRatio * 0.95).toFixed(2)) },
    { year: "2023", percentage: Math.round((yieldsPercent * 0.90) * 10), valuePerShare: parseFloat((standardPayoutRatio * 0.90).toFixed(2)) },
    { year: "2022", percentage: Math.round((yieldsPercent * 1.05) * 10), valuePerShare: parseFloat((standardPayoutRatio * 1.05).toFixed(2)) }
  ];
}

/**
 * Calculates return percentage from chronological OHLCV rows over given trading days
 */
function calculateHistoricalReturn(rows: any[], days: number): number {
  if (!rows || rows.length < 2) return 0;
  const latestPrice = rows[rows.length - 1].close;
  const startIdx = Math.max(0, rows.length - 1 - days);
  const startPrice = rows[startIdx].close;
  if (!startPrice) return 0;
  return ((latestPrice - startPrice) / startPrice) * 100;
}

/**
 * Executes portfolio advisory simulation
 */
export async function analyzePortfolio(
  holdings: Holding[],
  customMacro: Partial<MacroSignals> = {}
): Promise<PortfolioRecommendation> {
  const macro: MacroSignals = { ...ACTIVE_MACRO_SIGNALS, ...customMacro };

  if (!holdings || holdings.length === 0) {
    return {
      overallScore: 60,
      verdict: "HOLD",
      analysisText: "No portfolio holdings provided. Please import or add positions to populate holding advisory evaluations.",
      signals: [
        { name: "Dividend Growth Potential", score: 0, maxScore: 20, status: "NEUTRAL", reasoning: "Provide portfolio tickers to estimate aggregate passive payouts." },
        { name: "Technical Momentum & Stock Returns", score: 0, maxScore: 20, status: "NEUTRAL", reasoning: "Add stock holdings to chart active price performance dynamics." },
        { name: "Financial Quality & Valuation Standards", score: 0, maxScore: 20, status: "NEUTRAL", reasoning: "Requires corporate balance sheets to construct credit & solvency diagnostics." },
        { name: "DSEX Market Sentiment Conditions", score: 0, maxScore: 10, status: "NEUTRAL", reasoning: "Requires holding assets to benchmark indexes." },
        { name: "Bangladesh Macro-Micro Stress Index", score: 0, maxScore: 30, status: "NEUTRAL", reasoning: "Requires asset vectors to scale macro cost stress." }
      ],
      suggestedActions: [
        "Incorporate highly-liquid bluechip counters (GP, BATBC, SQURPHARMA) to anchor initial equity weightings.",
        "Assess sector interest vulnerability before loading banking or raw manufacturing shares."
      ],
      riskScore: 0,
      diversificationScore: 0,
      concentrationRisk: "Low"
    };
  }

  // Load backend stock data and enrich holdings
  const enrichedHoldings = holdings.map(h => {
    const symbol = h.symbol.toUpperCase().trim();
    const stock = getStockBySymbol(symbol);
    const value = h.quantity * (stock?.price || h.buyPrice);
    return {
      ...h,
      stock,
      value,
      sector: stock?.sector || "Unclassified",
      divYield: stock?.divYield ?? 0,
      peRatio: stock?.peRatio ?? 15,
      profitGrowth: stock?.profitGrowth ?? 0,
      revGrowth: stock?.revGrowth ?? 0
    };
  });

  const totalValue = enrichedHoldings.reduce((sum, h) => sum + h.value, 1);

  // Apply portfolio weightings to entries
  const weightedHoldings = enrichedHoldings.map(h => ({
    ...h,
    allocation: h.value / totalValue
  }));

  // Map of symbols to prevent repeating historical calculations
  const distinctSymbols = Array.from(new Set(holdings.map(h => h.symbol.toUpperCase().trim())));
  const stockHistories: Record<string, { data: any[] }> = {};
  const stockIndicators: Record<string, any> = {};

  distinctSymbols.forEach(sym => {
    const hist = getStockHistory(sym, 260); // 1-year trading rows
    stockHistories[sym] = hist;
    if (hist && hist.data && hist.data.length > 0) {
      stockIndicators[sym] = calculateTechnicalIndicators(hist.data);
    }
  });

  // Calculate DSEX history metrics
  const dsexHist = getIndexHistory("DSEX", 260);
  const dsexReturn3M = calculateHistoricalReturn(dsexHist?.data || [], 60);
  const dsexReturn1Y = calculateHistoricalReturn(dsexHist?.data || [], 250);
  const dsexIndicators = dsexHist?.data && dsexHist.data.length > 0
    ? calculateTechnicalIndicators(dsexHist.data)
    : { rsi14: 52 };
  const dsexRsi = dsexIndicators?.rsi14 || 52;

  // SIGNAL 1: Dividend Growth (Max Score: 20)
  // Evaluates aggregate dividend yields & payout sustainability trends
  let avgDivYield = 0;
  let increasePercent = 0;
  let payoutTrendStatus: "increasing" | "stable" | "declining" = "stable";

  weightedHoldings.forEach(wh => {
    avgDivYield += wh.divYield * wh.allocation;
    const divs = getDividendsData(wh.symbol, wh.stock);
    if (divs && divs.length >= 2) {
      const vLatest = divs[0].percentage;
      const vPrev = divs[1].percentage;
      if (vLatest >= vPrev) increasePercent += wh.allocation;
    } else {
      increasePercent += wh.allocation;
    }
  });

  if (increasePercent > 0.6) payoutTrendStatus = "increasing";
  else if (increasePercent < 0.25) payoutTrendStatus = "declining";

  let divScore = 12;
  let divStatus: "BULLISH" | "NEUTRAL" | "BEARISH" = "NEUTRAL";
  let divText = "";

  if (avgDivYield > 5.5 && payoutTrendStatus !== "declining") {
    divScore = 17 + Math.min(3, Math.round((avgDivYield - 5.5) * 0.7));
    divStatus = "BULLISH";
    divText = `Highly attractive weighted yield of ${avgDivYield.toFixed(2)}% backed by robust corporate cash distributions.`;
  } else if (avgDivYield >= 3.0 && payoutTrendStatus !== "declining") {
    divScore = 11 + Math.round((avgDivYield - 3.0) * 2);
    divStatus = "NEUTRAL";
    divText = `Moderate average yield of ${avgDivYield.toFixed(2)}% with stable, predictable year-over-year corporate distributions.`;
  } else {
    divScore = Math.max(0, Math.min(9, Math.round(avgDivYield * 2.2)));
    divStatus = "BEARISH";
    divText = `Low portfolio yield of ${avgDivYield.toFixed(2)}% or declining trend lines. Sub-optimal income cash flow coverage.`;
  }

  // SIGNAL 2: Stock Performance (Max Score: 20)
  // Compares 3M/1Y returns vs DSEX, RSI locations, and MACD crossovers
  let outperformanceWeight = 0;
  let healthyRsiWeight = 0;
  let bullishMacdWeight = 0;

  weightedHoldings.forEach(wh => {
    const symHistory = stockHistories[wh.symbol]?.data || [];
    const stockRet3M = calculateHistoricalReturn(symHistory, 60);
    const stockRet1Y = calculateHistoricalReturn(symHistory, 250);

    if (stockRet3M > dsexReturn3M) outperformanceWeight += 0.5 * wh.allocation;
    if (stockRet1Y > dsexReturn1Y) outperformanceWeight += 0.5 * wh.allocation;

    const ind = stockIndicators[wh.symbol];
    if (ind) {
      const rsi = ind.rsi14;
      if (rsi && rsi >= 35 && rsi <= 68) healthyRsiWeight += wh.allocation;
      
      const macd = ind.macd;
      const signal = ind.macdSignal;
      if (macd != null && signal != null && macd > signal) {
        bullishMacdWeight += wh.allocation;
      }
    } else {
      healthyRsiWeight += 0.5 * wh.allocation;
    }
  });

  let perfScore = 10;
  let perfStatus: "BULLISH" | "NEUTRAL" | "BEARISH" = "NEUTRAL";
  let perfText = "";

  const performanceIndex = outperformanceWeight + (healthyRsiWeight * 0.3) + (bullishMacdWeight * 0.4);

  if (performanceIndex >= 0.7) {
    perfScore = 16 + Math.round((performanceIndex - 0.7) * 13);
    perfScore = Math.min(20, perfScore);
    perfStatus = "BULLISH";
    perfText = "Strong technical velocity. Core assets are leading DSEX trends with supportive momentum and MACD alignments.";
  } else if (performanceIndex >= 0.45) {
    perfScore = 10 + Math.round((performanceIndex - 0.45) * 20);
    perfScore = Math.min(15, perfScore);
    perfStatus = "NEUTRAL";
    perfText = "Consolidating trends. Portfolio performance matches DSEX benchmark indices with neutral RSI indicators.";
  } else {
    perfScore = Math.max(1, Math.round(performanceIndex * 20));
    perfScore = Math.min(9, perfScore);
    perfStatus = "BEARISH";
    perfText = "Underperforming the benchmark index. Capital is dragged down by weak market momentum and severe support breakdowns.";
  }

  // SIGNAL 3: Company Fundamentals (Max Score: 20)
  // Evaluates standard accounting fields (PE vs sector average, CF-FHR score estimates)
  let weightedFScore = 0;
  let weightedPeRatio = 0;
  let sectorPeDelta = 0; // Negative means cheaper than sector
  let healthyLeverageWeight = 0;

  weightedHoldings.forEach(wh => {
    // Standard CS-FHR estimation (50-100 for compliant/healthy; low for distressed)
    let fScore = 55;
    if (wh.stock && wh.stock.hasRealFundamentals) {
      const pe = wh.peRatio;
      const roe = wh.stock.financials?.roe ?? 0.12;
      const debt = wh.stock.financials?.debtRatio ?? 0.35;
      
      fScore = pe < 11 ? 78 : pe < 18 ? 68 : 50;
      if (roe > 0.15) fScore += 10;
      if (debt <= 0.40) fScore += 12;
      else fScore -= 10;
    }
    fScore = Math.max(15, Math.min(95, fScore));
    weightedFScore += fScore * wh.allocation;
    weightedPeRatio += wh.peRatio * wh.allocation;

    // Estimate Sector averages
    const sectorPeAvg = wh.sector === "Pharmaceuticals & Chemicals" ? 16.5
      : wh.sector === "Banking" ? 8.2
      : wh.sector === "Telecommunication" ? 12.0
      : wh.sector === "Food & Allied" ? 15.8
      : 13.5;

    sectorPeDelta += (wh.peRatio - sectorPeAvg) * wh.allocation;

    const debt = wh.stock?.financials?.debtRatio ?? 0.4;
    if (debt <= 0.45) healthyLeverageWeight += wh.allocation;
  });

  let fundScore = 12;
  let fundStatus: "BULLISH" | "NEUTRAL" | "BEARISH" = "NEUTRAL";
  let fundText = "";

  if (weightedFScore >= 70 && sectorPeDelta < 1.0) {
    fundScore = 16 + Math.min(4, Math.round((weightedFScore - 70) * 0.16));
    fundStatus = "BULLISH";
    fundText = `High balance-sheet strength (CF-FHR weighted: ${weightedFScore.toFixed(0)}), with attractive average P/E of ${weightedPeRatio.toFixed(1)}x.`;
  } else if (weightedFScore >= 48) {
    fundScore = 10 + Math.round((weightedFScore - 48) * 0.25);
    fundScore = Math.min(15, fundScore);
    fundStatus = "NEUTRAL";
    fundText = `Fair financial profiles. Medium-tier solvency protection (weighted CS-FHR: ${weightedFScore.toFixed(0)}) with typical leverage.`;
  } else {
    fundScore = Math.max(1, Math.round(weightedFScore / 5));
    fundScore = Math.min(9, fundScore);
    fundStatus = "BEARISH";
    fundText = `Severe balance-sheet stress found. Elevated default probabilities, excessive P/E multiples, or poor asset usage ratios.`;
  }

  // SIGNAL 4: Market Conditions (Max Score: 10)
  // Analyzes DSEX RSI index ranges and DSE cash-flow volume momentum
  let marketScore = 5;
  let marketStatus: "BULLISH" | "NEUTRAL" | "BEARISH" = "NEUTRAL";
  let marketText = "";

  // Dynamic DSEX index trends
  const indexUpward = dsexReturn3M > 1.5;
  const indexDistressed = dsexReturn3M < -4.0;

  if (dsexRsi >= 40 && dsexRsi <= 64 && !indexDistressed) {
    marketScore = 8;
    marketStatus = "BULLISH";
    marketText = "Index is actively consolidating within a sustainable health zone (RSI 40-64) with consistent liquidity.";
  } else if (dsexRsi > 70) {
    marketScore = 4;
    marketStatus = "BEARISH";
    marketText = `DSEX index is deeply overbought (RSI: ${dsexRsi.toFixed(1)}). Profit harvesting risks are elevated.`;
  } else if (dsexRsi < 32) {
    marketScore = 3;
    marketStatus = "BEARISH";
    marketText = `Market is in bear capitulation (RSI: ${dsexRsi.toFixed(1)}). Liquidity squeeze is limiting rebound momentum.`;
  } else {
    marketScore = 6;
    marketStatus = "NEUTRAL";
    marketText = `DSEX index remains neutral (RSI: ${dsexRsi.toFixed(0)}) with range-bound volume trading.`;
  }

  // SIGNAL 5: Bangladesh Macro Context (Max Score: 30)
  // Calculates direct interest, inflation, forex depreciations, and floor-price safety.
  let macroScore = 15;
  let macroStatus: "BULLISH" | "NEUTRAL" | "BEARISH" = "NEUTRAL";
  let macroText = "";

  // Evaluate stress based on portfolio sensitivity:
  // - High interest rate hits leveraged manufacturing stocks
  // - USD/BDT depreciation benefits export-earners, penalizes import-heavy firms
  let macroRiskDelta = 0; // Higher means more defensive

  weightedHoldings.forEach(wh => {
    // Classification of symbols
    const isDefensive = ["GP", "BATBC", "SQURPHARMA"].includes(wh.symbol);
    const isExportBeneficiary = ["SQURPHARMA", "RENATA"].includes(wh.symbol);
    const isDebtLeveraged = ["BEXIMCO"].includes(wh.symbol);
    
    if (isDefensive) macroRiskDelta += 10 * wh.allocation;
    if (isExportBeneficiary) macroRiskDelta += 8 * wh.allocation;
    if (isDebtLeveraged) macroRiskDelta -= 12 * wh.allocation;
  });

  // Base score from macroscopic indicators
  let baseMacroScore = 12; // Out of 30 due to high central-bank policy rates and currency stress
  if (macro.interestRate.toLowerCase().includes("easing") || macro.interestRate.toLowerCase().includes("low")) {
    baseMacroScore += 6;
  }
  if (macro.inflation.toLowerCase().includes("stable") || parseFloat(macro.inflation) < 7.0) {
    baseMacroScore += 6;
  }
  if (macro.exchangeRate.toLowerCase().includes("stable")) {
    baseMacroScore += 5;
  }

  const finalMacroVal = baseMacroScore + (macroRiskDelta / 2);
  macroScore = Math.max(2, Math.min(30, Math.round(finalMacroVal)));

  if (macroScore >= 22) {
    macroStatus = "BULLISH";
    macroText = "Highly resilient macro allocation. Asset cash generation buffers interest scales and benefits from dollar-pegged exports.";
  } else if (macroScore >= 12) {
    macroStatus = "NEUTRAL";
    macroText = "Moderate currency exposure. High financial interest expenses are balanced by utility-class dividend buffers.";
  } else {
    macroStatus = "BEARISH";
    macroText = "High macro-sensitivity. Portfolio is highly vulnerable to BD cash policy rate hikes and imports cost inflation.";
  }

  // Aggregate Scores
  const overallScore = divScore + perfScore + fundScore + marketScore + macroScore;

  let verdict: any = "BALANCED";
  let verdictExplanation = "";
  if (overallScore >= 80) {
    verdict = "HIGH QUALITY PROFILE";
    verdictExplanation = "Educational Analysis: The simulated portfolio demonstrates strong diversification across solvent sectors, healthy dividend yields, and consistent historical performance.";
  } else if (overallScore >= 72) {
    verdict = "BALANCED PROFILE";
    verdictExplanation = "Educational Analysis: Sound asset distribution with moderate valuation multiples and reasonable sector balance.";
  } else if (overallScore >= 50) {
    verdict = "AVERAGE RESILIENCE";
    verdictExplanation = "Educational Analysis: Average portfolio resilience. Cash dividend yields help offset market fluctuations, but sector exposure may be somewhat clustered.";
  } else if (overallScore >= 38) {
    verdict = "ELEVATED CONCENTRATION RISK";
    verdictExplanation = "Educational Analysis: Higher concentration in capital-intensive or volatile sectors. Teaches how single-sector shocks impact portfolio stability.";
  } else {
    verdict = "HIGH VOLATILITY RISK";
    verdictExplanation = "Educational Analysis: Critical risk profile. Heavy exposure to high-debt or illiquid assets highlights the importance of asset allocation and diversification principles.";
  }

  // Portfolio KPIs: Diversification & Concentration risk
  const distinctSectors = Array.from(new Set(weightedHoldings.map(h => h.sector)));
  let diversificationScore = 20;
  if (distinctSectors.length === 1) diversificationScore = 30;
  else if (distinctSectors.length === 2) diversificationScore = 60;
  else if (distinctSectors.length >= 3) {
    diversificationScore = Math.min(100, 75 + distinctSectors.length * 5);
  }

  // Maximum single stock exposure
  const maxAlloc = Math.max(...weightedHoldings.map(h => h.allocation));
  let concentrationRisk: "Low" | "Medium" | "High" = "Low";
  if (maxAlloc > 0.60) concentrationRisk = "High";
  else if (maxAlloc > 0.35) concentrationRisk = "Medium";

  // Weighted Risk score
  // Low-beta, high-cap, high-CS health = lower risk
  let weightedRisk = 0;
  weightedHoldings.forEach(wh => {
    let stockRisk = 48; // Base
    const isGiant = ["GP", "BATBC"].includes(wh.symbol);
    const isHighYield = wh.divYield > 5.0;
    const isManufacturing = wh.sector.toLowerCase().includes("manufacturing") || wh.sector.toLowerCase().includes("textile");
    
    if (isGiant) stockRisk -= 15;
    if (isHighYield) stockRisk -= 8;
    if (wh.peRatio > 22) stockRisk += 20;
    if (isManufacturing) stockRisk += 10;
    if (wh.stock?.hasRealFundamentals === false) stockRisk += 15;

    weightedRisk += stockRisk * wh.allocation;
  });
  const riskScore = Math.max(15, Math.min(95, Math.round(weightedRisk)));

  // Generate Suggested Actions list based on holdings metrics
  const suggestedActions: string[] = [];
  if (concentrationRisk === "High") {
    suggestedActions.push("Mitigate single-holding exposure by trimming positions occupying over 40% value.");
  }
  if (diversificationScore < 60) {
    suggestedActions.push("Inject assets in unrelated niches (e.g. Telecommunication or Banking) to hedge cyclical margins downturns.");
  }
  if (avgDivYield < 3.5) {
    suggestedActions.push("Acquire cash utility stocks (e.g., GP, SQURPHARMA) to boost stable passive income above the inflation curve.");
  }
  
  // Specific holding review instructions
  weightedHoldings.forEach(wh => {
    if (wh.symbol === "BEXIMCO" && wh.allocation > 0.15) {
      suggestedActions.push("Limit BEXIMCO allocations to minimize financial leverage exposure during currency adjustments.");
    }
    if (wh.peRatio > 25) {
      suggestedActions.push(`High P/E alert on ${wh.symbol} (${wh.peRatio.toFixed(1)}x). Assess if profit compounding supports this premium.`);
    }
  });

  if (suggestedActions.length < 2) {
    suggestedActions.push("Harvest profits during DSEX peaks (RSI > 70) and reallocate to dividend-paying bluechips.");
    suggestedActions.push("Maintain an active BDT cash reserve (10-15%) to capture flash discount liquidity zones.");
  }

  const signalsList: SignalResult[] = [
    { name: "Dividend Growth Potential", score: divScore, maxScore: 20, status: divStatus, reasoning: divText },
    { name: "Technical Momentum & Stock Returns", score: perfScore, maxScore: 20, status: perfStatus, reasoning: perfText },
    { name: "Financial Quality & Valuation Standards", score: fundScore, maxScore: 20, status: fundStatus, reasoning: fundText },
    { name: "DSEX Market Sentiment Conditions", score: marketScore, maxScore: 10, status: marketStatus, reasoning: marketText },
    { name: "Bangladesh Macro-Micro Stress Index", score: macroScore, maxScore: 30, status: macroStatus, reasoning: macroText }
  ];

  return {
    overallScore,
    verdict,
    analysisText: verdictExplanation,
    signals: signalsList,
    suggestedActions,
    riskScore,
    diversificationScore,
    concentrationRisk
  };
}
