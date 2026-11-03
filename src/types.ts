export interface StockData {
  symbol: string;
  name: string;
  sector: string;
  subSector?: string;
  price: number;
  change: number;
  changePercent: number;
  marketCap: string | null; // e.g. "BDT 340.5B"
  peRatio: number | null;
  eps: number | null;
  nav: number | null;
  divYield: number | null;
  revGrowth: number | null; // e.g. 12.5 (representing %)
  profitGrowth: number | null; // e.g. 8.2 (representing %)
  week52High?: number | null;
  week52Low?:  number | null;
  avgVolume?:  number | null;
  volume?: number;
  trades?: number;
  high?: number | null;
  low?: number | null;
  open?: number | null;
  prevClose?: number | null;
  close?: number;
  ltp?: number;
  ycp?: number;
  value?: number;
  divPercent?: number;
  source?: "LiveScraped" | "CachedFile" | "DefaultSeed" | "Unavailable";
  dataSource?: "LiveScraped" | "CachedFile" | "DefaultSeed" | "Unavailable";
  lastUpdated?: string;
  isSimulation?: boolean;
  hasRealFundamentals?: boolean;
  /** Where EPS / NAV / P/E came from: DSE company page, or the bundled sample seed file */
  fundamentalsSource?: "DSE_OFFICIAL" | "BUNDLED_SAMPLE" | null;
  isGeneratedFallback?: boolean;
  sourceUrl?: string;
  timestamp?: string;
  live?: boolean;
  category?: string;
  dataAvailable?: boolean;
  reason?: string;
  marketDepth?: {
    buy: { price: number; volume: number; orders: number }[];
    sell: { price: number; volume: number; orders: number }[];
  } | null;
  financials?: {
    revenue: number[]; // Last 4 years/quarters
    netProfit: number[];
    epsHistory: number[];
    operatingCashFlow: number[];
    freeCashFlow: number[];
    debtRatio: number;
    roe: number;
    roa: number;
  } | null;
  financialHistory?: { year: string | number; [key: string]: any }[];
}

export interface MetricScore {
  name: string;
  score: number; // 0 - 100
  color: string;
}

export interface AIAnalysis {
  recommendation: string;
  reasoning: string[];
  fundamentalScore: number | null; // 0 - 100 or null if Insufficient
  breakdown: {
    profitability: string;
    liquidity: string;
    solvency: string;
    growth: string;
    efficiency: string;
  };
  peFairValue?: number | null;
  peFactorScore?: number | null;
  pegRatio?: number | null;
  pegFairValue?: number | null;
  pegFactorScore?: number | null;
  dcfFairValue?: number | null;
  cashFlowFactorScore?: number | null;
  fairValueEstimate?: number | null;
  discountPremium?: number | null;
  valuationStatus?: 'Undervalued' | 'Fair Valued' | 'Overvalued' | 'Unavailable';
  valuationModelMetrics?: {
    peWeight: number;
    pegWeight: number;
    dcfWeight: number;
  } | null;
}

export interface TechnicalIndicators {
  status?: 'Sufficient' | 'Unavailable';
  rsi: number | null;
  rsiStatus: 'Oversold' | 'Overbought' | 'Neutral' | 'Unavailable';
  macd: {
    line: number;
    signal: number;
    histogram: number;
  } | null;
  sma20: number | null;
  ema50: number | null;
  bollingerBands: {
    upper: number;
    middle: number;
    lower: number;
  } | null;
  support: number[];
  resistance: number[];
  aiInterpretation: string;
  decisionIntel?: any;
}

export interface ForecastPoint {
  date: string;
  historical?: number;
  expected?: number;
  bullCase?: number;
  bearCase?: number;
}

export interface HistoricalDataPoint {
  date: string;
  close: number;
  open?: number;
  high?: number;
  low?: number;
  volume?: number;
  sma20?: number;
  ema50?: number;
  upperEnvelope?: number;
  middleEnvelope?: number;
  lowerEnvelope?: number;
  envelopeZone?: string;
  envelopeSignal?: string;
  envelopePosition?: number;
  [key: string]: any;
}

export interface PredictionPoint {
  horizon: string;
  expectedPrice: number;
  bullCase: number;
  bearCase: number;
  confidenceLevel: number;
}

export interface RiskAnalysis {
  score: number; // 0 - 100
  level: 'Low Risk' | 'Medium Risk' | 'High Risk' | 'Extreme Risk';
  flags: string[];
  whatCouldGoWrong: string[];
  howToReduceRisk: string[];
}

export interface NewsItem {
  id: string;
  title: string;
  source: string;
  time: string;
  date?: string;
  sentiment?: 'positive' | 'neutral' | 'negative';
  relatedSymbol?: string;
  summary: string;
  impact: 'Bullish' | 'Neutral' | 'Bearish';
  impactExplanation: string;
  impactScore: number; // -100 to +100
}

export interface PortfolioAllocation {
  symbol: string;
  allocation: number; // % e.g. 25
  shares: number;
  reason: string;
  expectedAnnualReturn: number;
}

export interface Alert {
  id: string;
  symbol: string;
  type: 'Price Above' | 'Price Below' | 'Volume Spike' | 'Risk Escalation' | 'Earnings Report';
  targetValue: number;
  triggered: boolean;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'bot' | 'system' | 'assistant';
  text: string;
  timestamp: string;
  isAiAgentSuggested?: boolean;
}

export interface OHLCVRow {
  date:   string;
  open:   number;
  high:   number;
  low:    number;
  close:  number;
  volume: number;
}

export interface BulkImportPayload {
  symbol: string;
  rows:   OHLCVRow[];
}

export interface BulkImportResult {
  symbol:   string;
  inserted: number;
  updated:  number;
  skipped:  number;
  errors:   Array<{ row: number; reason: string }>;
}

export interface Holding {
  id: string;
  symbol: string;
  quantity: number;
  buyPrice: number;
  purchaseDate: string;
}

export interface SignalResult {
  name: string;
  score: number;
  maxScore: number;
  status: "BULLISH" | "NEUTRAL" | "BEARISH";
  reasoning: string;
}

export interface PortfolioRecommendation {
  overallScore: number;
  verdict: "BALANCED" | "DEFENSIVE" | "GROWTH" | "SPECULATIVE" | string;
  analysisText: string;
  signals: SignalResult[];
  suggestedActions: string[];
  riskScore: number;
  diversificationScore: number;
  concentrationRisk: "Low" | "Medium" | "High";
}

export interface MacroSignals {
  interestRate: string;
  inflation: string;
  exchangeRate: string;
  floorPriceStatus: string;
  creditRating: string;
  overallCountryRisk: "Conservative" | "Moderate" | "Aggressive";
}

export interface TradingSignalResult {
  symbol:       string;
  signal:       "STRONG POSITIVE MOMENTUM" | "MODERATE POSITIVE MOMENTUM" | "SLIGHT POSITIVE BIAS" | "NEUTRAL ALIGNMENT" | "SLIGHT NEGATIVE BIAS" | "MODERATE NEGATIVE MOMENTUM" | "STRONG NEGATIVE MOMENTUM" | string;
  score:        number;          // -10 to +10
  subScores:    Record<string, number>;
  reasoning:    string[];        // one line per contributing factor
  confidence:   number;          // 0–100
  generatedAt:  string;
  whatItShows?: string[];
  whatItCannotTellYou?: string[];
  questionsToInvestigate?: string[];
}

export interface EntryExitPlan {
  symbol:        string;
  currentPrice:  number;
  entryZone: {
    aggressive:    number;
    conservative:  number;
  };
  stopLoss: {
    tight:   number;
    normal:  number;
    wide:    number;
  };
  targets: {
    t1:      number;
    t2:      number;
    t3:      number;
    stretch: number | null;
  };
  trailingStop:  number;
  atr:           number;
  notes:         string[];
}

export interface RiskRewardCombination {
  entryType:  string;
  stopType:   string;
  target:     string;
  entryPrice: number;
  stopPrice:  number;
  targetPrice: number;
  reward:     number;
  risk:       number;
  ratio:      number;
  quality:    "Excellent" | "Good" | "Acceptable" | "Poor";
}

export interface RiskRewardResult {
  symbol: string;
  combinations: RiskRewardCombination[];
  bestCombination: RiskRewardCombination | null;
  recommendation:  string;
}

export interface RelativeVolumeResult {
  symbol:        string;
  todayVolume:   number;
  avgVolume20D:  number;
  avgVolume5D:   number;
  relVol20:      number;
  relVol5:       number;
  volumeSignal:  string;
  divergence:    string | null;
  volumeTrend:   "Rising" | "Falling" | "Flat";
  interpretation: string;
}

export interface BreakoutResult {
  symbol:           string;
  breakoutScore:    number;
  signal:           string;
  proximityToR1:    number;      // % distance
  bandWidth:        number;
  resistanceTests:  number;
  components:       Record<string, number>;
  interpretation:   string;
}

export interface SectorExposureItem {
  name:           string;
  value:          number;
  weight:         number;
  indexWeight:    number;
  activeExposure: number;
  return:         number;
  risk:           "High" | "Moderate" | "Acceptable";
  holdings:       string[];
}

export interface SectorExposureResult {
  sectors: SectorExposureItem[];
  concentrationScore:    number;    // 0–100 (100 = perfectly diversified)
  topSector:             string;
  underweightSectors:    string[];
  overweightSectors:     string[];
  diversificationGrade:  "A" | "B" | "C" | "D" | "F";
}

export interface StressScenarioHoldingImpact {
  symbol:  string;
  impact:  number;      // %
  loss:    number;      // BDT
  reason:  string;
}

export interface StressScenario {
  name:                  string;
  description:           string;
  portfolioImpact:       number;      // % change
  estimatedLoss:         number;      // BDT
  projectedValue:        number;      // BDT
  worstHolding:          string;
  bestResistingHolding:  string;
  holdingImpacts:        StressScenarioHoldingImpact[];
}

export interface StressTestResult {
  scenarios:          StressScenario[];
  overallRiskRating:  "Low" | "Moderate" | "High" | "Critical";
  mostVulnerable:     string[];
  mostResilient:      string[];
}

export interface OpportunityResult {
  symbol:           string;
  name:             string;
  sector:           string;
  opportunityScore: number;
  currentPrice:     number;
  signals:          string[];
  tradingSignal:    string;
  breakoutScore:    number;
  relVol20:         number;
  fundamentalScore: number;
}

export interface DangerResult {
  symbol:       string;
  name:         string;
  sector:       string;
  dangerScore:  number;
  severity:     "Critical" | "High" | "Elevated";
  currentPrice: number;
  warnings:     string[];
  tradingSignal: string;
  priceChange30D: number;
  fundamentalScore: number;
}export interface ValuationMethodResult {
  methodName:    string;
  fairPrice:     number;
  currentPB:     number | null;
  targetPB:      number | null;
  marginOfSafety: number;        // % — positive = undervalued
  signal:        string;
  formula:       string;         // human-readable formula used
  assumptions:   string[];       // key assumptions listed
  available:     boolean;        // false if data missing
}

export interface SectorBenchmark {
  sector:    string;
  avgPB:     number;
  avgEVBV:   number;
  avgROE:    number;
}

export interface SensitivityScenarioRow {
  pb?: number;
  roe?: number;
  justifiedPB?: number;
  impliedPrice: number;
  vsCurrent: number; // % comparison
  signal?: string;
}

export interface RelativeValuationMetric {
  metricName: string;
  companyValue: number | null;
  sectorAvg: number;
  industryAvg: number;
  marketAvg: number;
  percentile: number;
  peerRanking: string;
  verdict: "Undervalued" | "Fairly Valued" | "Overvalued";
}

export interface CfaFcffModelDetails {
  fairPrice: number;
  enterpriseValue: number;
  equityValue: number;
  wacc: number;
  costOfEquity: number;
  costOfDebt: number;
  operatingMargin: number;
  ebit: number;
  nopat: number;
  capex: number;
  workingCapitalChanges: number;
  terminalValue: number;
  terminalGrowth: number;
  marginOfSafety: number;
  available: boolean;
  formula: string;
  assumptions: string[];
}

export interface CfaFcfeModelDetails {
  fairPrice: number;
  equityValue: number;
  costOfEquity: number;
  netBorrowing: number;
  terminalValue: number;
  terminalGrowth: number;
  marginOfSafety: number;
  available: boolean;
  formula: string;
  assumptions: string[];
}

export interface CfaDdmModelDetails {
  fairPrice: number;
  isMultiStage: boolean;
  payoutRatio: number;
  dividendGrowthRate: number;
  requiredReturn: number;
  intrinsicValue: number;
  expectedDividendYield: number;
  expectedReturn: number;
  available: boolean;
  formula: string;
  assumptions: string[];
  history: Array<{ year: number; dividend: number }>;
}

export interface CfaRimDetails {
  intrinsicValue: number;
  bookValue: number;
  roe: number;
  costOfEquity: number;
  residualIncomeValue: number;
  available: boolean;
  formula: string;
  assumptions: string[];
}

export interface CfaAssetBasedDetails {
  fairPrice: number;
  bookValue: number;
  adjustedNav: number;
  adjustmentMultiplier: number;
  explanation: string;
  available: boolean;
  formula: string;
  assumptions: string[];
}

export interface CfaSotpDetails {
  fairPrice: number;
  coreBusinessValue: number;
  subSegmentValue: number;
  conglomerateDiscount: number;
  explanation: string;
  available: boolean;
  formula: string;
  assumptions: string[];
}

export interface CfaForecastingTimeline {
  year1: { revenue: number; eps: number; dividend: number; cashFlow: number; bookValue: number; priceTarget: number };
  year3: { revenue: number; eps: number; dividend: number; cashFlow: number; bookValue: number; priceTarget: number };
  year5: { revenue: number; eps: number; dividend: number; cashFlow: number; bookValue: number; priceTarget: number };
}

export interface CfaRecommendationWeight {
  weight: number;
  score: number;
}

export interface CfaRecommendationMatrix {
  investmentScore: number;
  confidenceScore: number;
  finalVerdict: "Favorable Multiples Profile" | "Moderate Value Profile" | "Neutral Valuation" | "Elevated Valuation" | "High Valuation Risk" | string;
  weights: {
    valuation: CfaRecommendationWeight;
    financialQuality: CfaRecommendationWeight;
    earningsGrowth: CfaRecommendationWeight;
    technicalStrength: CfaRecommendationWeight;
    riskFactors: CfaRecommendationWeight;
    marketSentiment: CfaRecommendationWeight;
  };
}

export interface CfaResearchReport {
  investmentThesis: string;
  bullCase: { targetPrice: number; scenarioText: string };
  baseCase: { targetPrice: number; scenarioText: string };
  bearCase: { targetPrice: number; scenarioText: string };
  keyCatalysts: string[];
  keyRisks: string[];
  valuationSummary: string;
  technicalSummary: string;
  forecastSummary: string;
  finalRecommendation: "Favorable Profile" | "Balanced Profile" | "Cautious Watchlist" | "Stressed Profile" | string;
  targetPrice: number;
  expectedReturn: number;
  marginOfSafety: number;
}

export interface EquityValuationResult {
  symbol:                 string;
  currentPrice:           number;
  bvps:                   number;         // NAV per share
  roe:                    number | null;
  costOfEquity:           number;
  beta:                   number;
  methods: {
    pbFairValue:          ValuationMethodResult;
    roeJustifiedPB:       ValuationMethodResult;
    grahamNumber:         ValuationMethodResult;
    evBookValue:          ValuationMethodResult;
    residualIncome:       ValuationMethodResult;
    peFairValue?:         ValuationMethodResult;
    psFairValue?:         ValuationMethodResult;
    pegFairValue?:        ValuationMethodResult;
    dyFairValue?:         ValuationMethodResult;
    evebitdaFairValue?:   ValuationMethodResult;
    dcfFairValue?:        ValuationMethodResult;
  };
  compositeFairValue:     number;
  compositeMarginOfSafety: number;
  compositeVerdict:       "Significantly Undervalued" |
                          "Undervalued" |
                          "Fairly Valued" |
                          "Slightly Overvalued" |
                          "Overvalued";
  sectorBenchmark:        SectorBenchmark;
  sensitivityAnalysis: {
    pbScenarios:    Array<{ pb: number; impliedPrice: number }>;
    roeScenarios:   Array<{ roe: number; justifiedPB: number; impliedPrice: number }>;
  };
  dataQuality:       "Complete" | "Partial" | "Minimal" | "Estimated";
  warnings:          string[];
  generatedAt:       string;
  conclusion?:       string;
  
  // Baseline stats to prevent front-end calculation leakage
  baseRevenue?:           number;
  currentPE?:             number | null;
  currentDY?:             number;
  currentFCF?:            number;
  sharesCount?:           number;
  
  // Expanded CFA structures
  relativeMetrics?:       RelativeValuationMetric[];
  fcffModel?:             CfaFcffModelDetails;
  fcfeModel?:             CfaFcfeModelDetails;
  ddmModel?:              CfaDdmModelDetails;
  rimDetail?:             CfaRimDetails;
  assetBased?:            CfaAssetBasedDetails;
  sotp?:                  CfaSotpDetails;
  forecasting?:           CfaForecastingTimeline;
  recommendationMatrix?:  CfaRecommendationMatrix;
  researchReport?:        CfaResearchReport;
}

export interface BLInputs {
  holdings: Array<{
    symbol: string;
    marketWeight: number;        // current weight in portfolio
    finalScore: number;          // from portfolioAdvisor (0-100)
    confidence: number;          // from portfolioAdvisor (0-100)
  }>;
  returnsHistory: Record<string, number[]>;  // daily returns per symbol
  riskAversion?: number;         // default 2.5
  tau?: number;                  // default 0.05
  maxPositionWeight?: number;    // default 0.25
}

export interface BLOutput {
  symbol: string;
  currentWeight: number;
  recommendedWeight: number;
  weightChange: number;          // recommendedWeight - currentWeight
  impliedReturn: number;         // Π_i (equilibrium return %)
  viewReturn: number;            // Q_i (AI view %)
  blendedReturn: number;         // E[R]_i (final blended %)
  action: "Increase" | "Decrease" | "Hold" | "New Position" | "Exit";
  rationale: string;
}

export interface BLPortfolioResult {
  allocations: BLOutput[];
  expectedPortfolioReturn: number;
  expectedPortfolioRisk: number;     // portfolio std dev
  sharpeEstimate: number;
  rebalanceRequired: boolean;        // true if any |weightChange| > 5%
  diversificationNote: string;
  generatedAt: string;
}



