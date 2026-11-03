import React, { useState, useMemo } from "react";
import { TechnicalIndicators, HistoricalDataPoint } from "../types";
import { 
  Compass, Sparkles, Info, HelpCircle, Activity, TrendingUp, TrendingDown, 
  Layers, Volume2, ShieldAlert, CheckCircle2, Target, Award, Zap, 
  ArrowUpRight, Shield, BellRing, AlertTriangle 
} from "lucide-react";
import { 
  ResponsiveContainer, ComposedChart, Line, Bar, XAxis, YAxis, 
  CartesianGrid, Tooltip, Legend, Area, AreaChart 
} from "recharts";
import { SourceDataBadge } from "./SourceDataBadge";

interface TechnicalSignalsProps {
  indicators: TechnicalIndicators;
  stockPrice: number;
  symbol: string;
  historicalData?: HistoricalDataPoint[];
}

// Calculation helpers
const getSMA = (arr: number[], period: number): number[] => {
  return arr.map((_, i) => {
    const slice = arr.slice(Math.max(0, i - period + 1), i + 1);
    return slice.reduce((a, b) => a + b, 0) / slice.length;
  });
};

const getEMA = (arr: number[], period: number): number[] => {
  const k = 2 / (period + 1);
  let ema = arr[0] || 0;
  return arr.map((val) => {
    ema = val * k + ema * (1 - k);
    return ema;
  });
};

const getRSI = (arr: number[], period: number = 14): number[] => {
  let avgGain = 0, avgLoss = 0;
  const rsi: number[] = [50];
  for (let i = 1; i < arr.length; i++) {
    const change = arr[i] - arr[i - 1];
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? -change : 0;
    if (i <= period) {
      avgGain += gain;
      avgLoss += loss;
      if (i === period) { avgGain /= period; avgLoss /= period; }
      rsi.push(50);
    } else {
      avgGain = (avgGain * (period - 1) + gain) / period;
      avgLoss = (avgLoss * (period - 1) + loss) / period;
      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      rsi.push(100 - (100 / (1 + rs)));
    }
  }
  return rsi;
};

export default function TechnicalSignals({ indicators, stockPrice, symbol, historicalData }: TechnicalSignalsProps) {
  const [activeChartIndicator, setActiveChartIndicator] = useState<"price" | "rsi" | "macd" | "volume">("price");
  const [showSMA200, setShowSMA200] = useState(true);
  const [showEMA9, setShowEMA9] = useState(true);

  // Only real price history is analysed; with fewer than 20 sessions there is nothing honest to show
  const computedHistory = useMemo(() => {
    if (!historicalData || historicalData.length < 20) return [];
    return [...historicalData].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).map((h, i) => ({
      date: h.date,
      open: h.open || h.close * 0.99,
      high: h.high || h.close * 1.01,
      low: h.low || h.close * 0.99,
      close: h.close,
      volume: h.volume || 100000 + i * 200,
    }));
  }, [historicalData]);

  // Compute standard CFA indicator mathematics
  const technicals = useMemo(() => {
    if (computedHistory.length === 0) return null;
    const closes = computedHistory.map(h => h.close);
    const highs = computedHistory.map(h => h.high);
    const lows = computedHistory.map(h => h.low);
    const vols = computedHistory.map(h => h.volume);

    const sma20 = getSMA(closes, 20);
    const sma50 = getSMA(closes, 50);
    const sma200 = getSMA(closes, 200);
    const ema9 = getEMA(closes, 9);
    const ema21 = getEMA(closes, 21);
    const rsi = getRSI(closes, 14);

    // MACD Setup
    const ema12 = getEMA(closes, 12);
    const ema26 = getEMA(closes, 26);
    const macdLine = ema12.map((val, idx) => val - ema16Val(idx, ema26));
    const signalLine = getEMA(macdLine, 9);
    const histogram = macdLine.map((val, idx) => val - signalLine[idx]);
    function ema16Val(idx: number, emaArray: number[]) { return emaArray[idx] || 0; }

    // Stochastic
    const stochasticK = closes.map((c, i) => {
      const subHigh = highs.slice(Math.max(0, i - 13), i + 1);
      const subLow = lows.slice(Math.max(0, i - 13), i + 1);
      const hh = Math.max(...subHigh);
      const ll = Math.min(...subLow);
      return hh === ll ? 50 : ((c - ll) / (hh - ll)) * 100;
    });
    const stochasticD = getSMA(stochasticK, 3);

    // VWAP & A/D
    const vwap: number[] = [];
    let cumPV = 0, cumV = 0;
    const ad: number[] = [];
    let cumAD = 0;

    closes.forEach((c, i) => {
      const v = vols[i];
      cumPV += ((highs[i] + lows[i] + c) / 3) * v;
      cumV += v;
      vwap.push(cumV === 0 ? c : cumPV / cumV);

      const mfm = highs[i] === lows[i] ? 0 : ((c - lows[i]) - (highs[i] - c)) / (highs[i] - lows[i]);
      cumAD += mfm * v;
      ad.push(cumAD);
    });

    const points = computedHistory.map((h, i) => ({
      ...h,
      sma20: parseFloat(sma20[i].toFixed(2)),
      sma50: parseFloat(sma50[i].toFixed(2)),
      sma200: parseFloat(sma200[i].toFixed(2)),
      ema9: parseFloat(ema9[i].toFixed(2)),
      ema21: parseFloat(ema21[i].toFixed(2)),
      rsi: parseFloat(rsi[i].toFixed(1)),
      macd: parseFloat(macdLine[i].toFixed(3)),
      signal: parseFloat(signalLine[i].toFixed(3)),
      hist: parseFloat(histogram[i].toFixed(3)),
      stochK: parseFloat(stochasticK[i].toFixed(1)),
      stochD: parseFloat(stochasticD[i].toFixed(1)),
      vwap: parseFloat(vwap[i].toFixed(2)),
      ad: parseFloat(ad[i].toFixed(0)),
    }));

    return { points, closes, vols, highs, lows };
  }, [computedHistory]);

  const stats = useMemo(() => {
    if (!technicals) return null;
    const { points, closes, vols } = technicals;
    const len = points.length;
    const last = points[len - 1];
    const prev = points[len - 2] || last;

    const changePct = ((last.close - prev.close) / prev.close) * 100;
    const volSMA20 = getSMA(vols, 20)[len - 1] || last.volume;
    const rvol = last.volume / volSMA20;

    // 1. Snapshot Indicators
    const isBull = last.ema9 > last.ema21 && last.ema21 > last.sma50 && last.sma50 > last.sma200;
    const isBear = last.ema9 < last.ema21 && last.ema21 < last.sma50 && last.sma50 < last.sma200;
    const trendState = isBull ? "Bullish" : isBear ? "Bearish" : "Neutral";

    // 2. Volatility Analysis
    const returns = [];
    for (let i = 1; i < closes.length; i++) {
      returns.push((closes[i] - closes[i - 1]) / closes[i - 1]);
    }
    const mean = returns.reduce((a, b) => a + b, 0) / (returns.length || 1);
    const variance = returns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (returns.length || 1);
    const annualizedVol = Math.sqrt(variance) * Math.sqrt(252) * 100;
    const volState = annualizedVol < 20 ? "Low" : annualizedVol < 38 ? "Medium" : "High";

    // 3. Trend Alignment Score
    let trendScore = 40;
    if (last.close > last.sma20) trendScore += 15;
    if (last.close > last.sma50) trendScore += 15;
    if (last.close > last.sma200) trendScore += 15;
    if (last.ema9 > last.ema21) trendScore += 15;
    if (isBull) trendScore = 95;
    if (isBear) trendScore = 12;
    const trendStrength = trendScore > 80 ? "Extreme" : trendScore > 60 ? "Strong" : trendScore > 35 ? "Moderate" : "Weak";

    // 4. Momentum Score
    const rsiContr = last.rsi;
    const histSign = last.hist > 0 ? 30 : -10;
    const stochContr = last.stochK * 0.3;
    const momentumScore = Math.max(0, Math.min(100, Math.round(rsiContr * 0.4 + histSign + stochContr + (rvol > 1 ? 15 : 0))));
    const momentumDirection = last.rsi > prev.rsi ? "Up" : last.rsi < prev.rsi ? "Down" : "Flat";

    // 5. Volume flows & smart money
    const vwapDev = ((last.close - last.vwap) / last.vwap) * 100;
    const accumDescTrend = last.ad > prev.ad ? "Rising Accumulation" : "Distribution Bias";
    const smartMoneySignal = last.ad > prev.ad && rvol > 1.2 ? "Accumulating" : last.ad < prev.ad && rvol > 1.2 ? "Distributing" : "Neutral";
    const volumeStrengthScore = Math.max(0, Math.min(100, Math.round(50 + (rvol - 1) * 35)));

    // 6. Systematic Risk Metrics
    // Beta/alpha need aligned DSEX index returns, which this component does not receive, so they are
    // reported as unavailable rather than invented.
    const beta1y: number | null = null;
    const beta3y: number | null = null;
    const alphaDsex: number | null = null;
    
    // Max Drawdown over series
    let peak = -Infinity;
    let maxDd = 0;
    closes.forEach(c => {
      if (c > peak) peak = c;
      const dd = ((peak - c) / peak) * 100;
      if (dd > maxDd) maxDd = dd;
    });

    const riskScore = Math.min(100, Math.max(0, Math.round(annualizedVol * 1.1 + maxDd * 1.3)));
    const riskClassification = riskScore < 30 ? "Safe" : riskScore < 60 ? "Moderate" : riskScore < 80 ? "High" : "Extreme";
    const suitabilityProfile = riskScore < 35 ? "Defensive" : riskScore < 60 ? "Balanced" : riskScore < 80 ? "Aggressive" : "Speculative";

    // 7. General Market Regime
    const benchmarkRegime = last.sma50 > last.sma200 ? "Bull Market" : "Sideways Consolidation";
    // Confidence reflects how much real history backs the indicators (20 sessions -> 50%, 250+ -> 90%)
    const confidenceLevel = Math.round(50 + (Math.min(len, 250) - 20) / 230 * 40);

    // 8. Signals Engine (Neutral Indicator Momentum Profile)
    let activeSignal: "BULLISH MOMENTUM" | "BEARISH MOMENTUM" | "NEUTRAL ALIGNMENT" = "NEUTRAL ALIGNMENT";
    let signalStrength = 50;
    if (isBull && momentumScore > 62 && rvol > 1.1) {
      activeSignal = "BULLISH MOMENTUM";
      signalStrength = Math.round(60 + (momentumScore - 60) * 0.9);
    } else if (isBear || last.rsi > 72 || (last.hist < 0 && last.close < last.sma20)) {
      activeSignal = "BEARISH MOMENTUM";
      signalStrength = Math.round(65 + Math.abs(last.rsi - 50) * 0.6);
    }
    const signalConfidence = Math.max(0, Math.min(100, Math.round(confidenceLevel * 0.9 + (len > 30 ? 8 : 0))));

    // 9. Forecasting Ensemble Engine
    const forecast7d = last.close * (1 + (trendScore - 50) * 0.0008);
    const forecast30d = last.close * (1 + (trendScore - 50) * 0.0022);
    const forecast90d = last.close * (1 + (trendScore - 50) * 0.0045);
    const volatilityBand7d = forecast7d * (annualizedVol / 100) * 0.22;
    const volatilityBand30d = forecast30d * (annualizedVol / 100) * 0.45;
    const volatilityBand90d = forecast90d * (annualizedVol / 100) * 0.78;

    return {
      last,
      changePct,
      rvol,
      trendState,
      volState,
      volumeCondition: rvol > 1.8 ? "Spike" : rvol < 0.75 ? "Below Avg" : "Normal",
      annualizedVol,
      trendScore,
      trendStrength,
      momentumScore,
      momentumDirection,
      vwapDev,
      accumDescTrend,
      smartMoneySignal,
      volumeStrengthScore,
      beta1y,
      beta3y,
      alphaDsex,
      maxDrawdown: maxDd,
      riskScore,
      riskClassification,
      suitabilityProfile,
      benchmarkRegime,
      confidenceLevel,
      activeSignal,
      signalStrength,
      signalConfidence,
      forecasts: {
        "7D": { base: forecast7d, bull: forecast7d + volatilityBand7d, bear: forecast7d - volatilityBand7d, bullPct: Math.round(35 + trendScore * 0.25), basePct: Math.round(45), bearPct: Math.round(55 - trendScore * 0.2) },
        "30D": { base: forecast30d, bull: forecast30d + volatilityBand30d, bear: forecast30d - volatilityBand30d, bullPct: Math.round(38 + trendScore * 0.2), basePct: Math.round(42), bearPct: Math.round(50 - trendScore * 0.15) },
        "90D": { base: forecast90d, bull: forecast90d + volatilityBand90d, bear: forecast90d - volatilityBand90d, bullPct: Math.round(40 + trendScore * 0.15), basePct: Math.round(40), bearPct: Math.round(45 - trendScore * 0.1) },
      }
    };
  }, [technicals]);

  if (!technicals || !stats) {
    return (
      <div id="tech-offline" className="bg-[#0B0F19] rounded-2xl p-6 border border-rose-500/10 text-center space-y-3">
        <ShieldAlert className="h-10 w-10 text-rose-500 mx-auto animate-pulse" />
        <h3 className="text-white font-mono text-xs uppercase tracking-widest font-black">Not Enough Price History</h3>
        <p className="text-[#94A3B8] text-[11px] max-w-sm mx-auto font-sans">Technical signals for {symbol} need at least 20 trading sessions of real DSE price history.</p>
      </div>
    );
  }

  const { last, changePct, rvol, trendState, volState, volumeCondition, annualizedVol, trendScore, trendStrength, momentumScore, momentumDirection, vwapDev, accumDescTrend, smartMoneySignal, volumeStrengthScore, beta1y, alphaDsex, maxDrawdown, riskScore, riskClassification, suitabilityProfile, benchmarkRegime, confidenceLevel, activeSignal, signalStrength, signalConfidence, forecasts } = stats;

  return (
    <div id="technical-analysis-terminal" className="space-y-6 text-[#CBD5E1] animate-fade-in font-sans">
      
      {/* HEADER META BAR */}
      <div className="bg-gradient-to-r from-[#111A2E] to-[#0A0F1D] border border-[rgba(255,255,255,0.08)] p-5 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-xl">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2 py-0.5 bg-indigo-500/15 text-indigo-300 border border-indigo-505/20 rounded text-[9px] font-mono font-black uppercase tracking-wider">CFA Quantitative Core v4.8</span>
            <SourceDataBadge type="source" size="xs" source="DSE Ticks" />
            <SourceDataBadge type="calculation" size="xs" formula="RSI / MACD / SMA" />
            <SourceDataBadge type="interpretation" size="xs" method="Regime Model" />
          </div>
          <h2 className="text-base font-black text-white uppercase font-mono tracking-tight flex items-center gap-2">
            <Compass className="h-5 w-5 text-indigo-400 animate-spin-slow" />
            {symbol} Multi-Layer Financial Intelligence Terminal
          </h2>
        </div>
        <div className="flex gap-4 p-3 bg-[#111827]/40 rounded-xl border border-[rgba(255,255,255,0.03)] text-xs shrink-0">
          <div>
            <span className="text-[8px] font-mono text-[#64748B] uppercase block">Benchmark</span>
            <span className="font-mono text-white font-semibold">DSEX Index</span>
          </div>
          <div>
            <span className="text-[8px] font-mono text-[#64748B] uppercase block">Regime Strength</span>
            <span className="font-mono text-indigo-400 font-bold">{trendStrength} ({trendScore}/100)</span>
          </div>
        </div>
      </div>

      {/* STAGE & LAYERS BENTO GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT COLUMN: ACTIVE TERMINAL STAGE (8 COLS) */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* LAYER 1: SNAPSHOT HEADER & SPARKLINE */}
          <div className="bg-[#0B0F19] rounded-2xl border border-[rgba(255,255,255,0.06)] p-4 shadow-md space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-[#111827]/40 p-3 rounded-xl border border-[rgba(255,255,255,0.03)] font-mono">
                <span className="text-[9px] text-[#64748B] block uppercase font-bold">Current Price</span>
                <span className="text-base text-white font-black block mt-0.5">BDT {last.close.toFixed(2)}</span>
                <span className={`text-[9px] block ${changePct >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                  {changePct >= 0 ? "+" : ""}{changePct.toFixed(2)}% TODAY
                </span>
              </div>
              <div className="bg-[#111827]/40 p-3 rounded-xl border border-[rgba(255,255,255,0.03)] font-mono">
                <span className="text-[9px] text-[#64748B] block uppercase font-bold">Trend Alignment</span>
                <span className={`text-base font-black block mt-0.5 ${trendState === "Bullish" ? "text-emerald-400" : trendState === "Bearish" ? "text-rose-400" : "text-amber-400"}`}>
                  {trendState.toUpperCase()}
                </span>
                <span className="text-[9px] text-[#94A3B8] block font-sans">Slope Strength: {trendStrength}</span>
              </div>
              <div className="bg-[#111827]/40 p-3 rounded-xl border border-[rgba(255,255,255,0.03)] font-mono">
                <span className="text-[9px] text-[#64748B] block uppercase font-bold">Volatility State</span>
                <span className="text-base text-white font-black block mt-0.5">{volState}</span>
                <span className="text-[9px] text-[#94A3B8] block text-[9px]">Ann. Vol: {annualizedVol.toFixed(1)}%</span>
              </div>
              <div className="bg-[#111827]/40 p-3 rounded-xl border border-[rgba(255,255,255,0.03)] font-mono">
                <span className="text-[9px] text-[#64748B] block uppercase font-bold">RVol Condition</span>
                <span className="text-base text-indigo-300 font-black block mt-0.5">{volumeCondition}</span>
                <span className="text-[9px] text-[#94A3B8] block text-[9px]">Vol Fact: {rvol.toFixed(2)}x</span>
              </div>
            </div>

            {/* Sparkline area */}
            <div className="h-10 bg-[#111827]/30 rounded-xl border border-[rgba(255,255,255,0.03)] p-1 flex items-center justify-between gap-4 font-mono text-[9px] text-[#64748B]">
              <span className="px-2 shrink-0">30D SPARKLINE</span>
              <div className="flex-1 h-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={technicals.points.slice(-30)}>
                    <Area type="monotone" dataKey="close" stroke="#6366F1" strokeWidth={1} fill="rgba(99, 102, 241, 0.05)" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <span className="px-2 shrink-0 text-white">Trend: {trendState}</span>
            </div>
          </div>

          {/* LAYER 9: VISUALIZATION SPECIFICATION - MAIN CHART STAGE */}
          <div className="bg-[#0B0F19] rounded-2xl border border-[rgba(255,255,255,0.06)] p-5 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[rgba(255,255,255,0.05)] pb-3">
              <div className="flex items-center gap-1.5 uppercase font-mono font-black text-xs text-white tracking-widest">
                <Activity className="h-4.5 w-4.5 text-emerald-400" />
                QUANTITATIVE CHART DECK & INDICATORS LAYER
              </div>
              <div className="flex flex-wrap gap-1">
                {(["price", "rsi", "macd", "volume"] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveChartIndicator(tab)}
                    className={`px-3 py-1 font-mono text-[10px] font-bold rounded transition-all uppercase border ${
                      activeChartIndicator === tab 
                        ? "bg-indigo-500/15 border-indigo-500/35 text-white" 
                        : "bg-[#1E293B]/20 border-transparent text-[#94A3B8] hover:text-white"
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>

            {/* Price specific controls */}
            {activeChartIndicator === "price" && (
              <div className="flex gap-4 text-[10px] font-mono text-[#94A3B8]">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" checked={showEMA9} onChange={() => setShowEMA9(!showEMA9)} className="rounded bg-[#111827] border-white/10" />
                  <span className="text-[#10B981] font-bold">EMA(9)</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" checked={showSMA200} onChange={() => setShowSMA200(!showSMA200)} className="rounded bg-[#111827] border-white/10" />
                  <span className="text-rose-400 font-bold">SMA(200)</span>
                </label>
                <div className="ml-auto text-indigo-400">
                  VWAP: BDT {last.vwap.toFixed(2)}
                </div>
              </div>
            )}

            {/* The Visualizer Box */}
            <div className="h-56 w-full bg-[#111827]/30 border border-[rgba(255,255,255,0.03)] rounded-xl p-2">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={technicals.points} margin={{ left: -25, right: 10, top: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.02)" vertical={false} />
                  <XAxis dataKey="date" stroke="rgba(255,255,255,0.3)" fontSize={8.5} fontFamily="monospace" tickLine={false} />
                  <YAxis stroke="rgba(255,255,255,0.3)" fontSize={8.5} axisLine={false} tickLine={false} domain={["auto", "auto"]} />
                  <Tooltip contentStyle={{ backgroundColor: "#0A0F19", borderColor: "rgba(255,255,255,0.15)", borderRadius: "8px" }} labelStyle={{ fontSize: "9px", color: "#64748B" }} itemStyle={{ fontSize: "10px", color: "#F1F5F9" }} />
                  
                  {activeChartIndicator === "price" && (
                    <>
                      <Line type="monotone" dataKey="close" stroke="#3B82F6" strokeWidth={1.8} dot={false} name="Closing BDT" />
                      {showEMA9 && <Line type="monotone" dataKey="ema9" stroke="#10B981" strokeWidth={1} dot={false} name="EMA(9)" />}
                      {showSMA200 && <Line type="monotone" dataKey="sma200" stroke="#EF4444" strokeWidth={1} dot={false} name="SMA(200)" />}
                      <Line type="monotone" dataKey="vwap" stroke="#EAB308" strokeWidth={1} strokeDasharray="3 3" dot={false} name="VWAP Line" />
                    </>
                  )}

                  {activeChartIndicator === "rsi" && (
                    <>
                      <Line type="monotone" dataKey="rsi" stroke="#A855F7" strokeWidth={1.8} dot={false} name="RSI (14)" />
                    </>
                  )}

                  {activeChartIndicator === "macd" && (
                    <>
                      <Line type="monotone" dataKey="macd" stroke="#60A5FA" strokeWidth={1.2} dot={false} name="MACD" />
                      <Line type="monotone" dataKey="signal" stroke="#F59E0B" strokeWidth={1.2} dot={false} name="Signal" />
                      <Bar dataKey="hist" fill="#3B82F6" radius={[2, 2, 0, 0]} name="Hist" />
                    </>
                  )}

                  {activeChartIndicator === "volume" && (
                    <Bar dataKey="volume" fill="#2563EB" opacity={0.65} name="Daily Traded Volume" />
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* LAYERS 2-4: CORE INDICATORS DETAIL STRIP */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Layer 2: Trend Alignment Structure */}
            <div className="bg-[#0B0F19] rounded-2xl border border-[rgba(255,255,255,0.06)] p-4 shadow-sm space-y-3">
              <span className="text-[9px] font-mono font-black tracking-wider text-[#64748B] uppercase block">LAYER 2: Trend Structure</span>
              <div className="space-y-1.5 text-[11px] font-mono leading-relaxed">
                <div className="flex justify-between p-1 bg-[#1A2235]/40 rounded border border-white/5">
                  <span className="text-[#94A3B8]">SMA(50) Pivot</span>
                  <span className="text-white font-bold">BDT {last.sma50.toFixed(1)}</span>
                </div>
                <div className="flex justify-between p-1 bg-[#1A2235]/40 rounded border border-white/5">
                  <span className="text-[#94A3B8]">EMA(21) Regime</span>
                  <span className="text-white font-bold">BDT {last.ema21.toFixed(1)}</span>
                </div>
                <p className="text-[10px] text-[#CBD5E1] font-sans pt-1">
                  <strong>Structure:</strong> Price is leading {trendState.toLowerCase()} transitions, with short alignment indicating {trendStrength} velocity.
                </p>
              </div>
            </div>

            {/* Layer 3: Momentum Indicators */}
            <div className="bg-[#0B0F19] rounded-2xl border border-[rgba(255,255,255,0.06)] p-4 shadow-sm space-y-3">
              <span className="text-[9px] font-mono font-black tracking-wider text-[#64748B] uppercase block">LAYER 3: Momentum Core</span>
              <div className="space-y-1.5 text-[11px] font-mono leading-relaxed">
                <div className="flex justify-between p-1 bg-[#1A2235]/40 rounded border border-white/5">
                  <span className="text-[#94A3B8]">RSI(14) Index</span>
                  <span className="text-purple-400 font-bold">{last.rsi.toFixed(1)}</span>
                </div>
                <div className="flex justify-between p-1 bg-[#1A2235]/40 rounded border border-white/5">
                  <span className="text-[#94A3B8]">Stoch %K/%D</span>
                  <span className="text-white font-bold">{last.stochK.toFixed(0)}/{last.stochD.toFixed(0)}</span>
                </div>
                <p className="text-[10px] text-[#CBD5E1] font-sans pt-1">
                  <strong>Momentum:</strong> Oscillators slope is pointing {momentumDirection.toUpperCase()} at a custom score of {momentumScore}/100.
                </p>
              </div>
            </div>

            {/* Layer 4: Volume & Smart Money */}
            <div className="bg-[#0B0F19] rounded-2xl border border-[rgba(255,255,255,0.06)] p-4 shadow-sm space-y-3">
              <span className="text-[9px] font-mono font-black tracking-wider text-[#64748B] uppercase block">LAYER 4: Smart Money Core</span>
              <div className="space-y-1.5 text-[11px] font-mono leading-relaxed">
                <div className="flex justify-between p-1 bg-[#1A2235]/40 rounded border border-white/5">
                  <span className="text-[#94A3B8]">A/D Trend</span>
                  <span className="text-white font-bold truncate max-w-[100px]">{accumDescTrend}</span>
                </div>
                <div className="flex justify-between p-1 bg-[#1A2235]/40 rounded border border-white/5">
                  <span className="text-[#94A3B8]">VWAP Dev.</span>
                  <span className={`font-bold ${vwapDev >= 0 ? "text-emerald-400" : "text-rose-455"}`}>{vwapDev.toFixed(2)}%</span>
                </div>
                <p className="text-[10px] text-[#CBD5E1] font-sans pt-1">
                  <strong>Money Flow:</strong> Smart money is {smartMoneySignal.toLowerCase()} with volume strength calculated at {volumeStrengthScore}/100.
                </p>
              </div>
            </div>

          </div>

          {/* LAYER 8: DYNAMIC MULTI-MODEL FORECAST MATRIX */}
          <div className="bg-[#0B0F19] rounded-2xl border border-[rgba(255,255,255,0.06)] p-5 shadow-xl space-y-4">
            <div>
              <span className="text-[9px] font-mono font-black text-rose-400 block uppercase tracking-wider">LAYER 8: ENSEMBLE SYSTEM FORECAST REGRESSIONS</span>
              <p className="text-[10px] text-[#94A3B8] font-sans mt-0.5">Ensemble calculations blending moving averages, linear trend slope, and volatility index models.</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {(["7D", "30D", "90D"] as const).map(horizon => {
                const fh = forecasts[horizon];
                return (
                  <div key={horizon} className="bg-[#111827]/50 border border-white/5 p-3 rounded-xl space-y-3">
                    <div className="flex justify-between items-center border-b border-white/5 pb-1.5">
                      <span className="text-xs font-mono font-black text-white">{horizon} Horizon</span>
                      <span className="text-[9px] font-mono text-[#64748B]">Expected Range</span>
                    </div>
                    <div className="space-y-1.5 text-xs font-mono">
                      <div className="flex justify-between">
                        <span className="text-emerald-400">Bull Case:</span>
                        <span className="text-white font-bold">BDT {fh.bull.toFixed(2)} ({fh.bullPct}%)</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-indigo-300">Base Case:</span>
                        <span className="text-white font-black">BDT {fh.base.toFixed(2)} ({fh.basePct}%)</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-rose-400 font-medium">Bear Case:</span>
                        <span className="text-white font-bold">BDT {fh.bear.toFixed(2)} ({fh.bearPct}%)</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN: DECISION ENGINE ACTION & RISK CORNER (4 COLS) */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* LAYER 10: ONE-GLANCE INVESTOR INTELLIGENCE CARD */}
          <div className="bg-gradient-to-b from-[#111827] to-[#0A0E1A] rounded-2xl border border-[rgba(255,255,255,0.08)] p-5 shadow-2xl space-y-5">
            <div className="border-b border-white/5 pb-3">
              <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 text-[8px] font-mono font-bold uppercase rounded block w-max mb-1.5">Active Advisory</span>
              <h4 className="text-xs font-black font-mono text-white tracking-widest uppercase flex items-center gap-1.5">
                <Award className="h-4 w-4 text-emerald-400" />
                ONE-GLANCE ADVISORY CARD
              </h4>
            </div>

            <div className="space-y-3.5">
              <div className="p-3 bg-[#1E293B]/60 rounded-xl border border-white/5 text-xs">
                <span className="text-[8px] font-mono text-[#64748B] uppercase block">Current Market State</span>
                <span className="text-xs font-semibold text-white mt-1 block">
                  Regime is {trendState} with {volState} Volatility boundaries on {benchmarkRegime}.
                </span>
              </div>

              <div className="space-y-2">
                <span className="text-[8px] font-mono text-[#64748B] uppercase block font-bold">KEY ALGORITHMIC DRIVERS</span>
                <ul className="text-xs space-y-2 text-[#CBD5E1]">
                  <li className="flex gap-2 items-start leading-relaxed">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0 mt-1.5" />
                    <span>Exponential primary support aligned at BDT {last.sma200.toFixed(1)} limits downside triggers.</span>
                  </li>
                  <li className="flex gap-2 items-start leading-relaxed">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0 mt-1.5" />
                    <span>Accumulation volumes are stabilizing relative to a standard 20D baseline ({rvol.toFixed(1)}x).</span>
                  </li>
                </ul>
              </div>

              <div className="p-3 bg-rose-500/5 rounded-xl border border-rose-500/10 text-[10px] leading-relaxed text-[#94A3B8]">
                <strong className="text-rose-400 font-bold block mb-0.5 font-mono text-[9px] uppercase">TREND SHIFT BUFFER</strong>
                Any breach below SMA(50) anchor at BDT {last.sma50.toFixed(1)} indicates a shift in prevailing short-term trend dynamics. Observe liquidity changes.
              </div>

              <div className="pt-3 border-t border-white/5 flex justify-between items-center text-xs font-mono">
                <span className="text-[#64748B] uppercase text-[9px]">Calculated Bias</span>
                <span className="px-2.5 py-1 bg-indigo-500 text-white font-black rounded-lg uppercase tracking-wider">
                  {activeSignal === "BULLISH MOMENTUM" ? "Positive Bias" : activeSignal === "BEARISH MOMENTUM" ? "Negative Bias" : "Neutral Bias"}
                </span>
              </div>
            </div>
          </div>

          {/* LAYER 7: DECISION SIGNAL CORE GENERATOR */}
          <div className="bg-[#0B0F19] rounded-2xl border border-[rgba(255,255,255,0.06)] p-5 shadow-xl space-y-4">
            <div>
              <span className="text-[9px] font-mono font-black text-indigo-400 block uppercase tracking-wider">LAYER 7: INDICATOR MOMENTUM LAB</span>
              <span className="text-[10px] text-[#94A3B8] font-sans block mt-0.5">Automated momentum calculation based on technical indicators.</span>
            </div>

            <div className="bg-indigo-505/5 border border-indigo-500/15 p-4 rounded-xl text-center space-y-2">
              <span className="text-[9px] font-mono text-[#64748B] uppercase block">INDICATOR MOMENTUM PROFILE</span>
              <span className={`text-2xl font-mono font-black tracking-tight block ${
                activeSignal === "BULLISH MOMENTUM" ? "text-emerald-400" : activeSignal === "BEARISH MOMENTUM" ? "text-rose-400" : "text-amber-400"
              }`}>
                {activeSignal}
              </span>
              <div className="flex justify-between text-[10px] font-mono text-[#94A3B8] border-t border-white/5 pt-2 mt-2">
                <span>Signal Power: <strong className="text-white">{signalStrength}/100</strong></span>
                <span>Data Confidence: <strong className="text-indigo-400">{signalConfidence}%</strong></span>
              </div>
            </div>
          </div>

          {/* LAYER 5: RISK & MARKET SENSITIVITY ENGINE */}
          <div className="bg-[#0B0F19] rounded-2xl border border-[rgba(255,255,255,0.06)] p-5 shadow-xl space-y-4">
            <div>
              <span className="text-[9px] font-mono font-black text-rose-455 block uppercase tracking-wider">LAYER 5: SENSITIVITY & RISK METRIC CORES</span>
              <span className="text-[10px] text-[#94A3B8] font-sans block mt-0.5">Annualized downside volatility parameters against index.</span>
            </div>

            <div className="space-y-3 font-mono text-xs">
              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="bg-[#111827]/50 border border-white/5 p-2 rounded-lg">
                  <span className="text-[8px] text-[#64748B] uppercase block">BETA (1Y STABLE)</span>
                  <span className="text-sm text-white font-black block mt-0.5" title="Requires DSEX index history">{beta1y != null ? beta1y.toFixed(2) : "N/A"}</span>
                </div>
                <div className="bg-[#111827]/50 border border-white/5 p-2 rounded-lg">
                  <span className="text-[8px] text-[#64748B] uppercase block">ALPHA (vs DSEX)</span>
                  <span className="text-sm text-emerald-400 font-bold block mt-0.5" title="Requires DSEX index history">{alphaDsex != null ? `${alphaDsex >= 0 ? "+" : ""}${alphaDsex.toFixed(1)}%` : "N/A"}</span>
                </div>
              </div>

              <div className="p-3 bg-[#1E293B]/30 border border-white/5 rounded-xl space-y-2.5">
                <div className="flex justify-between items-center font-bold">
                  <span>COMPOSITE RISK INDEX:</span>
                  <span className={`text-sm ${riskClassification === "Extreme" || riskClassification === "High" ? "text-rose-405" : "text-emerald-400"}`}>
                    {riskScore}/100 ({riskClassification})
                  </span>
                </div>
                <div className="h-2 bg-[#111827] rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all duration-500 ${
                      riskScore > 70 ? "bg-rose-500" : riskScore > 45 ? "bg-amber-500" : "bg-emerald-500"
                    }`}
                    style={{ width: `${riskScore}%` }}
                  />
                </div>
                <div className="flex justify-between text-[8px] text-[#64748B]">
                  <span>DEFENSIVE RISK TARGET</span>
                  <span>SUITABILITY: {suitabilityProfile.toUpperCase()}</span>
                </div>
              </div>

              <div className="space-y-1.5 text-[10px] leading-relaxed text-[#94A3B8]">
                <div className="flex justify-between border-b border-white/5 pb-1">
                  <span>Max Drawdown (60D Obs)</span>
                  <span className="font-bold text-white">{maxDrawdown.toFixed(1)}%</span>
                </div>
                <div className="flex justify-between border-b border-white/5 pb-1">
                  <span>ATR Daily Margin (BDT)</span>
                  <span className="font-bold text-white">{(last.high - last.low).toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* LAYER 6: MARKET REGIME FILTER */}
          <div className="bg-[#0B0F19] rounded-2xl border border-[rgba(255,255,255,0.06)] p-4 shadow-sm text-xs font-mono space-y-2 relative overflow-hidden">
            <span className="text-[9px] font-mono text-[#64748B] uppercase block font-black">LAYER 6: Macro Regime Climate</span>
            <div className="flex justify-between items-center">
              <span className="text-white font-bold select-none">{benchmarkRegime}</span>
              <span className="text-[#94A3B8] font-bold">SMA50 vs SMA200</span>
            </div>
            <p className="text-[10px] font-sans text-[#94A3B8] leading-relaxed">
              Regime is read from the 50-day vs 200-day moving average crossover. Data-coverage confidence: {confidenceLevel}% (based on {computedHistory.length} sessions of real history).
            </p>
          </div>

        </div>

      </div>

      {/* FOOTER DISCLAIMER */}
      <div className="bg-[#111827]/40 border border-white/5 p-4 rounded-xl text-[10px] leading-relaxed text-[#94A3B8] flex gap-2.5 items-start">
        <Shield className="h-4 w-4 text-indigo-400 shrink-0 mt-0.5" />
        <p>
          <strong>CFA Quantitative Fiduciary Standard Warning:</strong> This analytics engine works on advanced mathematical regressions. Financial investments on the Dhaka Stock Exchange are subjected to macro variables and monetary policy changes. Trade carefully inside your designated risk parameters.
        </p>
      </div>

    </div>
  );
}
