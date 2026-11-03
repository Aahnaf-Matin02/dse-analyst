import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid,
  AreaChart,
  Area,
  ReferenceLine
} from "recharts";
import { 
  Globe, 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  Scale, 
  ShieldCheck, 
  Percent, 
  TrendingUpIcon, 
  Volume2, 
  Zap, 
  Layers, 
  Compass, 
  Sparkles,
  Info,
  Calendar,
  AlertTriangle,
  RefreshCw
} from "lucide-react";

export interface MarketIntelligenceCenterProps {
  onSyncSuccess?: () => void;
}

interface IndexDetail {
  symbol: string;
  currentValue: number;
  change: number;
  changePercent: number;
  momentum7d: number;
  momentum30d: number;
  momentum90d: number;
  volatility30d: number;
  trend: "Bullish" | "Bearish" | "Neutral";
  description: string;
}

interface BreadthInfo {
  advancing: number;
  declining: number;
  unchanged: number;
  total: number;
  ratio: number;
  message: string;
}

interface SectorInfo {
  sector: string;
  dailyReturn: number;
  weeklyReturn: number;
  monthlyReturn: number;
  volatility: number;
  relativeStrength: number;
  advancing: number;
  declining: number;
  unchanged: number;
  leadingStock: string;
  draggingStock: string;
}

interface SentimentInfo {
  score: number;
  classification: "Bullish" | "Neutral" | "Bearish";
  components: {
    momentumScore: number;
    breadthScore: number;
    volumeScore: number;
    volatilityScore: number;
  };
}

interface MarketSummary {
  timestamp: string;
  indices: {
    DSEX: IndexDetail;
    DSES: IndexDetail;
    DS30: IndexDetail;
  };
  breadth: BreadthInfo;
  sectors: {
    sectors: SectorInfo[];
    topPerforming: string;
    weakest: string;
  };
  sentiment: SentimentInfo;
}

interface PredictionData {
  timestamp: string;
  index_name: string;
  prediction_target_date: string;
  predicted_value: number;
  confidence_score: number;
  model_name: string;
  indicators: string[];
}

interface IntradayTick {
  timestamp: string;
  index_name: string;
  index_value: number;
  change_value: number;
  change_percent: number;
  trading_date: string;
}

export default function MarketIntelligenceCenter({ onSyncSuccess }: MarketIntelligenceCenterProps) {
  const [summary, setSummary] = useState<MarketSummary | null>(null);
  const [predictions, setPredictions] = useState<Record<string, PredictionData[]> | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<"DSEX" | "DSES" | "DS30">("DSEX");
  const [chartData, setChartData] = useState<IntradayTick[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState<number>(0);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // 1. Fetch Market Summary & Predictions
  useEffect(() => {
    async function loadData() {
      if (refreshKey === 0) setLoading(true);
      try {
        const [sumRes, predRes] = await Promise.all([
          fetch("/api/market/intelligence/summary"),
          fetch("/api/market/intelligence/predictions")
        ]);

        if (!sumRes.ok || !predRes.ok) throw new Error("Server returned non-ok metrics.");
        
        const sumVal = await sumRes.json();
        const predVal = await predRes.json();

        setSummary(sumVal);
        setPredictions(predVal);
        setError(null);
      } catch (err: any) {
        console.error("[MarketIntelligenceCenter] Error loading summary stream:", err);
        setError("Failed to query full DSE Market Intelligence databases.");
      } finally {
        setLoading(false);
        setIsRefreshing(false);
      }
    }
    loadData();
  }, [refreshKey]);

  // 2. Fetch Intraday series for Selected Index
  useEffect(() => {
    async function loadChart() {
      try {
        const chartRes = await fetch(`/api/market/indices/${selectedIndex}/intraday`);
        if (chartRes.ok) {
          const arr = await chartRes.json();
          // Transform for Recharts
          setChartData(arr);
        }
      } catch (err) {
        console.error("[Intraday chart fetch failed]", err);
      }
    }
    loadChart();
  }, [selectedIndex, refreshKey]);

  // 3. Trigger active manual sync
  const handleManualSync = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      const fetchRes = await fetch("/api/dse/sync", { method: "POST" });
      if (fetchRes.ok) {
        if (onSyncSuccess) onSyncSuccess();
      }
    } catch (e) {
      // Ignored
    }
    setRefreshKey(prev => prev + 1);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-20 bg-[#0B0F19] rounded-3xl border border-[rgba(255,255,255,0.04)]" id="intelligence-loader">
        <Activity className="h-10 w-10 text-amber-400 animate-spin mb-4" />
        <span className="text-slate-400 font-mono text-xs">Querying Real-Time Feed & Historical Index Tables...</span>
      </div>
    );
  }

  if (error || !summary) {
    return (
      <div className="p-8 bg-[#0B0F19] rounded-3xl border border-rose-500/20 text-center text-slate-300" id="intelligence-error">
        <AlertTriangle className="h-12 w-12 text-rose-500 mx-auto mb-4" />
        <h3 className="text-lg font-bold font-sans">Database Read Error</h3>
        <p className="text-sm font-mono text-slate-400 mt-2">{error || "Data load failed."}</p>
        <button 
          onClick={() => setRefreshKey(prev => prev + 1)}
          className="mt-6 px-5 py-2 bg-slate-800 hover:bg-slate-700 transition font-sans text-xs rounded-xl"
        >
          Retry Database Connection
        </button>
      </div>
    );
  }

  const { indices, breadth, sectors, sentiment } = summary;
  const currentIdx = indices[selectedIndex];

  // Sentiment background and indicator calculations
  let sentimentColor = "text-amber-400";
  let sentimentBg = "bg-amber-400/5";
  let sentimentBorder = "border-[rgba(245,158,11,0.2)]";

  if (sentiment.classification === "Bullish") {
    sentimentColor = "text-emerald-400 animate-pulse";
    sentimentBg = "bg-emerald-400/5";
    sentimentBorder = "border-emerald-500/25";
  } else if (sentiment.classification === "Bearish") {
    sentimentColor = "text-rose-400";
    sentimentBg = "bg-rose-400/5";
    sentimentBorder = "border-rose-500/25";
  }

  // Format timestamp nicely
  const formatDateString = (isoString?: string) => {
    if (!isoString) return "N/A";
    const date = new Date(isoString);
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true
    });
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="space-y-6 sm:space-y-8"
      id="market-intelligence-center"
    >
      
      {/* ── HEADER BLOCK ────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-5 sm:p-6 rounded-3xl bg-slate-900/40 border border-[rgba(255,255,255,0.04)]" id="intelligence-header">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-1 px-2.5 rounded-full bg-amber-400/10 text-amber-400 text-[10px] font-mono font-black uppercase tracking-wider mb-1">
              Active Neural Analytics Engine
            </div>
          </div>
          <h2 className="text-2xl font-black font-sans text-white tracking-tight">Market Intelligence Center</h2>
          <p className="text-xs text-slate-400 mt-1">
            Analyzing 3-year deep indices, continuous intraday snapshots, and 13 sectors of the Dhaka Stock Exchange.
          </p>
        </div>
        <div className="flex items-center gap-3 self-start sm:self-center">
          <div className="text-right">
            <span className="text-[9px] text-[#4B5563] font-mono block uppercase">FEED SYNCHRONIZATION TIME</span>
            <span className="text-xs font-mono font-bold text-slate-300">
              {formatDateString(summary.timestamp)}
            </span>
          </div>
          <button 
            onClick={handleManualSync}
            disabled={isRefreshing}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 border border-[rgba(255,255,255,0.06)] active:scale-95 transition cursor-pointer"
            title="Scan live dse.com.bd homepage"
          >
            <RefreshCw className={`h-4.5 w-4.5 ${isRefreshing ? "animate-spin text-amber-400" : ""}`} />
          </button>
        </div>
      </div>

      {/* ── INDEX COLD CARDS (DSEX, DSES, DS30) ────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5" id="indices-metrics-cards">
        {(["DSEX", "DSES", "DS30"] as const).map(key => {
          const isSelected = selectedIndex === key;
          const idx = indices[key];
          const isUp = idx.change >= 0;

          return (
            <button
              key={key}
              onClick={() => setSelectedIndex(key)}
              className={`p-5 rounded-3xl border text-left transition-all duration-300 flex flex-col justify-between cursor-pointer relative min-h-[160px] overflow-hidden group ${
                isSelected 
                  ? "bg-[#18233C] border-amber-500/30 shadow-[0_0_25px_rgba(245,158,11,0.06)]" 
                  : "bg-slate-900/60 hover:bg-[#111A2E] border-[rgba(255,255,255,0.04)] hover:border-slate-800"
              }`}
            >
              {isSelected && (
                <div className="absolute right-0 top-0 h-16 w-16 bg-amber-500/5 rounded-bl-full pointer-events-none" />
              )}
              
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-mono font-black text-[#94A3B8]/60 tracking-wider">
                    {key === "DSEX" ? "BROAD MARKET INDEX" : key === "DSES" ? "SHARIAH COMPLIANT" : "BLUE-CHIP INDEX"}
                  </span>
                  <span className={`p-1 px-2 rounded-lg text-[9px] font-mono font-bold ${
                    idx.trend === "Bullish" ? "bg-emerald-500/10 text-emerald-400" : idx.trend === "Bearish" ? "bg-rose-500/10 text-rose-400" : "bg-slate-800 text-slate-400"
                  }`}>
                    {idx.trend}
                  </span>
                </div>
                <h3 className="text-lg font-black font-sans text-white group-hover:text-amber-400 duration-200">{idx.symbol}</h3>
              </div>

              <div className="my-3">
                <div className="text-2xl font-black font-mono text-white tracking-tight">
                  {idx.currentValue.toLocaleString(undefined, { minimumFractionDigits: 5, maximumFractionDigits: 5 })}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <div className={`flex items-center gap-0.5 text-xs font-bold font-mono ${isUp ? "text-emerald-400" : "text-rose-400"}`}>
                    {isUp ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                    <span>{isUp ? "+" : ""}{idx.change.toLocaleString(undefined, { minimumFractionDigits: 5, maximumFractionDigits: 5 })}</span>
                  </div>
                  <div className={`text-xs font-mono font-bold py-0.5 px-1.5 rounded ${isUp ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"}`}>
                    {isUp ? "+" : ""}{idx.changePercent.toFixed(5)}%
                  </div>
                </div>
              </div>

              {/* Momentum overview inside card */}
              <div className="pt-2.5 border-t border-[rgba(255,255,255,0.04)] grid grid-cols-3 gap-2 text-center text-[10px] font-mono text-slate-400">
                <div>
                  <span className="block text-[8px] text-slate-500">7D MOM</span>
                  <span className={idx.momentum7d >= 0 ? "text-emerald-400 font-bold" : "text-rose-400 font-bold"}>
                    {idx.momentum7d >= 0 ? "+" : ""}{idx.momentum7d}%
                  </span>
                </div>
                <div>
                  <span className="block text-[8px] text-slate-500">30D MOM</span>
                  <span className={idx.momentum30d >= 0 ? "text-emerald-400 font-bold" : "text-rose-400 font-bold"}>
                    {idx.momentum30d >= 0 ? "+" : ""}{idx.momentum30d}%
                  </span>
                </div>
                <div>
                  <span className="block text-[8px] text-slate-500">VOLATILITY</span>
                  <span className="text-orange-400 font-bold">
                    {idx.volatility30d}%
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* ── GRID: INTRADAY CHART & SENTIMENT BOX ───────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6" id="chart-and-sentiment-grid">
        
        {/* Intraday chart */}
        <div className="lg:col-span-8 p-5 sm:p-6 rounded-3xl bg-[#0B0F19] border border-[rgba(255,255,255,0.04)]" id="intraday-chart-box">
          <div className="flex items-center justify-between mb-6">
            <div>
              <span className="text-[10px] text-[#4B5563] font-mono block uppercase">PRECISE SNAPSHOT TIMELINE</span>
              <h3 className="text-lg font-black font-sans text-white">Intraday Index Charts ({selectedIndex})</h3>
            </div>
            <div className="flex gap-1 bg-slate-900 p-1.5 rounded-xl border border-[rgba(255,255,255,0.02)]">
              {(["DSEX", "DSES", "DS30"] as const).map(key => (
                <button
                  key={key}
                  onClick={() => setSelectedIndex(key)}
                  className={`px-3 py-1 text-[10px] font-mono font-bold rounded-lg cursor-pointer ${
                    selectedIndex === key 
                      ? "bg-amber-500 text-slate-950 shadow-md" 
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  {key}
                </button>
              ))}
            </div>
          </div>

          <div className="h-[280px] w-full" id="intraday-visual-chart">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={currentIdx.change >= 0 ? "#10B981" : "#EF4444"} stopOpacity={0.2}/>
                      <stop offset="95%" stopColor={currentIdx.change >= 0 ? "#10B981" : "#EF4444"} stopOpacity={0.0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.03} vertical={false} />
                  <XAxis 
                    dataKey="timestamp" 
                    tickFormatter={(val) => {
                      try {
                        const parts = val.split("T");
                        if (parts.length > 1) {
                          const timeStr = parts[1].substring(0, 5); // get HH:MM
                          return timeStr;
                        }
                      } catch (e) {}
                      return val;
                    }}
                    stroke="#4B5563"
                    fontSize={9}
                    fontFamily="monospace"
                  />
                  <YAxis 
                    domain={["auto", "auto"]} 
                    stroke="#4B5563"
                    fontSize={10}
                    fontFamily="monospace"
                    tickFormatter={(val) => val.toFixed(1)}
                  />
                  <Tooltip 
                    contentStyle={{ backgroundColor: "#111827", borderColor: "rgba(255,255,255,0.08)", borderRadius: "16px" }}
                    labelStyle={{ color: "#94A3B8", fontFamily: "sans-serif", fontSize: "11px", fontWeight: "bold" }}
                    itemStyle={{ color: "#F3F4F6", fontFamily: "monospace", fontSize: "12px" }}
                    formatter={(value: any) => [`${parseFloat(value).toFixed(2)} pts`, "Value"]}
                    labelFormatter={(label: any) => `Time: ${formatDateString(label)}`}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="index_value" 
                    stroke={currentIdx.change >= 0 ? "#10B981" : "#EF4444"} 
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorValue)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-slate-500 font-mono text-xs">
                Pending intraday ticked feeds connection...
              </div>
            )}
          </div>

          <div className="mt-4 p-4 rounded-2xl bg-slate-900/60 border border-[rgba(255,255,255,0.02)] flex items-start gap-3 text-xs text-slate-300">
            <Info className="h-4.5 w-4.5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-slate-250 block">Market Trend Classification</span>
              <p className="text-slate-400 mt-1">{currentIdx.description}</p>
            </div>
          </div>
        </div>

        {/* Sentiment Engine & Breadth Gauge */}
        <div className="lg:col-span-4 flex flex-col gap-6" id="sentiment-and-breadth-box">
          <div className={`p-5 sm:p-6 rounded-3xl border flex-1 flex flex-col justify-between ${sentimentBg} ${sentimentBorder}`}>
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <span className="text-[10px] text-[#4B5563] font-mono block uppercase">FOUR-FACTOR SYNTHESIZER</span>
                  <h3 className="text-base font-black font-sans text-white">Market Sentiment Engine</h3>
                </div>
                <Zap className={`h-5 w-5 ${sentimentColor}`} />
              </div>

              {/* Large Score Indicator */}
              <div className="text-center my-6 relative py-4">
                <div className="inline-block relative">
                  <div className={`text-5xl font-black font-mono tracking-tight ${sentimentColor}`}>
                    {sentiment.score}
                  </div>
                  <div className="text-[11px] font-mono font-bold text-slate-400 mt-1 uppercase">
                    COMPOSE SENTIMENT SCORE (0-100)
                  </div>
                </div>
                
                {/* Radial visual arc approximation */}
                <div className="w-full bg-slate-800/40 h-2.5 rounded-full overflow-hidden mt-4">
                  <div 
                    className={`h-full rounded-full ${
                      sentiment.classification === "Bullish" ? "bg-emerald-400" : sentiment.classification === "Bearish" ? "bg-rose-400" : "bg-amber-400"
                    }`}
                    style={{ width: `${sentiment.score}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Sentiment Breakdown */}
            <div className="space-y-3 pt-4 border-t border-[rgba(255,255,255,0.06)]">
              <div className="flex justify-between items-center text-xs font-mono text-slate-400">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-cyan-400" />
                  <span>Index Momentum (40%)</span>
                </div>
                <span className="font-bold text-[#F3F4F6]">{sentiment.components.momentumScore}%</span>
              </div>
              <div className="flex justify-between items-center text-xs font-mono text-slate-400">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-purple-400" />
                  <span>Market Breadth (30%)</span>
                </div>
                <span className="font-bold text-[#F3F4F6]">{sentiment.components.breadthScore}%</span>
              </div>
              <div className="flex justify-between items-center text-xs font-mono text-slate-400">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span>Volume Trend (20%)</span>
                </div>
                <span className="font-bold text-[#F3F4F6]">{sentiment.components.volumeScore}%</span>
              </div>
              <div className="flex justify-between items-center text-xs font-mono text-slate-400">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-pink-400" />
                  <span>Volatility Shield (10%)</span>
                </div>
                <span className="font-bold text-[#F3F4F6]">{sentiment.components.volatilityScore}%</span>
              </div>
            </div>

            <div className="mt-4 p-3 rounded-2xl bg-white/[0.02] text-center border border-[rgba(255,255,255,0.04)]">
              <span className="text-[10px] text-slate-500 font-mono block">CLASSIFICATION</span>
              <span className={`text-sm font-black font-sans tracking-wide uppercase ${sentimentColor}`}>
                {sentiment.classification === "Bullish" ? "● STRONG BULLISH" : sentiment.classification === "Bearish" ? "● BEARISH CONSOLIDATION" : "● SIDEWAYS NEUTRAL"}
              </span>
            </div>
          </div>

          {/* Market Breadth Gauge */}
          <div className="p-5 sm:p-6 rounded-3xl bg-slate-900/60 border border-[rgba(255,255,255,0.04)]" id="breadth-gauge-box">
            <div className="flex items-center justify-between mb-4">
              <div>
                <span className="text-[10px] text-[#4B5563] font-mono block uppercase">CONSTITUENT MOVEMENT RANGE</span>
                <h3 className="text-base font-black font-sans text-white">Market Breadth Gauge</h3>
              </div>
              <Scale className="h-5 w-5 text-[#94A3B8]" />
            </div>

            {/* Breadth ratio bar */}
            <div className="flex h-6 rounded-xl overflow-hidden my-4 relative shadow-inner">
              <div 
                className="bg-emerald-500 h-full flex items-center justify-center text-[10px] font-bold text-slate-950"
                style={{ width: `${(breadth.advancing / breadth.total) * 100}%` }}
                title={`${breadth.advancing} Advancing`}
              >
                {breadth.advancing}
              </div>
              <div 
                className="bg-slate-700 h-full flex items-center justify-center text-[10px] font-bold text-slate-300"
                style={{ width: `${(breadth.unchanged / breadth.total) * 100}%` }}
                title={`${breadth.unchanged} Unchanged`}
              >
                {breadth.unchanged}
              </div>
              <div 
                className="bg-rose-500 h-full flex items-center justify-center text-[10px] font-bold text-slate-950"
                style={{ width: `${(breadth.declining / breadth.total) * 100}%` }}
                title={`${breadth.declining} Declining`}
              >
                {breadth.declining}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center my-4">
              <div className="p-2 py-1 bg-emerald-500/5 text-emerald-400 rounded-xl border border-emerald-500/10">
                <span className="block text-[8px] text-slate-500">ADVANCING</span>
                <span className="text-xs font-mono font-bold">{breadth.advancing}</span>
              </div>
              <div className="p-2 py-1 bg-slate-800/10 text-slate-400 rounded-xl border border-slate-700/10">
                <span className="block text-[8px] text-slate-500">UNCHANGED</span>
                <span className="text-xs font-mono font-bold">{breadth.unchanged}</span>
              </div>
              <div className="p-2 py-1 bg-rose-500/5 text-rose-400 rounded-xl border border-rose-500/10">
                <span className="block text-[8px] text-slate-500">DECLINING</span>
                <span className="text-xs font-mono font-bold">{breadth.declining}</span>
              </div>
            </div>

            <div className="p-3 bg-slate-950/40 rounded-2xl border border-[rgba(255,255,255,0.02)] flex items-center justify-between font-mono text-xs text-slate-400">
              <span>Breadth Ratio (Adv/Dec)</span>
              <span className="font-extrabold text-amber-400 text-sm">
                {breadth.ratio.toFixed(3)}
              </span>
            </div>
            <p className="text-[10px] text-slate-500 font-mono mt-2 text-center italic">{breadth.message}</p>
          </div>
        </div>
      </div>

      {/* ── SECTOR INTELLIGENCE MODULE (HEATMAP + TABLE) ────────────────── */}
      <div className="p-5 sm:p-6 rounded-3xl bg-[#0B0F19] border border-[rgba(255,255,255,0.04)]" id="sector-intelligence-box">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-1.5">
              <Layers className="h-4.5 w-4.5 text-amber-400" />
              <span className="text-[10px] text-[#4B5563] font-mono block uppercase">SECTOR BENCHMARK AND STRENGTH COMPARATOR</span>
            </div>
            <h3 className="text-lg font-black font-sans text-white">Sector Intelligence Module</h3>
          </div>
          <div className="flex items-center gap-4 text-xs font-mono text-slate-400">
            <div>
              Top: <span className="font-bold text-emerald-400">{sectors.topPerforming}</span>
            </div>
            <div>
              Laggard: <span className="font-bold text-rose-400">{sectors.weakest}</span>
            </div>
          </div>
        </div>

        {/* Heatmap Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-6" id="sector-heatmap">
          {sectors.sectors.map((sec, i) => {
            const isUp = sec.dailyReturn >= 0;
            const rScore = Math.abs(sec.dailyReturn);
            // Dynamic hotness color calculation
            let colorClass = "bg-slate-900 border-[rgba(255,255,255,0.02)] text-slate-400";
            if (isUp) {
              if (rScore > 1.0) colorClass = "bg-emerald-950/45 border-emerald-500/20 text-emerald-300";
              else colorClass = "bg-emerald-950/20 border-emerald-500/10 text-emerald-450";
            } else {
              if (rScore > 1.0) colorClass = "bg-rose-950/45 border-rose-500/20 text-rose-200";
              else colorClass = "bg-rose-950/20 border-rose-500/10 text-rose-400";
            }

            return (
              <div 
                key={sec.sector}
                className={`p-3.5 rounded-2xl border flex flex-col justify-between min-h-[96px] relative overflow-hidden group hover:scale-[1.02] duration-200 ${colorClass}`}
              >
                <div className="text-[10px] font-sans font-black tracking-tight truncate uppercase text-[#94A3B8]">
                  {sec.sector}
                </div>
                <div className="mt-3">
                  <span className="text-lg font-black font-mono tracking-tight text-white block">
                    {isUp ? "+" : ""}{sec.dailyReturn.toFixed(2)}%
                  </span>
                  <span className="text-[8px] font-mono text-[#94A3B8]/60 block uppercase mt-0.5">
                    Monthly: {sec.monthlyReturn >= 0 ? "+" : ""}{sec.monthlyReturn.toFixed(1)}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Detailed Sector rankings table */}
        <div className="overflow-x-auto rounded-2xl border border-[rgba(255,255,255,0.04)] bg-slate-950/30" id="sector-rankings-table">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-900 text-slate-400 font-mono font-bold uppercase tracking-wider text-[8px] border-b border-[rgba(255,255,255,0.04)]">
                <th className="p-3">Sector Name</th>
                <th className="p-3 text-right">Daily Return</th>
                <th className="p-3 text-right">Weekly Return</th>
                <th className="p-3 text-right">Monthly Return</th>
                <th className="p-3 text-right">Volatility</th>
                <th className="p-3 text-right">Rel. Strength (DSEX)</th>
                <th className="p-3 text-center">Adv / Dec / Unch</th>
                <th className="p-3 text-right">Leading Asset</th>
                <th className="p-3 text-right">Dragging Asset</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgba(255,255,255,0.02)]">
              {sectors.sectors.map((sec) => (
                <tr key={sec.sector} className="hover:bg-slate-900/35 duration-150 text-slate-300 font-mono">
                  <td className="p-3 font-sans font-black text-slate-100">{sec.sector}</td>
                  <td className={`p-3 text-right font-black ${sec.dailyReturn >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                    {sec.dailyReturn >= 0 ? "+" : ""}{sec.dailyReturn.toFixed(2)}%
                  </td>
                  <td className={`p-3 text-right font-bold ${sec.weeklyReturn >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                    {sec.weeklyReturn >= 0 ? "+" : ""}{sec.weeklyReturn.toFixed(2)}%
                  </td>
                  <td className={`p-3 text-right ${sec.monthlyReturn >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                    {sec.monthlyReturn >= 0 ? "+" : ""}{sec.monthlyReturn.toFixed(2)}%
                  </td>
                  <td className="p-3 text-right text-orange-400">{sec.volatility.toFixed(2)}%</td>
                  <td className={`p-3 text-right font-bold ${sec.relativeStrength >= 0 ? "text-lime-400" : "text-yellow-500"}`}>
                    {sec.relativeStrength >= 0 ? "+" : ""}{sec.relativeStrength.toFixed(2)}%
                  </td>
                  <td className="p-3 text-center text-[11px]">
                    <span className="text-emerald-400">{sec.advancing}</span>
                    <span className="text-slate-600 mx-1">/</span>
                    <span className="text-rose-400">{sec.declining}</span>
                    <span className="text-slate-600 mx-1">/</span>
                    <span className="text-slate-400">{sec.unchanged}</span>
                  </td>
                  <td className="p-3 text-right text-emerald-400 font-bold font-sans">{sec.leadingStock}</td>
                  <td className="p-3 text-right text-rose-450 font-sans">{sec.draggingStock}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── EXTREME STATISTICAL PREDICTIONS DISPLAY ────────────────────── */}
      {predictions && (
        <div className="p-5 sm:p-6 rounded-3xl bg-[#090D16] border border-[rgba(255,255,255,0.04)]" id="predictions-panel font-sans">
          <div className="flex items-center gap-1.5 mb-6">
            <Sparkles className="h-4.5 w-4.5 text-fuchsia-400" />
            <span className="text-[10px] text-[#4B5563] font-mono block uppercase">Deep LSTM & Arima Machine Forecasters</span>
          </div>
          <h3 className="text-lg font-black text-white font-sans uppercase mb-1">Index Predictive Intelligence</h3>
          <p className="text-xs text-slate-400 mb-6">Evaluating next-day directional outcomes using neural recursive weight models.</p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {(["DSEX", "DSES", "DS30"] as const).map(sym => {
              const predList = predictions[sym];
              if (!predList || predList.length === 0) return null;
              const p = predList[0]; // grab top projection
              const curValue = indices[sym].currentValue;
              const pathDifference = p.predicted_value - curValue;
              const pathPct = (pathDifference / curValue) * 100;
              const isBullish = pathDifference >= 0;

              return (
                <div 
                  key={sym}
                  className="p-5 rounded-2xl bg-slate-900/40 border border-[rgba(255,255,255,0.03)] flex flex-col justify-between"
                >
                  <div className="flex items-center justify-between border-b border-[rgba(255,255,255,0.04)] pb-2 mb-3">
                    <span className="text-sm font-black text-white">{sym} Model Forecast</span>
                    <span className="text-[9px] font-mono p-1 px-1.5 rounded bg-slate-800 text-slate-400">
                      Target: {p.prediction_target_date}
                    </span>
                  </div>

                  <div>
                    <span className="text-[9px] text-[#4B5563] font-mono block uppercase">PREDICTED EOD VALUE</span>
                    <div className="text-xl font-mono font-extrabold text-white">
                      {p.predicted_value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <div className={`text-xs font-mono font-bold mt-1 inline-flex items-center gap-0.5 ${isBullish ? "text-emerald-400" : "text-rose-400"}`}>
                      {isBullish ? "▲" : "▼"} {isBullish ? "+" : ""}{pathDifference.toFixed(2)} pts ({isBullish ? "+" : ""}{pathPct.toFixed(2)}%)
                    </div>
                  </div>

                  {/* Indicators factored */}
                  <div className="my-3 space-y-1.5">
                    <span className="text-[8px] text-slate-500 font-mono block uppercase">AI Model Factored Indicators</span>
                    {p.indicators.map((ind, d) => (
                      <div key={d} className="flex items-center gap-1.5 text-[10px] text-slate-400 font-mono">
                        <div className="w-1 h-1 rounded-full bg-fuchsia-400" />
                        <span className="truncate">{ind}</span>
                      </div>
                    ))}
                  </div>

                  <div className="pt-2.5 border-t border-[rgba(255,255,255,0.04)] flex items-center justify-between text-[10px] font-mono text-slate-500">
                    <span>Engine: {p.model_name}</span>
                    <span className="text-fuchsia-400 font-bold">Conf: {p.confidence_score}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      
    </motion.div>
  );
}
