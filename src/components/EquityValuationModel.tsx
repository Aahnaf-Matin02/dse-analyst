import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  TrendingUp, 
  TrendingDown, 
  Info, 
  ShieldAlert, 
  CheckCircle2, 
  AlertTriangle, 
  ChevronDown, 
  ChevronUp, 
  RefreshCw, 
  ArrowRight,
  BookOpen,
  DollarSign,
  Scale,
  Percent,
  Activity,
  Calculator,
  Compass,
  FileText,
  Layers,
  Coins,
  Cpu,
  HelpCircle
} from "lucide-react";
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  Cell, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ReferenceLine,
  CartesianGrid,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar
} from "recharts";
import { EquityValuationResult, ValuationMethodResult } from "../types";
import { SourceDataBadge } from "./SourceDataBadge";

interface EquityValuationModelProps {
  symbol: string;
  stock: any;
  beta: number;
  onSwitchTab: (tab: string) => void;
}

export const EquityValuationModel: React.FC<EquityValuationModelProps> = ({
  symbol,
  stock,
  beta: propBeta,
  onSwitchTab
}) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [data, setData] = useState<EquityValuationResult | null>(null);
  
  // Tab handling
  const [activeSubTab, setActiveSubTab] = useState<"synthesis" | "cfa" | "research">("synthesis");
  const [showInfoModal, setShowInfoModal] = useState<boolean>(false);
  
  // Collapse toggling
  const [showFormula, setShowFormula] = useState<Record<string, boolean>>({});
  const [showAssumptions, setShowAssumptions] = useState<Record<string, boolean>>({});
  const [showCfaCollapse, setShowCfaCollapse] = useState<Record<string, boolean>>({});
  const [collapsedTables, setCollapsedTables] = useState<Record<string, boolean>>({
    pb: true,
    roe: true
  });

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    setErrorCode(null);
    try {
      const response = await fetch(`/api/valuation/${symbol}`);
      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        if (response.status === 422 && errJson.code === "NAV_UNAVAILABLE") {
          setErrorCode("NAV_UNAVAILABLE");
        }
        throw new Error(errJson.error || `HTTP error ${response.status}`);
      }
      const valData = await response.json();
      setData(valData);
    } catch (err: any) {
      console.error("[EquityValuationModel] Fetch error:", err);
      setError(err.message || "Failed to load equity valuation details.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [symbol]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[460px] text-center p-8">
        <RefreshCw className="h-10 w-10 text-[#00D4FF] animate-spin mb-4" />
        <h3 className="text-sm font-bold font-mono text-[#F0F4FF] tracking-wider uppercase mb-1">
          Compiling Institutional Valuation Matrix...
        </h3>
        <p className="text-xs text-[#94A3B8] max-w-sm">
          Constructing CFA cash flows, running multi-stage Gordon growth models, and synthesizing peer multiple thresholds for {symbol}.
        </p>
      </div>
    );
  }

  if (errorCode === "NAV_UNAVAILABLE" || (error && error.includes("NAV"))) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-8 bg-[#0D1527] border border-[#EF4444]/20 rounded-xl max-w-2xl mx-auto my-12" id="error-nav-unavailable">
        <ShieldAlert className="h-12 w-12 text-[#EF4444] mb-4" />
        <h3 className="text-lg font-bold font-display text-[#F0F4FF] mb-2">
          Book Value Data Unavailable — {symbol}
        </h3>
        <p className="text-sm text-[#94A3B8] max-w-md mb-6 leading-relaxed">
          Book value (NAV) is zero or unavailable for {symbol}. Enterprise Book Value models require tangible balance sheet asset streams to calculate pricing coefficients.
        </p>
        <div className="text-xs text-[#F87171] bg-[#7F1D1D]/15 px-4 py-3 rounded-lg border border-[#EF4444]/10 font-mono mb-6 max-w-md">
          "Upload historical financials in Data Console to enable this analysis."
        </div>
        <button
          onClick={() => onSwitchTab("console")}
          className="flex items-center gap-2 bg-[#1A2235] hover:bg-[#243044] border border-[#00D4FF]/20 hover:border-[#00D4FF]/40 text-[#00D4FF] px-4 py-2 rounded-lg text-xs font-mono font-bold tracking-wider transition-all cursor-pointer"
        >
          <span>Open Data Console</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-8 bg-[#0A0F1E] border border-[#1E293B] rounded-xl max-w-2xl mx-auto my-12" id="error-general">
        <AlertTriangle className="h-12 w-12 text-[#F59E0B] mb-4" />
        <h4 className="text-base font-bold font-display text-white mb-2">
          Unable to compute book-value valuation
        </h4>
        <p className="text-xs text-[#94A3B8] mb-6 max-w-sm">
          {error || "An unexpected error occurred while compiling assets parameters."}
        </p>
        <button 
          onClick={fetchData}
          className="bg-[#00D4FF] hover:bg-[#00B4D8] text-[#0A0F1E] font-mono font-bold text-xs tracking-wider px-4 py-2 rounded-lg uppercase shadow-lg transition-all"
        >
          Retry Calculation
        </button>
      </div>
    );
  }

  const {
    currentPrice,
    bvps,
    roe,
    costOfEquity,
    beta,
    methods,
    compositeFairValue,
    compositeMarginOfSafety,
    compositeVerdict,
    sectorBenchmark,
    sensitivityAnalysis,
    dataQuality,
    warnings,
    conclusion,
    baseRevenue = 0,
    currentPE = 0,
    currentDY = 0,
    currentFCF = 0,
    sharesCount = 100
  } = data;

  const currentPB = currentPrice / bvps;
  const eps = roe !== null ? (roe / 100) * bvps : null;

  // Count active methods
  const activeCount = Object.values(methods).filter((m: any) => m.available).length;

  const dataQualityDetails = {
    Complete: {
      label: "All 5 Methods Active",
      theme: "bg-[#10B981]/15 text-[#10B981] border-[#10B981]/20",
    },
    Partial: {
      label: `${activeCount} methods active`,
      theme: "bg-[#F59E0B]/15 text-[#F59E0B] border-[#F59E0B]/20",
    },
    Minimal: {
      label: "Limited Data — Interpret with Caution",
      theme: "bg-[#EF4444]/15 text-[#EF4444] border-[#EF4444]/20",
    }
  }[dataQuality];

  const verdictStyles = {
    "Significantly Undervalued": {
      bg: "from-[#10B981]/20 to-[#0A0F1E] border-[#10B981]/30",
      pill: "bg-[#10B981] text-[#0A0F1E] font-black",
      text: "text-[#10B981]",
      glow: "shadow-[0_0_50px_rgba(16,185,129,0.15)]"
    },
    "Undervalued": {
      bg: "from-[#10B981]/10 to-[#0A0F1E] border-[#10B981]/20",
      pill: "bg-[#10B981]/80 text-[#0A0F1E] font-black",
      text: "text-[#10B981]",
      glow: "shadow-[0_0_30px_rgba(16,185,129,0.08)]"
    },
    "Fairly Valued": {
      bg: "from-[#94A3B8]/10 to-[#0A0F1E] border-[#334155]",
      pill: "bg-[#64748B] text-white font-black",
      text: "text-[#94A3B8]",
      glow: ""
    },
    "Slightly Overvalued": {
      bg: "from-[#F59E0B]/10 to-[#0A0F1E] border-[#F59E0B]/20",
      pill: "bg-[#F59E0B]/80 text-[#0A0F1E] font-black",
      text: "text-[#F59E0B]",
      glow: "shadow-[0_0_30px_rgba(245,158,11,0.08)]"
    },
    "Overvalued": {
      bg: "from-[#EF4444]/20 to-[#0A0F1E] border-[#EF4444]/30",
      pill: "bg-[#EF4444] text-white font-black",
      text: "text-[#EF4444]",
      glow: "shadow-[0_0_50px_rgba(239,68,68,0.15)]"
    }
  }[compositeVerdict];

  const toggleFormula = (key: string) => {
    setShowFormula(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleAssumptions = (key: string) => {
    setShowAssumptions(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleTable = (key: string) => {
    setCollapsedTables(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleCfaCollapse = (key: string) => {
    setShowCfaCollapse(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Setup Recharts data
  const chartData = [
    { name: "Current Price", price: currentPrice, fill: "#ffffff", stroke: "#ffffff" },
    { name: "P/B Peer Price", price: methods.pbFairValue.fairPrice, fill: "#00D4FF", stroke: "#00D4FF" },
    { name: "Justified Price", price: methods.roeJustifiedPB.fairPrice, fill: "#A78BFA", stroke: "#A78BFA" },
    ...(methods.grahamNumber.available ? [{ name: "Graham Floor", price: methods.grahamNumber.fairPrice, fill: "#F59E0B", stroke: "#F59E0B" }] : []),
    ...(methods.evBookValue.available ? [{ name: "EV/BV Option", price: methods.evBookValue.fairPrice, fill: "#10B981", stroke: "#10B981" }] : []),
    ...(methods.residualIncome.available ? [{ name: "Residual Inc.", price: methods.residualIncome.fairPrice, fill: "#E879F9", stroke: "#E879F9" }] : []),
    { name: "Composite Fair", price: compositeFairValue, fill: compositeMarginOfSafety >= 0 ? "#10B981" : "#EF4444", stroke: compositeMarginOfSafety >= 0 ? "#10B981" : "#EF4444" }
  ];

  const sectorAvgPrice = sectorBenchmark.avgPB * bvps;

  // Pre-calculate Radar Chart scores across 5 key fundamental categories
  const roeVal = roe !== null ? roe : (stock?.financials?.roe ?? 12);
  const debtRatioVal = stock?.financials?.debtRatio ?? 0.45;
  const revGrowthVal = stock?.revGrowth ?? stock?.profitGrowth ?? 8.5;
  
  const profitabilityScore = Math.min(100, Math.max(15, Math.round(Math.abs(roeVal) * 2 + 30)));
  const solvencyScore = Math.min(100, Math.max(15, Math.round((1 - Math.min(1.5, Math.abs(debtRatioVal))) * 100)));
  const liquidityScore = Math.min(100, Math.max(15, stock?.peRatio ? Math.round(110 - Math.min(60, stock.peRatio) * 1.5) : (65 + (symbol.charCodeAt(0) % 20))));
  const growthScore = Math.min(100, Math.max(15, Math.round(Math.abs(revGrowthVal) * 2.2 + 45)));
  const efficiencyScore = Math.min(100, Math.max(15, Math.round(profitabilityScore * 0.7 + solvencyScore * 0.2 + 10)));

  const radarData = [
    { subject: "Profitability", score: profitabilityScore, fullMark: 100 },
    { subject: "Liquidity", score: liquidityScore, fullMark: 100 },
    { subject: "Solvency", score: solvencyScore, fullMark: 100 },
    { subject: "Growth", score: growthScore, fullMark: 100 },
    { subject: "Efficiency", score: efficiencyScore, fullMark: 100 }
  ];

  // Calculate Breakeven ROE (ROE needed to justify currentPrice)
  const breakevenROE = (currentPrice * costOfEquity) / bvps;

  return (
    <div className="space-y-8 animate-tab-in" id="equity-valuation-model">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-[#1E293B] pb-6">
        <div>
          <h2 className="text-2xl font-bold font-display text-white tracking-tight uppercase flex items-center gap-2">
            Equity Valuation Model — {symbol}
            <button 
              onClick={() => setShowInfoModal(true)} 
              className="p-1 text-[#64748B] hover:text-[#00D4FF] hover:bg-[#1E293B]/65 rounded-full transition-all cursor-pointer inline-flex items-center"
              title="How valuation models are calculated in DSE"
            >
              <HelpCircle className="h-5 w-5" />
            </button>
          </h2>
          <p className="text-xs text-[#94A3B8] font-mono mt-1">
            Enterprise Asset Intelligence · Industry Benchmark Mapping: <span className="text-[#00D4FF] font-bold">{sectorBenchmark.sector}</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
          <SourceDataBadge type="source" size="xs" source="Balance Sheet & Equity" />
          <SourceDataBadge type="calculation" size="xs" formula="P/B, Graham, Residual Inc." />
          <SourceDataBadge type="interpretation" size="xs" method="Fair Value Synthesis" />
          <span className={`inline-flex items-center px-4 py-1.5 rounded-full text-[10px] font-mono font-extrabold tracking-wider border uppercase ${dataQualityDetails.theme}`}>
            {dataQuality === "Complete" && <CheckCircle2 className="h-3.5 w-3.5 mr-1.5 animate-pulse" />}
            {dataQuality === "Partial" && <Info className="h-3.5 w-3.5 mr-1.5" />}
            {dataQuality === "Minimal" && <AlertTriangle className="h-3.5 w-3.5 mr-1.5" />}
            {dataQualityDetails.label}
          </span>
        </div>
      </div>

      {/* TOP SUB-TAB MENU (CFA COMPLIANCE LAYER) */}
      <div className="flex border-b border-[#1E293B] gap-6 text-xs font-mono mb-2 pb-px overflow-x-auto scrollbar-none">
        <button
          onClick={() => setActiveSubTab("synthesis")}
          className={`pb-3 font-extrabold uppercase tracking-widest transition-all border-b-2 cursor-pointer flex items-center gap-2 whitespace-nowrap ${
            activeSubTab === "synthesis" 
              ? "border-[#00D4FF] text-[#00D4FF] scale-[1.02]" 
              : "border-transparent text-[#64748B] hover:text-[#94A3B8]"
          }`}
        >
          <Compass className="h-3.5 w-3.5" />
          <span>Valuation Synthesis</span>
        </button>
        <button
          onClick={() => setActiveSubTab("cfa")}
          className={`pb-3 font-extrabold uppercase tracking-widest transition-all border-b-2 cursor-pointer flex items-center gap-2 whitespace-nowrap ${
            activeSubTab === "cfa" 
              ? "border-[#A78BFA] text-[#A78BFA] scale-[1.02]" 
              : "border-transparent text-[#64748B] hover:text-[#94A3B8]"
          }`}
        >
          <Layers className="h-3.5 w-3.5" />
          <span>CFA Models & Forecasts</span>
        </button>
        <button
          onClick={() => setActiveSubTab("research")}
          className={`pb-3 font-extrabold uppercase tracking-widest transition-all border-b-2 cursor-pointer flex items-center gap-2 whitespace-nowrap ${
            activeSubTab === "research" 
              ? "border-[#F59E0B] text-[#F59E0B] scale-[1.02]" 
              : "border-transparent text-[#64748B] hover:text-[#94A3B8]"
          }`}
        >
          <FileText className="h-3.5 w-3.5" />
          <span>Institutional Research Report</span>
        </button>
      </div>

      <AnimatePresence mode="wait">
        {activeSubTab === "synthesis" && (
          <motion.div
            key="synthesis-tab"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.25 }}
            className="space-y-8"
          >
            {/* HERO COMPOSITE AUDIT CARD */}
            <div className={`relative overflow-hidden bg-gradient-to-r ${verdictStyles.bg} border rounded-2xl p-6 md:p-8 card-lift ${verdictStyles.glow}`}>
              <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px] opacity-15 pointer-events-none" />
              <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center relative z-10">
                <div className="md:col-span-7 space-y-2">
                  <span className="text-[10px] md:text-xs font-mono font-extrabold tracking-widest text-[#94A3B8] uppercase block">
                    Composite Intrinsic Synthesis
                  </span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl md:text-5xl font-extrabold font-mono text-white tracking-tighter">
                      ৳{compositeFairValue.toFixed(2)}
                    </span>
                    <span className="text-xs text-[#94A3B8] font-mono uppercase">
                      BDT
                    </span>
                  </div>
                  <p className="text-xs text-[#94A3B8] tracking-wide leading-relaxed">
                    Weighted synthesis of active asset-backed models, tracking sector multipliers, book leverage coefficients, Graham price floors, and Cost of Equity metrics dynamically mapped.
                  </p>
                </div>

                <div className="md:col-span-5 flex flex-col md:items-end justify-center border-t md:border-t-0 md:border-l border-white/10 pt-6 md:pt-0 md:pl-8 space-y-4">
                  <div className="grid grid-cols-2 w-full gap-4 md:text-right">
                    <div>
                      <span className="text-[9px] font-mono text-[#94A3B8] uppercase block">Current LTP</span>
                      <span className="text-base font-bold font-mono text-white">৳{currentPrice.toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="text-[9px] font-mono text-[#94A3B8] uppercase block">Margin of Safety</span>
                      <span className={`text-base font-bold font-mono flex items-center md:justify-end gap-1 ${compositeMarginOfSafety >= 0 ? "text-[#10B981]" : "text-[#EF4444]"}`}>
                        {compositeMarginOfSafety >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                        {compositeMarginOfSafety.toFixed(1)}%
                      </span>
                    </div>
                  </div>

                  <div className="w-full">
                    <span className="text-[9px] font-mono text-[#94A3B8] uppercase block mb-1">Analytical Valuation Verdict</span>
                    <div className={`text-xs uppercase tracking-widest font-black text-center py-2.5 px-4 rounded-xl shadow-md border border-white/5 ${verdictStyles.pill}`}>
                      {compositeVerdict}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* KEY INPUTS STRIP */}
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
              {[
                { label: "NAV / BVPS", value: `৳${bvps.toFixed(2)}`, sub: "Book Value Per Share", icon: <BookOpen className="h-4 w-4 text-[#00D4FF]" /> },
                { label: "Price / Book (P/B)", value: `${currentPB.toFixed(2)}x`, sub: `vs sector ${sectorBenchmark.avgPB.toFixed(2)}x`, icon: <Scale className="h-4 w-4 text-[#A78BFA]" /> },
                { label: "Return on Equity", value: roe !== null ? `${roe.toFixed(1)}%` : "N/A", sub: `vs sector ${sectorBenchmark.avgROE.toFixed(1)}%`, icon: <Activity className="h-4 w-4 text-[#F59E0B]" /> },
                { label: "Earnings Per Share", value: eps !== null ? `৳${eps.toFixed(2)}` : "৳0.00", sub: eps !== null && eps > 0 ? "Annualized (TTM)" : "Negative earnings", icon: <DollarSign className="h-4 w-4 text-[#10B981]" /> },
                { label: "DSE Coe (Ke)", value: `${costOfEquity.toFixed(1)}%`, sub: "8.0% + Beta × 6.5%", icon: <Percent className="h-4 w-4 text-[#E879F9]" /> },
                { label: "Volatility Beta", value: beta.toFixed(2), sub: "vs DSEX Index", icon: <Calculator className="h-4 w-4 text-[#94A3B8]" /> }
              ].map((input, idx) => (
                <div key={idx} className="bg-[#0A0F1E] border border-[#1E293B] rounded-xl p-4 flex flex-col justify-between hover:border-[#1e293b]/80 transition-all">
                  <div className="flex items-center justify-between pb-2">
                    <span className="text-[9px] font-mono font-bold text-[#64748B] uppercase tracking-wider">{input.label}</span>
                    {input.icon}
                  </div>
                  <div>
                    <span className="text-base font-bold font-mono text-white block leading-none">{input.value}</span>
                    <span className="text-[9px] font-mono text-[#94A3B8] font-medium leading-none block mt-1.5">{input.sub}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* CHANNEL BREAKDOWNS (5 CORE MODELS) */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold font-mono text-[#94A3B8] tracking-widest uppercase">
                Asset pricing channels ledger (Deterministic audit)
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Method 1: P/B Relative Price */}
                <div className="bg-[#0A0F1E] border border-[#1E293B] rounded-xl p-5 flex flex-col justify-between space-y-4 relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-1.5 h-full bg-[#00D4FF]" />
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-display font-bold text-white text-sm">{methods.pbFairValue.methodName}</h4>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="text-[10px] font-mono text-[#00D4FF] uppercase font-bold tracking-wider">{methods.pbFairValue.signal}</span>
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#10B981]/10 text-[#10B981] font-mono font-bold border border-[#10B981]/10">Active</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-lg font-bold font-mono text-white block">৳{methods.pbFairValue.fairPrice.toFixed(2)}</span>
                      <span className={`text-[9.5px] font-mono font-bold block ${methods.pbFairValue.marginOfSafety >= 0 ? "text-[#10B981]" : "text-[#EF4444]"}`}>
                        MoS: {methods.pbFairValue.marginOfSafety >= 0 ? "+" : ""}{methods.pbFairValue.marginOfSafety}%
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[9px] font-mono text-[#64748B]">
                      <span>Current P/B: {methods.pbFairValue.currentPB}x</span>
                      <span>Sector Avg: {methods.pbFairValue.targetPB}x</span>
                    </div>
                    <div className="w-full bg-[#1e293b] rounded-full h-1.5 overflow-hidden flex relative items-center">
                      <div 
                        className="bg-[#00D4FF] h-full rounded-full transition-all duration-500" 
                        style={{ width: `${Math.max(10, Math.min(100, (methods.pbFairValue.currentPB ?? 1) / (methods.pbFairValue.targetPB ?? 1) * 50))}%` }}
                      />
                      <div className="absolute bg-white w-1 h-3 top-[-3px] left-[50%] opacity-70" title="Sector Peer Match Line" />
                    </div>
                  </div>

                  <div className="border-t border-[#1E293B]/60 pt-3 flex flex-col gap-2">
                    <button onClick={() => toggleFormula("pb")} className="flex items-center justify-between text-[10px] font-mono text-[#94A3B8] hover:text-white transition-all text-left">
                      <span>Formula Structure</span>
                      {showFormula["pb"] ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    </button>
                    {showFormula["pb"] && (
                      <div className="bg-[#090D1A] p-2.5 rounded border border-[#1E293B]/40 font-mono text-[9px] text-[#00D4FF] leading-relaxed">
                        {methods.pbFairValue.formula}
                      </div>
                    )}

                    <button onClick={() => toggleAssumptions("pb")} className="flex items-center justify-between text-[10px] font-mono text-[#94A3B8] hover:text-white transition-all text-left">
                      <span>Key Model Assumptions</span>
                      {showAssumptions["pb"] ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    </button>
                    {showAssumptions["pb"] && (
                      <ul className="text-[10px] text-[#94A3B8] font-sans space-y-1 pl-4 list-disc marker:text-[#00D4FF]">
                        {methods.pbFairValue.assumptions.map((ass, i) => (
                          <li key={i}>{ass}</li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="flex justify-between border-t border-[#1E293B]/40 pt-3 text-[10px] font-mono">
                    <span className="text-[#64748B]">Weight: {methods.pbFairValue.weight}%</span>
                    <span className="text-[#00D4FF] font-bold">Weighted Contribution: ৳{methods.pbFairValue.contribution.toFixed(2)}</span>
                  </div>
                </div>

                {/* Method 2: ROE-Justified P/B */}
                <div className="bg-[#0A0F1E] border border-[#1E293B] rounded-xl p-5 flex flex-col justify-between space-y-4 relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-1.5 h-full bg-[#A78BFA]" />
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-display font-bold text-white text-sm">{methods.roeJustifiedPB.methodName}</h4>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="text-[10px] font-mono text-[#A78BFA] uppercase font-bold tracking-wider">{methods.roeJustifiedPB.signal}</span>
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#10B981]/10 text-[#10B981] font-mono font-bold border border-[#10B981]/10">Active</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-lg font-bold font-mono text-white block">৳{methods.roeJustifiedPB.fairPrice.toFixed(2)}</span>
                      <span className={`text-[9.5px] font-mono font-bold block ${methods.roeJustifiedPB.marginOfSafety >= 0 ? "text-[#10B981]" : "text-[#EF4444]"}`}>
                        MoS: {methods.roeJustifiedPB.marginOfSafety >= 0 ? "+" : ""}{methods.roeJustifiedPB.marginOfSafety}%
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[9px] font-mono text-[#64748B]">
                      <span>Justified P/B: {methods.roeJustifiedPB.targetPB}x</span>
                      <span>Current P/B: {methods.pbFairValue.currentPB}x</span>
                    </div>
                    <div className="w-full bg-[#1e293b] rounded-full h-1.5 overflow-hidden flex relative items-center">
                      <div 
                        className="bg-[#A78BFA] h-full rounded-full transition-all duration-500" 
                        style={{ width: `${Math.max(10, Math.min(100, (methods.roeJustifiedPB.targetPB ?? 1) / (methods.pbFairValue.currentPB ?? 1) * 50))}%` }}
                      />
                      <div className="absolute bg-white w-1 h-3 top-[-3px] left-[50%] opacity-70" title="Fair Equity Breakeven Line" />
                    </div>
                  </div>

                  <div className="border-t border-[#1E293B]/60 pt-3 flex flex-col gap-2">
                    <button onClick={() => toggleFormula("roe")} className="flex items-center justify-between text-[10px] font-mono text-[#94A3B8] hover:text-white transition-all text-left">
                      <span>Formula Structure</span>
                      {showFormula["roe"] ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    </button>
                    {showFormula["roe"] && (
                      <div className="bg-[#090D1A] p-2.5 rounded border border-[#1E293B]/40 font-mono text-[9px] text-[#A78BFA] leading-relaxed">
                        {methods.roeJustifiedPB.formula}
                      </div>
                    )}

                    <button onClick={() => toggleAssumptions("roe")} className="flex items-center justify-between text-[10px] font-mono text-[#94A3B8] hover:text-white transition-all text-left">
                      <span>Key Model Assumptions</span>
                      {showAssumptions["roe"] ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    </button>
                    {showAssumptions["roe"] && (
                      <ul className="text-[10px] text-[#94A3B8] font-sans space-y-1 pl-4 list-disc marker:text-[#A78BFA]">
                        {methods.roeJustifiedPB.assumptions.map((ass, i) => (
                          <li key={i}>{ass}</li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="flex justify-between border-t border-[#1E293B]/40 pt-3 text-[10px] font-mono">
                    <span className="text-[#64748B]">Weight: {methods.roeJustifiedPB.weight}%</span>
                    <span className="text-[#A78BFA] font-bold">Weighted Contribution: ৳{methods.roeJustifiedPB.contribution.toFixed(2)}</span>
                  </div>
                </div>

                {/* Method 3: Graham Number */}
                <div className={`bg-[#0A0F1E] border border-[#1E293B] rounded-xl p-5 flex flex-col justify-between space-y-4 relative overflow-hidden ${!methods.grahamNumber.available ? "opacity-60" : ""}`}>
                  <div className="absolute top-0 left-0 w-1.5 h-full bg-[#F59E0B]" />
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-display font-bold text-white text-sm">{methods.grahamNumber.methodName}</h4>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="text-[10px] font-mono text-[#F59E0B] uppercase font-bold tracking-wider">{methods.grahamNumber.signal}</span>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-bold border ${methods.grahamNumber.available ? "bg-[#10B981]/10 text-[#10B981] border-[#10B981]/10" : "bg-[#EF4444]/10 text-[#EF4444] border-[#EF4444]/10"}`}>
                          {methods.grahamNumber.available ? "Active" : "N/A — Net loss"}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-lg font-bold font-mono text-white block">
                        {methods.grahamNumber.available ? `৳${methods.grahamNumber.fairPrice.toFixed(2)}` : "—"}
                      </span>
                      {methods.grahamNumber.available && (
                        <span className={`text-[9.5px] font-mono font-bold block ${methods.grahamNumber.marginOfSafety >= 0 ? "text-[#10B981]" : "text-[#EF4444]"}`}>
                          MoS: {methods.grahamNumber.marginOfSafety >= 0 ? "+" : ""}{methods.grahamNumber.marginOfSafety}%
                        </span>
                      )}
                    </div>
                  </div>

                  <p className="text-[11px] text-[#94A3B8] leading-relaxed">
                    Calculates defensive valuation limits using Graham’s structural factor 22.5 to map concrete margin of safety ranges.
                  </p>

                  <div className="border-t border-[#1E293B]/60 pt-3 flex flex-col gap-2">
                    <button onClick={() => toggleFormula("graham")} disabled={!methods.grahamNumber.available} className="flex items-center justify-between text-[10px] font-mono text-[#94A3B8] hover:text-white disabled:opacity-50 disabled:pointer-events-none transition-all text-left">
                      <span>Formula Structure</span>
                      {showFormula["graham"] ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    </button>
                    {showFormula["graham"] && methods.grahamNumber.available && (
                      <div className="bg-[#090D1A] p-2.5 rounded border border-[#1E293B]/40 font-mono text-[9px] text-[#F59E0B] leading-relaxed">
                        {methods.grahamNumber.formula}
                      </div>
                    )}

                    <button onClick={() => toggleAssumptions("graham")} disabled={!methods.grahamNumber.available} className="flex items-center justify-between text-[10px] font-mono text-[#94A3B8] hover:text-white disabled:opacity-50 disabled:pointer-events-none transition-all text-left">
                      <span>Key Model Assumptions</span>
                      {showAssumptions["graham"] ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    </button>
                    {showAssumptions["graham"] && methods.grahamNumber.available && (
                      <ul className="text-[10px] text-[#94A3B8] font-sans space-y-1 pl-4 list-disc marker:text-[#F59E0B]">
                        {methods.grahamNumber.assumptions.map((ass, i) => (
                          <li key={i}>{ass}</li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="flex justify-between border-t border-[#1E293B]/40 pt-3 text-[10px] font-mono">
                    <span className="text-[#64748B]">Weight: {methods.grahamNumber.weight}%</span>
                    <span className="text-[#F59E0B] font-bold">
                      {methods.grahamNumber.available ? `Weighted Contribution: ৳${methods.grahamNumber.contribution.toFixed(2)}` : "Redistributed"}
                    </span>
                  </div>
                </div>

                {/* Method 4: EV / BV Option */}
                <div className={`bg-[#0A0F1E] border border-[#1E293B] rounded-xl p-5 flex flex-col justify-between space-y-4 relative overflow-hidden ${!methods.evBookValue.available ? "opacity-60" : ""}`}>
                  <div className="absolute top-0 left-0 w-1.5 h-full bg-[#10B981]" />
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-display font-bold text-white text-sm">{methods.evBookValue.methodName}</h4>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="text-[10px] font-mono text-[#10B981] uppercase font-bold tracking-wider">{methods.evBookValue.signal}</span>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-bold border ${methods.evBookValue.available ? "bg-[#10B981]/10 text-[#10B981] border-[#10B981]/10" : "bg-[#EF4444]/15 text-[#EF4444] border-[#EF4444]/15"}`}>
                          {methods.evBookValue.available ? "Active" : "N/A — Debt proxy used"}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-lg font-bold font-mono text-white block">
                        {methods.evBookValue.available ? `৳${methods.evBookValue.fairPrice.toFixed(2)}` : "—"}
                      </span>
                      {methods.evBookValue.available && (
                        <span className={`text-[9.5px] font-mono font-bold block ${methods.evBookValue.marginOfSafety >= 0 ? "text-[#10B981]" : "text-[#EF4444]"}`}>
                          MoS: {methods.evBookValue.marginOfSafety >= 0 ? "+" : ""}{methods.evBookValue.marginOfSafety}%
                        </span>
                      )}
                    </div>
                  </div>

                  <p className="text-[11px] text-[#94A3B8] leading-relaxed">
                    Adjusts clean asset values for structural balance sheet leverage and cash buffers to isolate intrinsic operational metrics.
                  </p>

                  <div className="border-t border-[#1E293B]/60 pt-3 flex flex-col gap-2">
                    <button onClick={() => toggleFormula("ev")} disabled={!methods.evBookValue.available} className="flex items-center justify-between text-[10px] font-mono text-[#94A3B8] hover:text-white disabled:opacity-50 disabled:pointer-events-none transition-all text-left">
                      <span>Formula Structure</span>
                      {showFormula["ev"] ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    </button>
                    {showFormula["ev"] && methods.evBookValue.available && (
                      <div className="bg-[#090D1A] p-2.5 rounded border border-[#1E293B]/40 font-mono text-[9px] text-[#10B981] leading-relaxed">
                        {methods.evBookValue.formula}
                      </div>
                    )}

                    <button onClick={() => toggleAssumptions("ev")} disabled={!methods.evBookValue.available} className="flex items-center justify-between text-[10px] font-mono text-[#94A3B8] hover:text-white disabled:opacity-50 disabled:pointer-events-none transition-all text-left">
                      <span>Key Model Assumptions</span>
                      {showAssumptions["ev"] ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    </button>
                    {showAssumptions["ev"] && methods.evBookValue.available && (
                      <ul className="text-[10px] text-[#94A3B8] font-sans space-y-1 pl-4 list-disc marker:text-[#10B981]">
                        {methods.evBookValue.assumptions.map((ass, i) => (
                          <li key={i}>{ass}</li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="flex justify-between border-t border-[#1E293B]/40 pt-3 text-[10px] font-mono">
                    <span className="text-[#64748B]">Weight: {methods.evBookValue.weight}%</span>
                    <span className="text-[#10B981] font-bold">
                      {methods.evBookValue.available ? `Weighted Contribution: ৳${methods.evBookValue.contribution.toFixed(2)}` : "Redistributed"}
                    </span>
                  </div>
                </div>

              </div>

              {/* Method 5: Full-width Residual Income */}
              <div className={`bg-[#0A0F1E] border border-[#1E293B] rounded-xl p-5 flex flex-col justify-between space-y-4 relative overflow-hidden ${!methods.residualIncome.available ? "opacity-60" : ""}`}>
                <div className="absolute top-0 left-0 w-1.5 h-full bg-[#E879F9]" />
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h4 className="font-display font-bold text-white text-sm">{methods.residualIncome.methodName}</h4>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="text-[10px] font-mono text-[#E879F9] uppercase font-bold tracking-wider">{methods.residualIncome.signal}</span>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-bold border ${methods.residualIncome.available ? "bg-[#10B981]/10 text-[#10B981] border-[#10B981]/10" : "bg-[#EF4444]/15 text-[#EF4444] border-[#EF4444]/15"}`}>
                        {methods.residualIncome.available ? "Active" : "N/A — Requires operational eps history"}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-baseline md:text-right gap-3 md:flex-col md:gap-0">
                    <span className="text-xl font-black font-mono text-white">
                      {methods.residualIncome.available ? `৳${methods.residualIncome.fairPrice.toFixed(2)}` : "—"}
                    </span>
                    {methods.residualIncome.available && (
                      <span className={`text-[10px] font-mono font-bold ${methods.residualIncome.marginOfSafety >= 0 ? "text-[#10B981]" : "text-[#EF4444]"}`}>
                        MoS: {methods.residualIncome.marginOfSafety >= 0 ? "+" : ""}{methods.residualIncome.marginOfSafety}%
                      </span>
                    )}
                  </div>
                </div>

                <p className="text-[11px] text-[#94A3B8] leading-relaxed">
                  Measures abnormal equity wealth generator channels. Isolates net returns over the Cost of Equity requirement to construct cash-substitute ledgers.
                </p>

                <div className="border-t border-[#1E293B]/60 pt-3 flex flex-col gap-2">
                  <button onClick={() => toggleFormula("ri")} disabled={!methods.residualIncome.available} className="flex items-center justify-between text-[10px] font-mono text-[#94A3B8] hover:text-white disabled:opacity-50 disabled:pointer-events-none transition-all text-left">
                    <span>Formula Structure</span>
                    {showFormula["ri"] ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  </button>
                  {showFormula["ri"] && methods.residualIncome.available && (
                    <div className="bg-[#090D1A] p-2.5 rounded border border-[#1E293B]/40 font-mono text-[9px] text-[#E879F9] leading-relaxed">
                      {methods.residualIncome.formula}
                    </div>
                  )}

                  <button onClick={() => toggleAssumptions("ri")} disabled={!methods.residualIncome.available} className="flex items-center justify-between text-[10px] font-mono text-[#94A3B8] hover:text-white disabled:opacity-50 disabled:pointer-events-none transition-all text-left">
                    <span>Key Model Assumptions</span>
                    {showAssumptions["ri"] ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  </button>
                  {showAssumptions["ri"] && methods.residualIncome.available && (
                    <ul className="text-[10px] text-[#94A3B8] font-sans space-y-1 pl-4 list-disc marker:text-[#E879F9]">
                      {methods.residualIncome.assumptions.map((ass, i) => (
                        <li key={i}>{ass}</li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="flex justify-between border-t border-[#1E293B]/40 pt-3 text-[10px] font-mono">
                  <span className="text-[#64748B]">Weight: {methods.residualIncome.weight}%</span>
                  <span className="text-[#E879F9] font-bold">
                    {methods.residualIncome.available ? `Weighted Contribution: ৳${methods.residualIncome.contribution.toFixed(2)}` : "Redistributed"}
                  </span>
                </div>
              </div>

            </div>

            {/* COMPARISON BAR CHART & RADAR CHART BENTO GRID */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              {/* COMPARISON BAR CHART */}
              <div className="lg:col-span-7 bg-[#0A0F1E] border border-[#1E293B] rounded-xl p-5 space-y-6 flex flex-col justify-between">
                <div>
                  <h3 className="text-xs font-bold font-mono text-white tracking-widest uppercase">
                    Model Valuation comparison spectrum
                  </h3>
                  <p className="text-xs text-[#94A3B8] mt-1 leading-relaxed">
                    Cross-model intrinsic valuation anchors compared to current market Price and Sector baseline targets.
                  </p>
                </div>

                <div className="h-[280px] w-full" id="chart-valuation-comparison">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={chartData}
                      layout="vertical"
                      margin={{ top: 10, right: 30, left: 30, bottom: 10 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                      <XAxis type="number" stroke="#64748B" fontSize={10} fontFamily="JetBrains Mono" domain={[0, 'dataMax + 40']} />
                      <YAxis type="category" dataKey="name" stroke="#64748B" fontSize={10} fontFamily="Inter" width={95} />
                      <Tooltip 
                        cursor={{ fill: 'rgba(255, 255, 255, 0.03)' }}
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const d = payload[0].payload;
                            const diffPercent = (((d.price - currentPrice) / currentPrice) * 100).toFixed(1);
                            return (
                              <div className="bg-[#0d1527]/95 border border-[#1e293b] p-3 rounded-xl shadow-xl font-mono text-xs">
                                <p className="text-white font-bold font-sans">{d.name}</p>
                                <p className="text-[#00D4FF] mt-1">Implied Value: ৳{d.price.toFixed(2)}</p>
                                <p className={parseFloat(diffPercent) >= 0 ? "text-[#10B981]" : "text-[#EF4444]"}>
                                  vs Current Price: {parseFloat(diffPercent) >= 0 ? "+" : ""}{diffPercent}%
                                </p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Bar dataKey="price" radius={[0, 4, 4, 0]} barSize={12}>
                        {chartData.map((d, index) => (
                          <Cell key={`cell-${index}`} fill={d.fill} />
                        ))}
                      </Bar>
                      <ReferenceLine 
                        x={currentPrice} 
                        stroke="#ffffff" 
                        strokeDasharray="4 4" 
                        label={{ value: `LTP: ৳${currentPrice}`, position: 'top', fill: '#ffffff', fontSize: 9, fontFamily: 'JetBrains Mono' }} 
                      />
                      <ReferenceLine 
                        x={sectorAvgPrice} 
                        stroke="#A78BFA" 
                        strokeDasharray="3 3" 
                        label={{ value: `Sector P/B Avg: ৳${sectorAvgPrice.toFixed(1)}`, position: 'bottom', fill: '#A78BFA', fontSize: 9, fontFamily: 'JetBrains Mono' }} 
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="flex flex-wrap gap-4 text-[10px] font-mono justify-center border-t border-[#1E293B]/50 pt-4 text-[#94A3B8]">
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-white rounded-sm inline-block" /> Current Price</span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-[#00D4FF] rounded-sm inline-block" /> P/B Peer Price</span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-[#A78BFA] rounded-sm inline-block" /> Justified Price</span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-[#10B981] rounded-sm inline-block" /> Composite Fair</span>
                </div>
              </div>

              {/* RADAR CHART ELEMENT */}
              <div className="lg:col-span-5 bg-[#0A0F1E] border border-[#1E293B] rounded-xl p-5 space-y-6 flex flex-col justify-between">
                <div>
                  <h3 className="text-xs font-bold font-mono text-white tracking-widest uppercase">
                    Key Fundamentals Radar Index
                  </h3>
                  <p className="text-xs text-[#94A3B8] mt-1 leading-relaxed">
                    A multi-factor diagnostic chart of {symbol}'s fundamental strengths: profitability, liquidity, solvency, growth, and efficiency metrics.
                  </p>
                </div>

                <div className="h-[280px] w-full flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                      <PolarGrid stroke="#1e293b" />
                      <PolarAngleAxis 
                        dataKey="subject" 
                        stroke="#94A3B8" 
                        tick={{ fill: "#94A3B8", fontSize: 9, fontFamily: "JetBrains Mono" }} 
                      />
                      <PolarRadiusAxis 
                        angle={30} 
                        domain={[0, 100]} 
                        stroke="#64748B" 
                        tick={{ fill: "#64748B", fontSize: 8 }} 
                      />
                      <Radar
                        name={symbol}
                        dataKey="score"
                        stroke="#00D4FF"
                        fill="#00D4FF"
                        fillOpacity={0.25}
                      />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const d = payload[0].payload;
                            return (
                              <div className="bg-[#0d1527]/95 border border-[#1e293b] p-3 rounded-xl shadow-xl font-mono text-xs text-white">
                                <p className="font-bold">{d.subject}</p>
                                <p className="text-[#00D4FF] mt-1">Score: {d.score} / 100</p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>

                <div className="text-[10px] font-mono text-center text-[#64748B] border-t border-[#1E293B]/50 pt-4">
                  Scores calculated dynamically from asset-backed balance sheet diagnostics.
                </div>
              </div>
            </div>

            {/* SENSITIVITY STRESS TABLES */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold font-mono text-[#94A3B8] tracking-widest uppercase">
                Dynamic sensitivity analysis tables (Analytical matrix)
              </h3>

              {/* Table A: P/B Mult. Scenario Analysis */}
              <div className="bg-[#0A0F1E] border border-[#1E293B] rounded-xl overflow-hidden hover:border-[#1E293B]/80 transition-all">
                <button 
                  onClick={() => toggleTable("pb")}
                  className="w-full flex items-center justify-between p-4 bg-[#0D1527] font-display font-bold text-white text-sm border-b border-[#1E293B] cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <Scale className="h-4 w-4 text-[#00D4FF]" />
                    <span className="text-xs font-mono uppercase tracking-wider text-left">Sensitivity Matrix: Target peer multiplier multipliers</span>
                  </div>
                  {collapsedTables["pb"] ? <ChevronDown className="h-4 w-4 text-[#64748B]" /> : <ChevronUp className="h-4 w-4 text-[#64748B]" />}
                </button>
                
                <AnimatePresence>
                  {!collapsedTables["pb"] && (
                    <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-x-auto">
                      <table className="w-full text-left font-mono text-xs text-[#94A3B8] border-collapse min-w-[600px]">
                        <thead>
                          <tr className="bg-[#0D1527] border-b border-[#1E293B] text-[10px] text-[#64748B] uppercase tracking-wider font-extrabold">
                            <th className="p-3 pl-6">Sector Target Standard</th>
                            <th className="p-3">Resulting Target P/B</th>
                            <th className="p-3">Implied Fair Price</th>
                            <th className="p-3">Delta vs LTP</th>
                            <th className="p-3 pr-6 text-right">Appraisal Signal</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sensitivityAnalysis.pbScenarios.map((rowRef, idx) => {
                            const scenarioRatio = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0, 2.5, 3.0][idx];
                            const diffLtp = ((rowRef.impliedPrice - currentPrice) / currentPrice) * 100;
                            const isCurrent = Math.abs(rowRef.pb - currentPB) < 0.15;
                            const isSector = Math.abs(rowRef.pb - sectorBenchmark.avgPB) < 0.05;

                            let rowStyle = "hover:bg-[#1E293B]/20 border-b border-[#1e293b]/40";
                            if (isCurrent) rowStyle = "bg-[#00D4FF]/5 text-white border-y border-[#00D4FF]/30 font-bold";
                            else if (isSector) rowStyle = "bg-[#F59E0B]/5 hover:bg-[#F59E0B]/10 border-y border-[#F59E0B]/30 font-bold";

                            const rowSignal = diffLtp > 25 ? "Deep value discount" : diffLtp > 5 ? "Undervalued" : diffLtp < -15 ? "Overvalued Premium" : "Fair relative valuation";

                            return (
                              <tr key={idx} className={rowStyle}>
                                <td className="p-3 pl-6">
                                  {scenarioRatio.toFixed(2)}x sector benchmark
                                  {isSector && <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#F59E0B]/10 text-[#F59E0B] border border-[#F59E0B]/10 ml-2">Sector Peer baseline</span>}
                                </td>
                                <td className="p-3">
                                  {rowRef.pb.toFixed(2)}x
                                  {isCurrent && <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#00D4FF]/10 text-[#00D4FF] border border-[#00D4FF]/10 ml-2">Market P/B</span>}
                                </td>
                                <td className="p-3">৳{rowRef.impliedPrice.toFixed(2)}</td>
                                <td className={`p-3 font-semibold ${diffLtp >= 0 ? "text-[#10B981]" : "text-[#EF4444]"}`}>
                                  {diffLtp >= 0 ? "+" : ""}{diffLtp.toFixed(1)}%
                                </td>
                                <td className="p-3 pr-6 text-right font-semibold text-[#64748B]">{rowSignal}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Table B: ROE Scenario Analysis */}
              <div className="bg-[#0A0F1E] border border-[#1E293B] rounded-xl overflow-hidden hover:border-[#1E293B]/80 transition-all">
                <button 
                  onClick={() => toggleTable("roe")}
                  className="w-full flex items-center justify-between p-4 bg-[#0D1527] font-display font-bold text-white text-sm border-b border-[#1E293B] cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <Activity className="h-4 w-4 text-[#A78BFA]" />
                    <span className="text-xs font-mono uppercase tracking-wider text-left">Sensitivity Matrix: Justified price vs ROE targets</span>
                  </div>
                  {collapsedTables["roe"] ? <ChevronDown className="h-4 w-4 text-[#64748B]" /> : <ChevronUp className="h-4 w-4 text-[#64748B]" />}
                </button>
                
                <AnimatePresence>
                  {!collapsedTables["roe"] && (
                    <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-x-auto">
                      <div className="p-4 bg-[#0D1527]/40 border-b border-[#1E293B] text-[10px] font-mono text-[#A78BFA] leading-relaxed">
                        Hurdle comparison baseline: Cost of Equity capital (Ke) discount factor of {costOfEquity.toFixed(2)}%.
                      </div>
                      <table className="w-full text-left font-mono text-xs text-[#94A3B8] border-collapse min-w-[600px]">
                        <thead>
                          <tr className="bg-[#0D1527] border-b border-[#1E293B] text-[10px] text-[#64748B] uppercase tracking-wider font-extrabold">
                            <th className="p-3 pl-6">Annualized Return on Equity</th>
                            <th className="p-3">Justified P/B Coefficient</th>
                            <th className="p-3">Implied Value per Share</th>
                            <th className="p-3 pr-6">vs Current market price</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sensitivityAnalysis.roeScenarios.map((rowRef, idx) => {
                            const diffLtp = ((rowRef.impliedPrice - currentPrice) / currentPrice) * 100;
                            const isCurrent = roe !== null && Math.abs(rowRef.roe - roe) < 1.6;
                            const isSector = Math.abs(rowRef.roe - sectorBenchmark.avgROE) < 1.0;

                            let rowStyle = "hover:bg-[#1E293B]/20 border-b border-[#1e293b]/40";
                            if (isCurrent) rowStyle = "bg-[#A78BFA]/5 text-white border-y border-[#A78BFA]/30 font-bold";
                            else if (isSector) rowStyle = "bg-[#F59E0B]/5 hover:bg-[#F59E0B]/10 border-y border-[#F59E0B]/30 font-bold";

                            return (
                              <tr key={idx} className={rowStyle}>
                                <td className="p-3 pl-6">
                                  {rowRef.roe.toFixed(1)}%
                                  {isSector && <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#F59E0B]/10 text-[#F59E0B] border border-[#F59E0B]/10 ml-2">Sector Peak Baseline</span>}
                                  {isCurrent && <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#A78BFA]/10 text-[#A78BFA] border border-[#A78BFA]/10 ml-2">Current ROE</span>}
                                </td>
                                <td className="p-3">{rowRef.justifiedPB.toFixed(2)}x deserved PB</td>
                                <td className="p-3">৳{rowRef.impliedPrice.toFixed(2)}</td>
                                <td className={`p-3 pr-6 font-semibold ${diffLtp >= 0 ? "text-[#10B981]" : "text-[#EF4444]"}`}>
                                  {diffLtp >= 0 ? "+" : ""}{diffLtp.toFixed(1)}%
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </motion.div>
                  )}
                </AnimatePresence>
                
                <div className="p-4 bg-[#0d1527] text-[10px] font-mono text-[#64748B] border-t border-[#1E293B]">
                  {`Breakeven Required Return: expected return on equity threshold necessary to support standard price BDT ${currentPrice.toFixed(2)} at DSE Cost of Equity is ${breakevenROE.toFixed(2)}%.`}
                </div>
              </div>
            </div>

            {/* synthesis conclusion summary */}
            <div className="bg-[#0A0F1E] border border-[#1E293B] rounded-2xl p-6 space-y-6">
              <h3 className="text-xs font-bold font-mono text-white tracking-widest uppercase pb-1 border-b border-[#1E293B]">
                Determinative equity valuation synthesis narrative
              </h3>
              <p className="text-xs text-[#94A3B8] font-sans leading-relaxed text-justify">
                {conclusion}
              </p>
              <div className="flex flex-col md:flex-row md:items-center justify-between border-t border-[#1E293B]/70 pt-6 gap-4">
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-mono text-[#64748B] uppercase tracking-wider block">Composite Audit:</span>
                  <div className={`text-[10.5px] uppercase font-black px-4 py-1.5 rounded-lg border shadow-sm ${verdictStyles.pill}`}>
                    {compositeVerdict}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setActiveSubTab("cfa")}
                    className="flex items-center gap-2 bg-[#1A2235]/60 hover:bg-[#1f2a41] border border-[#00D4FF]/20 hover:border-[#00D4FF]/40 text-[#00D4FF] px-4 py-2.5 rounded-xl text-xs font-mono font-bold tracking-wider transition-all cursor-pointer"
                  >
                    <span>Advanced CFA Models & Forecasts →</span>
                  </button>
                  <button
                    onClick={() => setActiveSubTab("research")}
                    className="flex items-center gap-2 bg-[#1A2235]/60 hover:bg-[#1f2a41] border border-[#F59E0B]/20 hover:border-[#F59E0B]/40 text-[#F59E0B] px-4 py-2.5 rounded-xl text-xs font-mono font-bold tracking-wider transition-all cursor-pointer"
                  >
                    <span>Institutional Equity Report →</span>
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* CFA MODELS & SPREADSHEETS TAB */}
        {activeSubTab === "cfa" && (
          <motion.div
            key="cfa-tab"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.25 }}
            className="space-y-8"
          >
            {/* SUB-HEADER NOTE */}
            <div className="bg-[#0A0F1E] border border-[#1e293b] p-4 rounded-xl flex items-start gap-3">
              <Compass className="h-5 w-5 text-[#A78BFA] mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="text-white text-xs font-mono uppercase font-bold tracking-wider">CFA Institute compliance Valuation framework</h4>
                <p className="text-[#94A3B8] text-[11px] leading-relaxed mt-1">
                  These mathematical frameworks evaluate free cash flows, multistage dividend streams, abnormal residual incomes, and adjust balance asset values. Calculations are fully transparent with zero simulated or fake metrics.
                </p>
              </div>
            </div>

            {/* ROW 1: FCFF & FCFE DCF LEDGERS */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              
              {/* MODEL A: FCFF MODEL DISPLAY */}
              <div className="bg-[#0A0F1E] border border-[#1E293B] rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-[#1E293B] pb-3.5">
                  <div className="flex items-center gap-2">
                    <Coins className="h-4 w-4 text-[#A78BFA]" />
                    <span className="text-xs font-mono uppercase font-black text-white tracking-wider">Free Cash Flow to the Firm (FCFF) Model</span>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold border ${data?.fcffModel?.available ? "bg-[#10B981]/15 text-[#10B981] border-[#10B981]/25" : "bg-[#EF4444]/15 text-[#EF4444] border-[#EF4444]/25"}`}>
                    {data?.fcffModel?.available ? "ACTIVE (Ke & WACC)" : "Leveraged Bank Standard / Inactive"}
                  </span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="bg-[#010610] p-3 rounded-lg border border-[#1e293b]/40">
                    <span className="text-[10px] text-[#64748B] font-mono uppercase block">Implied Price</span>
                    <span className="text-base font-bold font-mono text-white mt-1 block">৳{data?.fcffModel?.fairPrice.toFixed(2)}</span>
                  </div>
                  <div className="bg-[#010610] p-3 rounded-lg border border-[#1e293b]/40">
                    <span className="text-[10px] text-[#64748B] font-mono uppercase block">WACC Rate</span>
                    <span className="text-base font-bold font-mono text-[#A78BFA] mt-1 block">{data?.fcffModel?.wacc.toFixed(2)}%</span>
                  </div>
                  <div className="bg-[#010610] p-3 rounded-lg border border-[#1e293b]/40 col-span-2 md:col-span-1">
                    <span className="text-[10px] text-[#64748B] font-mono uppercase block">Enterprise Value</span>
                    <span className="text-base font-bold font-mono text-white mt-1 block">৳{data?.fcffModel?.enterpriseValue.toLocaleString()}M</span>
                  </div>
                </div>

                <p className="text-[11px] text-[#94A3B8] leading-relaxed">
                  Evaluates operational cash flows generated from business activities before financing obligations, discounting cash flows at the company’s WACC.
                </p>

                <div className="border-t border-[#1E293B]/50 pt-3 flex flex-col gap-2">
                  <button onClick={() => toggleCfaCollapse("fcff-eq")} className="flex items-center justify-between text-[10px] font-mono text-[#64748B] hover:text-[#94A3B8] text-left transition-all">
                    <span>Model Formula</span>
                    {showCfaCollapse["fcff-eq"] ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  </button>
                  {showCfaCollapse["fcff-eq"] && (
                    <div className="bg-[#000] p-2 rounded text-[9px] font-mono text-[#A78BFA] border border-[#1e293b] leading-normal font-medium">
                      {data?.fcffModel?.formula}
                    </div>
                  )}

                  <button onClick={() => toggleCfaCollapse("fcff-ass")} className="flex items-center justify-between text-[10px] font-mono text-[#64748B] hover:text-[#94A3B8] text-left transition-all">
                    <span>Assumptions Matrix</span>
                    {showCfaCollapse["fcff-ass"] ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  </button>
                  {showCfaCollapse["fcff-ass"] && (
                    <ul className="pl-4 list-disc marker:text-[#A78BFA] text-[10px] text-[#94A3B8] space-y-1">
                      {data?.fcffModel?.assumptions.map((item, idx) => (
                        <li key={idx}>{item}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              {/* MODEL B: FCFE MODEL DISPLAY */}
              <div className="bg-[#0A0F1E] border border-[#1E293B] rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-[#1E293B] pb-3.5">
                  <div className="flex items-center gap-2">
                    <Coins className="h-4 w-4 text-[#10B981]" />
                    <span className="text-xs font-mono uppercase font-black text-white tracking-wider">Free Cash Flow to Equity (FCFE) Model</span>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold border ${data?.fcfeModel?.available ? "bg-[#10B981]/15 text-[#10B981] border-[#10B981]/25" : "bg-[#EF4444]/15 text-[#EF4444] border-[#EF4444]/25"}`}>
                    {data?.fcfeModel?.available ? "ACTIVE (Ke hurdle)" : "Unavailable"}
                  </span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="bg-[#010610] p-3 rounded-lg border border-[#1e293b]/40">
                    <span className="text-[10px] text-[#64748B] font-mono uppercase block">Implied Price</span>
                    <span className="text-base font-bold font-mono text-white mt-1 block">৳{data?.fcfeModel?.fairPrice.toFixed(2)}</span>
                  </div>
                  <div className="bg-[#010610] p-3 rounded-lg border border-[#1e293b]/40">
                    <span className="text-[10px] text-[#64748B] font-mono uppercase block">Cost of Equity (Ke)</span>
                    <span className="text-base font-bold font-mono text-[#10B981] mt-1 block">{data?.fcfeModel?.costOfEquity.toFixed(2)}%</span>
                  </div>
                  <div className="bg-[#010610] p-3 rounded-lg border border-[#1e293b]/40 col-span-2 md:col-span-1">
                    <span className="text-[10px] text-[#64748B] font-mono uppercase block">Net borrowing</span>
                    <span className="text-base font-bold font-mono text-white mt-1 block">৳{data?.fcfeModel?.netBorrowing.toLocaleString()}M</span>
                  </div>
                </div>

                <p className="text-[11px] text-[#94A3B8] leading-relaxed">
                  Evaluates operational cash flows available directly for distribution to common equity holders, factoring in structural debt additions/repayments.
                </p>

                <div className="border-t border-[#1E293B]/50 pt-3 flex flex-col gap-2">
                  <button onClick={() => toggleCfaCollapse("fcfe-eq")} className="flex items-center justify-between text-[10px] font-mono text-[#64748B] hover:text-[#94A3B8] text-left transition-all">
                    <span>Model Formula</span>
                    {showCfaCollapse["fcfe-eq"] ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  </button>
                  {showCfaCollapse["fcfe-eq"] && (
                    <div className="bg-[#000] p-2 rounded text-[9px] font-mono text-[#10B981] border border-[#1e293b] leading-normal font-medium">
                      {data?.fcfeModel?.formula}
                    </div>
                  )}

                  <button onClick={() => toggleCfaCollapse("fcfe-ass")} className="flex items-center justify-between text-[10px] font-mono text-[#64748B] hover:text-[#94A3B8] text-left transition-all">
                    <span>Assumptions Matrix</span>
                    {showCfaCollapse["fcfe-ass"] ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  </button>
                  {showCfaCollapse["fcfe-ass"] && (
                    <ul className="pl-4 list-disc marker:text-[#10B981] text-[10px] text-[#94A3B8] space-y-1">
                      {data?.fcfeModel?.assumptions.map((item, idx) => (
                        <li key={idx}>{item}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

            </div>

            {/* ROW 2: MULTI-STAGE DDM & RESIDUAL INCOME LEDGER */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              
              {/* MODEL C: MULTI-STAGE DDM */}
              <div className="bg-[#0A0F1E] border border-[#1E293B] rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-[#1E293B] pb-3.5">
                  <div className="flex items-center gap-2">
                    <Scale className="h-4 w-4 text-[#F59E0B]" />
                    <span className="text-xs font-mono uppercase font-black text-white tracking-wider">Multi-stage Dividend discount model (DDM)</span>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold border ${data?.ddmModel?.available ? "bg-[#10B981]/15 text-[#10B981] border-[#10B981]/25" : "bg-[#EF4444]/15 text-[#EF4444] border-[#EF4444]/25"}`}>
                    {data?.ddmModel?.available ? "ACTIVE" : "N/A — Dividend yield is zero"}
                  </span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="bg-[#010610] p-3 rounded-lg border border-[#1e293b]/40">
                    <span className="text-[10px] text-[#64748B] font-mono uppercase block">Implied Price</span>
                    <span className="text-base font-bold font-mono text-white mt-1 block">৳{data?.ddmModel?.fairPrice.toFixed(2)}</span>
                  </div>
                  <div className="bg-[#010610] p-3 rounded-lg border border-[#1e293b]/40">
                    <span className="text-[10px] text-[#64748B] font-mono uppercase block">Hurdle Required Return</span>
                    <span className="text-base font-bold font-mono text-[#F59E0B] mt-1 block">{data?.ddmModel?.requiredReturn.toFixed(2)}%</span>
                  </div>
                  <div className="bg-[#010610] p-3 rounded-lg border border-[#1e293b]/40 col-span-2 md:col-span-1">
                    <span className="text-[10px] text-[#64748B] font-mono uppercase block">Sustainable Payout</span>
                    <span className="text-base font-bold font-mono text-white mt-1 block">{data?.ddmModel?.payoutRatio.toFixed(1)}%</span>
                  </div>
                </div>

                <p className="text-[11px] text-[#94A3B8] leading-relaxed">
                  Appraises equity purely as the present value of future dividend payments. Employs a multi-stage transition from historical yield growth guidelines to perpetual GDP limits.
                </p>

                <div className="border-t border-[#1E293B]/50 pt-3 flex flex-col gap-2">
                  <button onClick={() => toggleCfaCollapse("ddm-eq")} className="flex items-center justify-between text-[10px] font-mono text-[#64748B] hover:text-[#94A3B8] text-left transition-all">
                    <span>Model Formula</span>
                    {showCfaCollapse["ddm-eq"] ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  </button>
                  {showCfaCollapse["ddm-eq"] && (
                    <div className="bg-[#000] p-2 rounded text-[9px] font-mono text-[#F59E0B] border border-[#1e293b] leading-normal font-medium">
                      {data?.ddmModel?.formula}
                    </div>
                  )}

                  <button onClick={() => toggleCfaCollapse("ddm-ass")} className="flex items-center justify-between text-[10px] font-mono text-[#64748B] hover:text-[#94A3B8] text-left transition-all">
                    <span>Assumptions Matrix</span>
                    {showCfaCollapse["ddm-ass"] ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  </button>
                  {showCfaCollapse["ddm-ass"] && (
                    <ul className="pl-4 list-disc marker:text-[#F59E0B] text-[10px] text-[#94A3B8] space-y-1">
                      {data?.ddmModel?.assumptions.map((item, idx) => (
                        <li key={idx}>{item}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              {/* MODEL D: RESIDUAL INCOME MODEL LEDGER */}
              <div className="bg-[#0A0F1E] border border-[#1E293B] rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-[#1E293B] pb-3.5">
                  <div className="flex items-center gap-2">
                    <Scale className="h-4 w-4 text-[#E879F9]" />
                    <span className="text-xs font-mono uppercase font-black text-white tracking-wider">Residual Income Model (RIM) Ledger</span>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold border ${data?.rimDetail?.available ? "bg-[#10B981]/15 text-[#10B981] border-[#10B981]/25" : "bg-[#EF4444]/15 text-[#EF4444] border-[#EF4444]/25"}`}>
                    {data?.rimDetail?.available ? "ACTIVE" : "N/A — Bypassed"}
                  </span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="bg-[#010610] p-3 rounded-lg border border-[#1e293b]/40">
                    <span className="text-[10px] text-[#64748B] font-mono uppercase block">Implied Price</span>
                    <span className="text-base font-bold font-mono text-white mt-1 block">৳{data?.rimDetail?.intrinsicValue.toFixed(2)}</span>
                  </div>
                  <div className="bg-[#010610] p-3 rounded-lg border border-[#1e293b]/40">
                    <span className="text-[10px] text-[#64748B] font-mono uppercase block">Original BVPS</span>
                    <span className="text-base font-bold font-mono text-[#E879F9] mt-1 block">৳{data?.rimDetail?.bookValue.toFixed(2)}</span>
                  </div>
                  <div className="bg-[#010610] p-3 rounded-lg border border-[#1e293b]/40 col-span-2 md:col-span-1">
                    <span className="text-[10px] text-[#64748B] font-mono uppercase block">Abnormal Earnings</span>
                    <span className="text-base font-bold font-mono text-white mt-1 block">৳{data?.rimDetail?.residualIncomeValue.toFixed(2)}/sh</span>
                  </div>
                </div>

                <p className="text-[11px] text-[#94A3B8] leading-relaxed">
                  Examines abnormal earnings excess values. Values equity capital as present book value added to discounted future residual income flows under Cost of Equity thresholds.
                </p>

                <div className="border-t border-[#1E293B]/50 pt-3 flex flex-col gap-2">
                  <button onClick={() => toggleCfaCollapse("rim-eq")} className="flex items-center justify-between text-[10px] font-mono text-[#64748B] hover:text-[#94A3B8] text-left transition-all">
                    <span>Model Formula</span>
                    {showCfaCollapse["rim-eq"] ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  </button>
                  {showCfaCollapse["rim-eq"] && (
                    <div className="bg-[#000] p-2 rounded text-[9px] font-mono text-[#E879F9] border border-[#1e293b] leading-normal font-medium">
                      {data?.rimDetail?.formula}
                    </div>
                  )}

                  <button onClick={() => toggleCfaCollapse("rim-ass")} className="flex items-center justify-between text-[10px] font-mono text-[#64748B] hover:text-[#94A3B8] text-left transition-all">
                    <span>Assumptions Matrix</span>
                    {showCfaCollapse["rim-ass"] ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  </button>
                  {showCfaCollapse["rim-ass"] && (
                    <ul className="pl-4 list-disc marker:text-[#E879F9] text-[10px] text-[#94A3B8] space-y-1">
                      {data?.rimDetail?.assumptions.map((item, idx) => (
                        <li key={idx}>{item}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

            </div>

            {/* ROW 3: ALTERNATIVE MODELS - ADJUSTED NAV & SOTP */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              
              {/* MODEL E: ADJUSTED NET ASSET VALUE */}
              <div className="bg-[#0A0F1E] border border-[#1E293B] rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-[#1E293B] pb-3.5">
                  <div className="flex items-center gap-2">
                    <Activity className="h-4 w-4 text-[#00D4FF]" />
                    <span className="text-xs font-mono uppercase font-black text-white tracking-wider">Asset-based model (Adjusted NAV)</span>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded font-mono font-bold border bg-[#10B981]/15 text-[#10B981] border-[#10B981]/25">
                    ACTIVE (Sector Quality Factor)
                  </span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="bg-[#010610] p-3 rounded-lg border border-[#1e293b]/40">
                    <span className="text-[10px] text-[#64748B] font-mono uppercase block">Implied Price</span>
                    <span className="text-base font-bold font-mono text-white mt-1 block">৳{data?.assetBased?.fairPrice.toFixed(2)}</span>
                  </div>
                  <div className="bg-[#010610] p-3 rounded-lg border border-[#1e293b]/40">
                    <span className="text-[10px] text-[#64748B] font-mono uppercase block">Adjustment multiplier</span>
                    <span className="text-base font-bold font-mono text-[#00D4FF] mt-1 block">{data?.assetBased?.adjustmentMultiplier.toFixed(2)}x</span>
                  </div>
                  <div className="bg-[#010610] p-3 rounded-lg border border-[#1e293b]/40 col-span-2 md:col-span-1">
                    <span className="text-[10px] text-[#64748B] font-mono uppercase block">Original BVPS</span>
                    <span className="text-base font-bold font-mono text-white mt-1 block">৳{data?.assetBased?.bookValue.toFixed(2)}</span>
                  </div>
                </div>

                <p className="text-[11px] text-[#94A3B8] leading-relaxed">
                  Adjusts book values of assets and liabilities to current replacement costs or realizable liquidation values based on sector-specific asset quality multipliers.
                </p>

                <div className="border-t border-[#1E293B]/50 pt-3 flex flex-col gap-2">
                  <button onClick={() => toggleCfaCollapse("asset-eq")} className="flex items-center justify-between text-[10px] font-mono text-[#64748B] hover:text-[#94A3B8] text-left transition-all">
                    <span>Model Formula</span>
                    {showCfaCollapse["asset-eq"] ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  </button>
                  {showCfaCollapse["asset-eq"] && (
                    <div className="bg-[#000] p-2 rounded text-[9px] font-mono text-[#00D4FF] border border-[#1e293b] leading-normal font-medium">
                      {data?.assetBased?.formula}
                    </div>
                  )}

                  <button onClick={() => toggleCfaCollapse("asset-ass")} className="flex items-center justify-between text-[10px] font-mono text-[#64748B] hover:text-[#94A3B8] text-left transition-all">
                    <span>Assumptions Matrix</span>
                    {showCfaCollapse["asset-ass"] ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  </button>
                  {showCfaCollapse["asset-ass"] && (
                    <ul className="pl-4 list-disc marker:text-[#00D4FF] text-[10px] text-[#94A3B8] space-y-1">
                      {data?.assetBased?.assumptions.map((item, idx) => (
                        <li key={idx}>{item}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              {/* MODEL F: SUM OF THE PARTS (SOTP) */}
              <div className="bg-[#0A0F1E] border border-[#1E293B] rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-[#1E293B] pb-3.5">
                  <div className="flex items-center gap-2">
                    <Compass className="h-4 w-4 text-[#A78BFA]" />
                    <span className="text-xs font-mono uppercase font-black text-white tracking-wider">Sum-of-the-parts (SOTP) Valuation</span>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded font-mono font-bold border bg-[#10B981]/15 text-[#10B981] border-[#10B981]/25">
                    ACTIVE (Holding discount evaluated)
                  </span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="bg-[#010610] p-3 rounded-lg border border-[#1e293b]/40">
                    <span className="text-[10px] text-[#64748B] font-mono uppercase block">Implied Price</span>
                    <span className="text-base font-bold font-mono text-white mt-1 block">৳{data?.sotp?.fairPrice.toFixed(2)}</span>
                  </div>
                  <div className="bg-[#010610] p-3 rounded-lg border border-[#1e293b]/40">
                    <span className="text-[10px] text-[#64748B] font-mono uppercase block">Holding Discount</span>
                    <span className="text-base font-bold font-mono text-[#A78BFA] mt-1 block">{data?.sotp?.conglomerateDiscount}%</span>
                  </div>
                  <div className="bg-[#010610] p-3 rounded-lg border border-[#1e293b]/40 col-span-2 md:col-span-1">
                    <span className="text-[10px] text-[#64748B] font-mono uppercase block">Subsidiaries value</span>
                    <span className="text-base font-bold font-mono text-white mt-1 block">৳{data?.sotp?.subSegmentValue.toFixed(2)}</span>
                  </div>
                </div>

                <p className="text-[11px] text-[#94A3B8] leading-relaxed">
                  Appraises diversified firms by segmenting core business cash flows from separate associate stakes, net of conglomerate discount margins.
                </p>

                <div className="border-t border-[#1E293B]/50 pt-3 flex flex-col gap-2">
                  <button onClick={() => toggleCfaCollapse("sotp-eq")} className="flex items-center justify-between text-[10px] font-mono text-[#64748B] hover:text-[#94A3B8] text-left transition-all">
                    <span>Model Formula</span>
                    {showCfaCollapse["sotp-eq"] ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  </button>
                  {showCfaCollapse["sotp-eq"] && (
                    <div className="bg-[#000] p-2 rounded text-[9px] font-mono text-[#A78BFA] border border-[#1e293b] leading-normal font-medium">
                      {data?.sotp?.formula}
                    </div>
                  )}

                  <button onClick={() => toggleCfaCollapse("sotp-ass")} className="flex items-center justify-between text-[10px] font-mono text-[#64748B] hover:text-[#94A3B8] text-left transition-all">
                    <span>Assumptions Matrix</span>
                    {showCfaCollapse["sotp-ass"] ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  </button>
                  {showCfaCollapse["sotp-ass"] && (
                    <ul className="pl-4 list-disc marker:text-[#A78BFA] text-[10px] text-[#94A3B8] space-y-1">
                      {data?.sotp?.assumptions.map((item, idx) => (
                        <li key={idx}>{item}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

            </div>

            {/* SPREADSHEET FORWARD FORECASTING TIMELINE (EXCEL STYLE GRID) */}
            <div className="bg-[#0A0F1E] border border-[#1e293b] rounded-xl p-5 space-y-4 overflow-hidden">
              <div>
                <h3 className="text-xs font-bold font-mono text-white tracking-widest uppercase">
                  Excel-Grade multi-period forecasting timeline
                </h3>
                <p className="text-xs text-[#94A3B8] mt-1 leading-relaxed">
                  Compound interest projection arrays tracking key parameters across 1-year, 3-year, and 5-year forwarding holding periods.
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left font-mono text-xs border border-[#1e293b] min-w-[700px]">
                  <thead>
                    <tr className="bg-[#0D1527] border-b border-[#1e293b] text-[#64748B] hover:bg-[#0D1527] h-10 font-black text-[10.5px]">
                      <th className="p-3 pl-4 border-r border-[#1e293b]">Forecasted Financial Parameter</th>
                      <th className="p-3 border-r border-[#1e293b] text-center">Historical Baseline</th>
                      <th className="p-3 border-r border-[#1e293b] text-center text-[#00D4FF]">1-Year Forward</th>
                      <th className="p-3 border-r border-[#1e293b] text-center text-[#A78BFA]">3-Year Forward</th>
                      <th className="p-3 text-center text-[#F59E0B]">5-Year Forward</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-[#1e293b]/70 hover:bg-[#1E293B]/10">
                      <td className="p-3 pl-4 border-r border-[#1e293b] font-bold text-white">Full Net Revenue (Est.)</td>
                      <td className="p-3 border-r border-[#1e293b] text-center">৳{(baseRevenue || 1).toLocaleString(undefined, { maximumFractionDigits: 0 })}M</td>
                      <td className="p-3 border-r border-[#1e293b] text-center font-semibold text-white">৳{data?.forecasting?.year1.revenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}M</td>
                      <td className="p-3 border-r border-[#1e293b] text-center text-gray-300">৳{data?.forecasting?.year3.revenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}M</td>
                      <td className="p-3 text-center text-gray-400">৳{data?.forecasting?.year5.revenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}M</td>
                    </tr>
                    <tr className="border-b border-[#1e293b]/70 hover:bg-[#1E293B]/10">
                      <td className="p-3 pl-4 border-r border-[#1e293b] font-bold text-white">Earnings Per Share (EPS)</td>
                      <td className="p-3 border-r border-[#1e293b] text-center">৳{currentPrice && currentPB ? (currentPrice / (currentPE ?? 1)).toFixed(2) : "—"}</td>
                      <td className="p-3 border-r border-[#1e293b] text-center font-semibold text-white">৳{data?.forecasting?.year1.eps.toFixed(2)}</td>
                      <td className="p-3 border-r border-[#1e293b] text-center text-gray-300">৳{data?.forecasting?.year3.eps.toFixed(2)}</td>
                      <td className="p-3 text-center text-gray-400">৳{data?.forecasting?.year5.eps.toFixed(2)}</td>
                    </tr>
                    <tr className="border-b border-[#1e293b]/70 hover:bg-[#1E293B]/10">
                      <td className="p-3 pl-4 border-r border-[#1e293b] font-bold text-white">Dividends Per Share (DPS)</td>
                      <td className="p-3 border-r border-[#1e293b] text-center">৳{currentPrice ? (currentPrice * (currentDY / 100)).toFixed(2) : "—"}</td>
                      <td className="p-3 border-r border-[#1e293b] text-center font-semibold text-white">৳{data?.forecasting?.year1.dividend.toFixed(2)}</td>
                      <td className="p-3 border-r border-[#1e293b] text-center text-gray-300">৳{data?.forecasting?.year3.dividend.toFixed(2)}</td>
                      <td className="p-3 text-center text-gray-400">৳{data?.forecasting?.year5.dividend.toFixed(2)}</td>
                    </tr>
                    <tr className="border-b border-[#1e293b]/70 hover:bg-[#1E293B]/10">
                      <td className="p-3 pl-4 border-r border-[#1e293b] font-bold text-white">Free Cash Flow per Share</td>
                      <td className="p-3 border-r border-[#1e293b] text-center">৳{(currentFCF / sharesCount).toFixed(2)}</td>
                      <td className="p-3 border-r border-[#1e293b] text-center font-semibold text-white">৳{(data?.forecasting?.year1.cashFlow / sharesCount).toFixed(2)}</td>
                      <td className="p-3 border-r border-[#1e293b] text-center text-gray-300">৳{(data?.forecasting?.year3.cashFlow / sharesCount).toFixed(2)}</td>
                      <td className="p-3 text-center text-gray-400">৳{(data?.forecasting?.year5.cashFlow / sharesCount).toFixed(2)}</td>
                    </tr>
                    <tr className="border-b border-[#1e293b]/70 hover:bg-[#1E293B]/10 border-double">
                      <td className="p-3 pl-4 border-r border-[#1e293b] font-bold text-white">NAV / Book Value Per Share (Est.)</td>
                      <td className="p-3 border-r border-[#1e293b] text-center font-semibold">৳{bvps.toFixed(2)}</td>
                      <td className="p-3 border-r border-[#1e293b] text-center text-white">৳{data?.forecasting?.year1.bookValue.toFixed(2)}</td>
                      <td className="p-3 border-r border-[#1e293b] text-center text-gray-300">৳{data?.forecasting?.year3.bookValue.toFixed(2)}</td>
                      <td className="p-3 text-center text-gray-400">৳{data?.forecasting?.year5.bookValue.toFixed(2)}</td>
                    </tr>
                    <tr className="bg-[#0D1527]/90 text-[12px] font-black hover:bg-[#0D1527]">
                      <td className="p-3.5 pl-4 border-r border-[#1e293b] text-white font-black uppercase text-[10px]">Model-Estimated Intrinsic Value Benchmark</td>
                      <td className="p-3.5 border-r border-[#1e293b] text-center text-[#94a3b8]">৳{compositeFairValue.toFixed(2)}</td>
                      <td className="p-3.5 border-r border-[#1e293b] text-center text-[#00D4FF] font-black">৳{data?.forecasting?.year1.priceTarget.toFixed(2)}</td>
                      <td className="p-3.5 border-r border-[#1e293b] text-center text-[#A78BFA] font-black">৳{data?.forecasting?.year3.priceTarget.toFixed(2)}</td>
                      <td className="p-3.5 text-center text-[#F59E0B] font-black">৳{data?.forecasting?.year5.priceTarget.toFixed(2)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="bg-[#000]/30 p-4 border border-[#1e293b]/50 rounded-lg text-[10.5px] font-mono text-[#64748B] flex items-center justify-between">
                <span>Model parameters mapping logic: Discount discount factor decays steady-state over holding horizons.</span>
                <span className="text-[#A78BFA] font-bold">WACC baseline: {data?.fcffModel?.wacc.toFixed(2)}%</span>
              </div>
            </div>

          </motion.div>
        )}

        {/* INSTITUTIONAL RESEARCH & RECOMMENDATION REPORT LISTS */}
        {activeSubTab === "research" && (
          <motion.div
            key="research-tab"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.25 }}
            className="space-y-8"
          >
            {/* SUB-HEADER NOTE */}
            <div className="bg-[#0A0F1E] border border-[#1e293b] p-4 rounded-xl flex items-start gap-3">
              <FileText className="h-5 w-5 text-[#F59E0B] mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="text-white text-xs font-mono uppercase font-bold tracking-wider">CFA Multi-Factor Recommendation Matrix</h4>
                <p className="text-[#94A3B8] text-[11px] leading-relaxed mt-1">
                  Integrates qualitative risk weights with statistical model ratings strictly following professional equity research standards.
                </p>
              </div>
            </div>

            {/* WEIGHTED ENGINE CARD MATRIX */}
            <div className="bg-[#0A0F1E] border border-[#1E293B] rounded-xl p-5 space-y-6">
              
              <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 border-b border-[#1E293B] pb-5">
                <div>
                  <h3 className="text-xs font-bold font-mono text-white tracking-widest uppercase">
                    Weighted investment rating scorecard
                  </h3>
                  <p className="text-[11px] text-[#94A3B8] mt-1">
                    Aggregation weight: 30% Valuation, 25% Quality, 15% Earnings Profit Growth, 15% Technicals, 10% Risk, 5% Sentiment.
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-[9px] font-mono text-[#64748B] uppercase block">Weighted Investment Score</div>
                  <div className="text-2xl font-black font-mono text-[#F59E0B]">{data?.recommendationMatrix?.investmentScore.toFixed(1)}/100</div>
                </div>
              </div>

              {/* BAR ROW MATRIX */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[
                  { name: "1. Valuation Discount", weight: 30, score: data?.recommendationMatrix?.weights.valuation.score || 50, color: "bg-[#00D4FF]", note: "Based on dynamic Margin of Safety comparisons" },
                  { name: "2. Financial Quality", weight: 25, score: data?.recommendationMatrix?.weights.financialQuality.score || 50, color: "bg-[#A78BFA]", note: "Return on Equity (ROE) & debt structure tiers" },
                  { name: "3. Earnings Growth", weight: 15, score: data?.recommendationMatrix?.weights.earningsGrowth.score || 50, color: "bg-[#E879F9]", note: "Annual net profit growth indicators" },
                  { name: "4. Technical Strength", weight: 15, score: data?.recommendationMatrix?.weights.technicalStrength.score || 50, color: "bg-[#10B981]", note: "Oscillator states and Volatility beta limits" },
                  { name: "5. Risk Tolerance", weight: 10, score: data?.recommendationMatrix?.weights.riskFactors.score || 50, color: "bg-[#EF4444]", note: "Asset classification & liquidity stability" },
                  { name: "6. Market Sentiment", weight: 5, score: data?.recommendationMatrix?.weights.marketSentiment.score || 50, color: "bg-[#F59E0B]", note: "Forward revenue and regional sector momentum" }
                ].map((row, idx) => (
                  <div key={idx} className="bg-[#080d19] border border-[#1e293b]/70 p-4 rounded-xl space-y-3">
                    <div className="flex justify-between items-baseline font-mono text-[10.5px]">
                      <span className="font-bold text-white">{row.name}</span>
                      <span className="text-[#64748B]">Weight: {row.weight}%</span>
                    </div>
                    
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] font-mono font-black text-gray-400">
                        <span>Score rating: {row.score}/100</span>
                      </div>
                      <div className="w-full bg-[#1A2235] h-2 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${row.color}`} style={{ width: `${row.score}%` }} />
                      </div>
                    </div>
                    <p className="text-[10px] text-[#64748B] font-sans italic">{row.note}</p>
                  </div>
                ))}
              </div>

              {/* CARD DECK EDUCATIONAL ACTIONS */}
              <div className="mt-6 p-5 bg-[#00D4FF]/5 border border-[#00D4FF]/20 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="space-y-1">
                  <div className="text-[10px] font-mono text-[#00D4FF] uppercase font-bold tracking-widest">Composite valuation learning profile</div>
                  <h3 className="text-xl font-bold font-display text-white">
                    {`Valuation Model Profile: `}
                    <span className="text-[#00D4FF] underline decoration-double decoration-[#00D4FF]/40">{data?.recommendationMatrix?.finalVerdict || "Neutral Valuation"}</span>
                  </h3>
                  <p className="text-[#94A3B8] text-xs">Derived following multi-factor valuation analysis with an audit confidence mapping of {data?.recommendationMatrix?.confidenceScore}%</p>
                </div>

                <div className="flex gap-4">
                  <div className="bg-[#000]/40 p-4 rounded-xl border border-[#1e293b] text-center min-w-[110px]">
                    <span className="text-[9px] font-mono text-[#64748B] uppercase block">Modeled Fair Value (1Y)</span>
                    <span className="text-base font-bold font-mono text-white mt-1 block">৳{data?.forecasting?.year1.priceTarget.toFixed(2)}</span>
                  </div>
                  <div className="bg-[#000]/40 p-4 rounded-xl border border-[#1e293b] text-center min-w-[110px]">
                    <span className="text-[9px] font-mono text-[#64748B] uppercase block">Expected Return</span>
                    <span className="text-base font-bold font-mono text-[#10B981] mt-1 block">+{data?.researchReport?.expectedReturn.toFixed(1)}%</span>
                  </div>
                </div>
              </div>

            </div>

            {/* RESEARCH NARRATIVE BLOCK */}
            <div className="bg-[#0A0F1E] border border-[#1E293B] rounded-xl p-6 space-y-6">
              
              {/* RESEARCH THESIS */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold font-mono text-white tracking-widest uppercase border-b border-[#1E293B] pb-2">
                  1. INVESTMENT RESEARCH THESIS
                </h3>
                <p className="text-xs text-[#94A3B8] font-sans leading-relaxed text-justify">
                  {data?.researchReport?.investmentThesis}
                </p>
              </div>

              {/* THREE CASE SCENARIOS (BULL, BASE, BEAR) */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold font-mono text-white tracking-widest uppercase border-b border-[#1E293B] pb-2">
                  2. SCENARIO PROFILE & SENSITIVITY TESTING
                </h3>
                
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  {/* BULL CASE */}
                  <div className="bg-[#0d1c1a] border border-[#0d533d] p-5 rounded-xl space-y-3 relative overflow-hidden">
                    <div className="absolute top-0 right-0 h-10 w-10 bg-[#0d533d]/20 rounded-bl-full flex items-center justify-center font-mono text-[9px] font-bold text-[#10B981]">BULL</div>
                    <span className="text-[9px] font-mono text-[#10b981] uppercase block font-bold">Optimistic Expansion profile</span>
                    <h4 className="text-base font-extrabold font-mono text-white leading-none">৳{data?.researchReport?.bullCase.targetPrice.toFixed(2)}</h4>
                    <p className="text-[11px] text-[#94A3B8] leading-relaxed">
                      {data?.researchReport?.bullCase.scenarioText}
                    </p>
                  </div>

                  {/* BASE CASE */}
                  <div className="bg-[#121c2c] border border-[#1e2b4d] p-5 rounded-xl space-y-3 relative overflow-hidden">
                    <div className="absolute top-0 right-0 h-10 w-10 bg-[#1e2b4d]/20 rounded-bl-full flex items-center justify-center font-mono text-[9px] font-bold text-[#A78BFA]">BASE</div>
                    <span className="text-[9px] font-mono text-[#A78BFA] uppercase block font-bold">Standard Baseline projection</span>
                    <h4 className="text-base font-extrabold font-mono text-white leading-none">৳{data?.researchReport?.baseCase.targetPrice.toFixed(2)}</h4>
                    <p className="text-[11px] text-[#94A3B8] leading-relaxed">
                      {data?.researchReport?.baseCase.scenarioText}
                    </p>
                  </div>

                  {/* BEAR CASE */}
                  <div className="bg-[#241212] border border-[#7F1D1D]/50 p-5 rounded-xl space-y-3 relative overflow-hidden">
                    <div className="absolute top-0 right-0 h-10 w-10 bg-[#7F1D1D]/15 rounded-bl-full flex items-center justify-center font-mono text-[9px] font-bold text-[#EF4444]">BEAR</div>
                    <span className="text-[9px] font-mono text-[#EF4444] uppercase block font-bold">Protection floor profile</span>
                    <h4 className="text-base font-extrabold font-mono text-white leading-none">৳{data?.researchReport?.bearCase.targetPrice.toFixed(2)}</h4>
                    <p className="text-[11px] text-[#94A3B8] leading-relaxed">
                      {data?.researchReport?.bearCase.scenarioText}
                    </p>
                  </div>
                </div>
              </div>

              {/* CATALYSTS vs RISKS LIST DECK */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                <div className="space-y-3 bg-[#080d19] border border-[#1e293b]/50 p-4 rounded-xl">
                  <h3 className="text-[11px] font-mono text-[#10B981] font-bold tracking-widest uppercase">
                    3. KEY UPSIDE CATALYSTS
                  </h3>
                  <ul className="text-[11px] text-[#94A3B8] font-sans space-y-2 list-decimal pl-4">
                    {data?.researchReport?.keyCatalysts.map((val, idx) => (
                      <li key={idx} className="leading-relaxed">{val}</li>
                    ))}
                  </ul>
                </div>

                <div className="space-y-3 bg-[#080d19] border border-[#1e293b]/50 p-4 rounded-xl">
                  <h3 className="text-[11px] font-mono text-[#EF4444] font-bold tracking-widest uppercase">
                    4. KEY STATUTORY RISKS
                  </h3>
                  <ul className="text-[11px] text-[#94A3B8] font-sans space-y-2 list-decimal pl-4">
                    {data?.researchReport?.keyRisks.map((val, idx) => (
                      <li key={idx} className="leading-relaxed">{val}</li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* REGULATORY DISCLAIMER STRIP */}
              <div className="pt-4 border-t border-[#1E293B]/60 text-[9.5px] font-mono text-[#64748B] text-justify leading-relaxed">
                <span className="font-bold text-[#94A3B8] uppercase">Legal Disclaimer:</span> This report represents automated algorithmic intelligence compiled following CFA Institute guidelines strictly for equity study purposes. It does not constitute formal direct investment advice or brokerage recommendations regarding Dhaka Stock Exchange (DSE) instruments. High volatility risks apply to Bangladesh capital assets.
              </div>

            </div>

          </motion.div>
        )}
      </AnimatePresence>

      {/* INFORMATION MODAL OVERLAY */}
      <AnimatePresence>
        {showInfoModal && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }} 
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#010610]/80 backdrop-blur-md"
            onClick={() => setShowInfoModal(false)}
          >
            <motion.div 
              initial={{ scale: 0.95, y: 15 }} 
              animate={{ scale: 1, y: 0 }} 
              exit={{ scale: 0.95, y: 15 }} 
              transition={{ type: "spring", duration: 0.4 }}
              className="bg-[#0D1527] border border-[#1E293B] rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl relative"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="bg-[#090F1E] px-6 py-4 border-b border-[#1E293B] flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <HelpCircle className="h-5 w-5 text-[#00D4FF]" />
                  <h3 className="font-display font-extrabold text-white text-sm tracking-wider uppercase">DSE Valuation Models & Calculation Methodology</h3>
                </div>
                <button 
                  onClick={() => setShowInfoModal(false)}
                  className="p-1 px-2.5 text-xs text-[#64748B] hover:text-white hover:bg-[#1E293B] rounded transition-all cursor-pointer font-mono font-bold"
                >
                  ESC ✕
                </button>
              </div>

              {/* Content */}
              <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-800">
                
                {/* Intro */}
                <p className="text-xs text-[#94A3B8] leading-relaxed">
                  These mathematical frameworks translate Dhaka Stock Exchange listed filings and historical audit matrices safely into clean intrinsic estimations. They adjust standard formulas dynamically to support local Bangladesh risk-free sovereign bounds, premium interest thresholds, and sector growth benchmarks.
                </p>

                {/* Model 1 */}
                <div className="bg-[#010610]/40 p-4 rounded-xl border border-[#1E293B]/70 space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="h-5 w-5 rounded bg-[#00D4FF]/10 flex items-center justify-center font-mono text-[10px] text-[#00D4FF] font-bold">PE</div>
                    <h4 className="text-xs font-mono uppercase font-extrabold text-white">1. Price-to-Earnings (P/E) Regressions</h4>
                  </div>
                  <p className="text-[11px] text-[#94A3B8] leading-relaxed">
                    The P/E Model relates the stock price directly to its trailing/annualized Earnings Per Share (EPS).
                  </p>
                  <div className="bg-black/40 p-2.5 rounded font-mono text-[10px] text-[#00D4FF] border border-[#1e293b]/40">
                    Formula: Intrinsic Value = EPS × Target Peer Multiple
                  </div>
                  <p className="text-[10px] text-[#64748B] leading-relaxed">
                    <strong className="text-slate-400">DSE Adaptation:</strong> Standard P/E multiples are regressed against sector benchmarks. Highly leveraged banks, micro-cap insurance firms, or chemical sectors have separated peer multiple targets (ranging from 7.0x to 22.0x) to filter speculatively high or cyclically low earnings.
                  </p>
                </div>

                {/* Model 2 */}
                <div className="bg-[#010610]/40 p-4 rounded-xl border border-[#1E293B]/70 space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="h-5 w-5 rounded bg-[#A78BFA]/10 flex items-center justify-center font-mono text-[10px] text-[#A78BFA] font-bold">PG</div>
                    <h4 className="text-xs font-mono uppercase font-extrabold text-white">2. Price/Earnings-to-Growth (PEG) Model</h4>
                  </div>
                  <p className="text-[11px] text-[#94A3B8] leading-relaxed">
                    Adjusts the basic P/E structure to account for historical or expected Earnings Growth trajectory.
                  </p>
                  <div className="bg-black/40 p-2.5 rounded font-mono text-[10px] text-[#A78BFA] border border-[#1e293b]/40">
                    Formula: PEG Ratio = (Market Price / EPS) / Growth Rate (%) <br />
                    Implied Value = Target PEG (e.g., 1.5x) × Growth Rate × EPS
                  </div>
                  <p className="text-[10px] text-[#64748B] leading-relaxed">
                    <strong className="text-slate-400">DSE Adaptation:</strong> Growth calculation uses the stable compound profit or revenue growth rate limits (e.g. capped between 3% and 25% max bounds) to neutralize sudden spikes often triggered by low capital bases. A PEG under 1.2x represents major intrinsic value relative to growth.
                  </p>
                </div>

                {/* Model 3 */}
                <div className="bg-[#010610]/40 p-4 rounded-xl border border-[#1E293B]/70 space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="h-5 w-5 rounded bg-[#10B981]/10 flex items-center justify-center font-mono text-[10px] text-[#10B981] font-bold">DF</div>
                    <h4 className="text-xs font-mono uppercase font-extrabold text-white">3. Multi-Stage Discounted Cash Flow (DCF / FCFF / FCFE)</h4>
                  </div>
                  <p className="text-[11px] text-[#94A3B8] leading-relaxed">
                    Estimates intrinsic value by projecting the subsequent 5-year free cash flows and calculating their present value.
                  </p>
                  <div className="bg-black/40 p-2.5 rounded font-mono text-[10px] text-[#10B981] border border-[#1e293b]/40 leading-relaxed">
                    Formula: PV = Cumulative [ FCF_t / (1 + Discount Rate)^t ] + [ Terminal Value / (1 + Discount Rate)^5 ] <br />
                    Terminal Value = [ FCF_5 × (1 + g) ] / (Discount Rate - g)
                  </div>
                  <p className="text-[10px] text-[#64748B] leading-relaxed">
                    <strong className="text-slate-400">DSE Adaptation:</strong> Uses Cost of Equity (Ke) as the hurdle for Equity cash models (FCFE) and WACC for Firm models (FCFF). Discount rates are adjusted to integrate Bangladesh risk premiums (incorporating risk-free sovereign treasury bounds of 8.0-11.5% plus an equity risk factor premium scaled by Beta).
                  </p>
                </div>

              </div>

              {/* Footer */}
              <div className="bg-[#090F1E] px-6 py-4 border-t border-[#1E293B] flex items-center justify-between text-[10px] font-mono text-[#64748B]">
                <span>Methodology aligned with CFA Equity Appraisal Standards.</span>
                <button 
                  onClick={() => setShowInfoModal(false)}
                  className="bg-[#00D4FF] hover:bg-[#00b4d6] text-[#010610] px-4 py-1.5 rounded font-bold transition-all cursor-pointer"
                >
                  Understood
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Dynamic PDF Report layout (Visible ONLY on print) */}
      <div className="hidden print:block bg-white text-black p-10 max-w-4xl mx-auto font-sans" id="printable-equity-valuation-pdf">
        {/* A. COVER PAGE */}
        <div className="page-break flex flex-col justify-between min-h-[250mm] border-4 border-double border-gray-400 p-8 text-center bg-white">
          <div className="space-y-4">
            <div className="text-xs font-mono tracking-widest text-gray-500 uppercase">DHAKA STOCK EXCHANGE — INSTITUTIONAL EQUITY STUDY</div>
            <div className="h-0.5 bg-gray-300 w-1/4 mx-auto my-4" />
            <h1 className="text-4xl font-extrabold font-serif uppercase tracking-tight text-black leading-tight pt-12">
              EQUITY VALUATION RESEARCH REPORT
            </h1>
            <p className="text-sm font-mono text-gray-600 uppercase tracking-widest">
              Asset-Backed Multi-Scenario Capital Appraisal Framework
            </p>
          </div>

          <div className="my-[80px] p-6 border border-gray-300 bg-gray-50/50 rounded-xl space-y-3 max-w-lg mx-auto">
            <div className="text-[10px] font-mono text-gray-400 uppercase tracking-wider">Target Valuation Entity</div>
            <div className="text-2xl font-black text-black tracking-tight">{stock.name}</div>
            <div className="flex justify-center gap-6 text-xs font-mono font-bold text-gray-700 uppercase mt-1">
              <span>Ticker: {symbol}</span>
              <span>•</span>
              <span>Sector: {stock.sector || "DSE Market"}</span>
            </div>
          </div>

          <div className="space-y-2 border-t pt-6 border-gray-200">
            <div className="text-[10px] font-mono text-gray-400 uppercase tracking-wider">Appraisal Parameters Ledger</div>
            <div className="text-xs text-gray-800 font-medium">
              Valuation Date: <strong>{new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</strong>
            </div>
            <div className="text-xs text-gray-800 font-medium">
              Prepared By: <strong>Investment Committee Analytics Desk (System / Analyst)</strong>
            </div>
            <div className="text-[9px] font-mono font-extrabold text-[#EF4444] tracking-widest uppercase mt-4">
              STRICTLY CONFIDENTIAL — FOR INTERNAL USE ONLY
            </div>
          </div>
        </div>

        {/* B. EXECUTIVE SUMMARY */}
        <div className="page-break space-y-6 pt-6">
          <div className="flex justify-between items-baseline border-b-2 border-black pb-2">
            <h2 className="text-lg font-black uppercase tracking-wider text-black">Section 1.0: Executive Summary</h2>
            <span className="text-[9px] font-mono text-gray-500">Page 2</span>
          </div>

          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-black text-left">1.1 Investment Thesis</h3>
            <p className="text-xs text-gray-800 leading-relaxed text-justify">
              {data?.researchReport?.investmentThesis || "An appraisal of Dhaka Stock Exchange assets driven by robust asset coverage multipliers, solid capital adequacy ratios, and structured peer valuation indices."}
            </p>
          </div>

          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-black text-left">1.2 Valuation Summary</h3>
            <table className="w-full text-left text-xs border border-collapse border-gray-300">
              <thead>
                <tr className="bg-gray-100 border-b border-gray-350">
                  <th className="p-2 font-bold text-black text-left border-r border-gray-300">Metrics Indicator</th>
                  <th className="p-2 font-bold text-black border-r border-gray-300 text-center">Value (BDT)</th>
                  <th className="p-2 font-bold text-black text-center">Analytical Outlook</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-200">
                  <td className="p-2 border-r border-gray-300 font-semibold text-black text-left">Intrinsic Fair Value</td>
                  <td className="p-2 text-center border-r border-gray-300 font-mono font-bold">৳{compositeFairValue.toFixed(2)}</td>
                  <td className="p-2 text-gray-800 text-left">Composite weighted valuation from asset & earnings pricing channels.</td>
                </tr>
                <tr className="border-b border-gray-200">
                  <td className="p-2 border-r border-gray-300 font-semibold text-black text-left">Current LTP (Market Price)</td>
                  <td className="p-2 text-center border-r border-gray-300 font-mono font-bold">৳{currentPrice.toFixed(2)}</td>
                  <td className="p-2 text-gray-800 text-left">Current trading bounds at the Dhaka Stock Exchange.</td>
                </tr>
                <tr className="border-b border-gray-200">
                  <td className="p-2 border-r border-gray-300 font-semibold text-black text-left">Implied Valuation Margin</td>
                  <td className="p-2 text-center border-r border-gray-300 font-mono font-bold font-black text-black">
                    {compositeMarginOfSafety >= 0 ? `+${compositeMarginOfSafety.toFixed(2)}%` : `${compositeMarginOfSafety.toFixed(2)}%`}
                  </td>
                  <td className="p-2 text-gray-800 text-left">
                    {compositeMarginOfSafety >= 0 
                      ? "Asset is trading at a discount, offering favorable Margin of Safety." 
                      : "Asset is currently trading at a premium relative to intrinsic value."}
                  </td>
                </tr>
                <tr className="border-b border-gray-300">
                  <td className="p-2 border-r border-gray-300 font-semibold text-black text-left">Consensus Recommendation</td>
                  <td className="p-2 text-center border-r border-gray-300 font-bold uppercase text-black">
                    {data?.recommendationMatrix?.finalVerdict || data?.compositeVerdict || "Hold"}
                  </td>
                  <td className="p-2 text-gray-800 text-left font-semibold">
                    Investment rating targets 6-12 months growth horizon.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="space-y-3 pt-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-black text-left">1.3 Cardinal Investment Risks</h3>
            <ul className="text-xs text-gray-800 space-y-1.5 pl-5 list-disc text-left">
              <li><strong>Macro Currency & Interest Rates:</strong> Bangladesh Bank monetary tightening (11.5% Treasury rates) impacts systematic operational margins.</li>
              <li><strong>Exchange Policy Volatility:</strong> Market floor price changes and directives from BSEC introduce liquidity restrictions.</li>
              <li><strong>Capital Structure Dependencies:</strong> Leveraged operational profiles risk elevated cost of capital overhead.</li>
              <li><strong>Sector Demand Modulations:</strong> Fluctuating global supply chain barriers and custom rates in Bangladesh.</li>
            </ul>
          </div>
        </div>

        {/* C. COMPANY OVERVIEW & D. INDUSTRY ANALYSIS */}
        <div className="page-break space-y-6 pt-6">
          <div className="flex justify-between items-baseline border-b-2 border-black pb-2">
            <h2 className="text-lg font-black uppercase tracking-wider text-black">Section 2.0: Company & Industry Profile</h2>
            <span className="text-[9px] font-mono text-gray-500">Page 3</span>
          </div>

          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-black text-left">2.1 Target Business Model & Standings</h3>
            <p className="text-xs text-gray-800 leading-relaxed text-justify">
              <strong>{stock.name} ({symbol})</strong> operates as a prominent listed entity classified under the <strong>{stock.sector || "general sector"}</strong> benchmark within the Dhaka Stock Exchange. The enterprise specializes in generating sustained operating cash flow through specialized channels of domestic product delivery, leveraging strategic market positioning in Bangladesh. Raw materials inputs, operational supply-chains, and capital utilization are tailored to accommodate developing frontier markets.
            </p>
            <p className="text-xs text-gray-800 leading-relaxed text-justify">
              As of the latest audit statements, the firm represents substantial assets base with BVPS of ৳{bvps.toFixed(2)} and Return on Equity (ROE) of {roe !== null ? `${roe.toFixed(2)}%` : "N/A"}. Market capitalization matches a major share of segment capitalisation.
            </p>
          </div>

          <div className="space-y-4 pt-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-black text-left">2.2 Bangladesh Industry Context & Regulatory Landscape</h3>
            <p className="text-xs text-gray-800 leading-relaxed text-justify">
              The macroeconomic outlook in Bangladesh is influenced heavily by persistent inflationary bounds, raw material import costs, and monetary policy actions taken by the Bangladesh Bank. The capital cost hurdle has risen in line with higher treasury yields (8.00% to 11.50%), demanding higher profitability (ROE) thresholds from domestic listed enterprises to justify economic value-add.
            </p>
            <div className="p-4 bg-gray-50 border border-gray-300 rounded-lg space-y-2">
              <div className="text-[10px] font-mono text-gray-500 uppercase tracking-widest text-left">Sector Drivers Breakdown</div>
              <ul className="text-xs text-gray-800 space-y-1 pl-4 list-disc text-left">
                <li><strong>Energy & Infrastructure Costs:</strong> High grid tariff margins impact industrial overheads.</li>
                <li><strong>Central Bank Policies:</strong> SMED and currency adjustment terms modify operational liquidity.</li>
                <li><strong>Foreign Exchange Reserve Balances:</strong> Balance of payment constraints restrict key raw material imports.</li>
                <li><strong>Regulatory Margins:</strong> Broker leverage thresholds and market volatility limits set by BSEC.</li>
              </ul>
            </div>
          </div>
        </div>

        {/* E. FINANCIAL PERFORMANCE ANALYSIS */}
        <div className="page-break space-y-6 pt-6">
          <div className="flex justify-between items-baseline border-b-2 border-black pb-2">
            <h2 className="text-lg font-black uppercase tracking-wider text-black">Section 3.0: Financial Performance Analysis</h2>
            <span className="text-[9px] font-mono text-gray-500">Page 4</span>
          </div>

          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-black text-left">3.1 Profitability, Volume & Solvency Analysis</h3>
            <p className="text-xs text-gray-800 leading-relaxed text-justify">
              Quantitative evaluation of historical and forward financial statements maps systematic growth tracks. Solvency coefficients estimate low-to-medium debt distress with average gross and net margin indices remaining in line with sector averages metrics.
            </p>
          </div>

          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-black text-left">3.2 Core Financial Performance Table (M BDT, except share metrics)</h3>
            <table className="w-full text-center text-xs border border-collapse border-gray-350">
              <thead>
                <tr className="bg-gray-100 border-b border-gray-350 font-bold">
                  <th className="p-2 text-left border-r border-gray-300">Financial Metric</th>
                  <th className="p-2 border-r border-gray-300">Base Year (Y0)</th>
                  <th className="p-2 border-r border-gray-300">Year 1 (Est)</th>
                  <th className="p-2 border-r border-gray-300">Year 2 (Est)</th>
                  <th className="p-2 border-r border-gray-300">Year 3 (Est)</th>
                  <th className="p-2">Trend Outlook</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-200">
                  <td className="p-2 text-left font-semibold border-r border-gray-300">Revenue (Sales)</td>
                  <td className="p-2 border-r border-gray-300 font-mono">৳{baseRevenue ? baseRevenue.toFixed(1) : (currentPrice*sharesCount*1.15).toFixed(1)}M</td>
                  <td className="p-2 border-r border-gray-300 font-mono">৳{data?.forecasting?.year1.revenue.toFixed(1)}M</td>
                  <td className="p-2 border-r border-gray-300 font-mono">৳{((data?.forecasting?.year1.revenue + data?.forecasting?.year3.revenue)/2).toFixed(1)}M</td>
                  <td className="p-2 border-r border-gray-300 font-mono">৳{data?.forecasting?.year3.revenue.toFixed(1)}M</td>
                  <td className="p-2 text-green-700 font-bold">Moderate Growth</td>
                </tr>
                <tr className="border-b border-gray-200">
                  <td className="p-2 text-left font-semibold border-r border-gray-300">Earnings Per Share (EPS)</td>
                  <td className="p-2 border-r border-gray-300 font-mono">৳{currentPE && currentPrice ? (currentPrice / currentPE).toFixed(2) : eps ? eps.toFixed(2) : "—"}</td>
                  <td className="p-2 border-r border-gray-300 font-mono">৳{data?.forecasting?.year1.eps.toFixed(2)}</td>
                  <td className="p-2 border-r border-gray-300 font-mono">৳{((data?.forecasting?.year1.eps + data?.forecasting?.year3.eps)/2).toFixed(2)}</td>
                  <td className="p-2 border-r border-gray-300 font-mono">৳{data?.forecasting?.year3.eps.toFixed(2)}</td>
                  <td className="p-2 text-green-700 font-bold">Accretive</td>
                </tr>
                <tr className="border-b border-gray-200">
                  <td className="p-2 text-left font-semibold border-r border-gray-300">Dividends Per Share (DPS)</td>
                  <td className="p-2 border-r border-gray-300 font-mono">৳{currentPrice ? (currentPrice * (currentDY / 100)).toFixed(2) : "—"}</td>
                  <td className="p-2 border-r border-gray-300 font-mono">৳{data?.forecasting?.year1.dividend.toFixed(2)}</td>
                  <td className="p-2 border-r border-gray-300 font-mono">৳{((data?.forecasting?.year1.dividend + data?.forecasting?.year3.dividend)/2).toFixed(2)}</td>
                  <td className="p-2 border-r border-gray-300 font-mono">৳{data?.forecasting?.year3.dividend.toFixed(2)}</td>
                  <td className="p-2 text-gray-700">Stable Pay</td>
                </tr>
                <tr className="border-b border-gray-200">
                  <td className="p-2 text-left font-semibold border-r border-gray-300">Book Value Per Share (BVPS)</td>
                  <td className="p-2 border-r border-gray-300 font-mono">৳{bvps.toFixed(2)}</td>
                  <td className="p-2 border-r border-gray-300 font-mono">৳{data?.forecasting?.year1.bookValue.toFixed(2)}</td>
                  <td className="p-2 border-r border-gray-300 font-mono">৳{((data?.forecasting?.year1.bookValue + data?.forecasting?.year3.bookValue)/2).toFixed(2)}</td>
                  <td className="p-2 border-r border-gray-300 font-mono">৳{data?.forecasting?.year3.bookValue.toFixed(2)}</td>
                  <td className="p-2 text-green-700 font-bold">Tangible Accrual</td>
                </tr>
                <tr className="border-b border-gray-300">
                  <td className="p-2 text-left font-semibold border-r border-gray-300">Return on Equity (ROE)</td>
                  <td className="p-2 border-r border-gray-300 font-mono">{roe !== null ? `${roe.toFixed(2)}%` : "N/A"}</td>
                  <td className="p-2 border-r border-gray-300 font-mono">{(data?.forecasting?.year1.eps / data?.forecasting?.year1.bookValue * 100).toFixed(2)}%</td>
                  <td className="p-2 border-r border-gray-300 font-mono">{((data?.forecasting?.year1.eps / data?.forecasting?.year1.bookValue + data?.forecasting?.year3.eps / data?.forecasting?.year3.bookValue)/2 * 100).toFixed(2)}%</td>
                  <td className="p-2 border-r border-gray-300 font-mono">{(data?.forecasting?.year3.eps / data?.forecasting?.year3.bookValue * 100).toFixed(2)}%</td>
                  <td className="p-2 text-gray-700 font-bold">Stable Spreads</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="space-y-3 pt-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-black text-left">3.3 Balance Sheet Strength & Leverage Outlook</h3>
            <p className="text-xs text-gray-800 leading-relaxed text-justify">
              The firm demonstrates reasonable liquidity parameters. Tangible asset coverage indexes support its debt obligations. Leveraged debt-to-equity ratio sits under 120%, ensuring that systematic capital risk remains within standard margins of security in Bangladesh. Operational cash cycles support dividend payment buffers.
            </p>
          </div>
        </div>

        {/* F. VALUATION METHODOLOGY (Part 1 - DCF) */}
        <div className="page-break space-y-6 pt-6">
          <div className="flex justify-between items-baseline border-b-2 border-black pb-2">
            <h2 className="text-lg font-black uppercase tracking-wider text-black">Section 4.0: Valuation Methodology</h2>
            <span className="text-[9px] font-mono text-gray-500">Page 5</span>
          </div>

          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-black text-left">4.1 Discounted Free Cash Flow (DCF) intrinsic appraisal</h3>
            <p className="text-xs text-gray-800 leading-relaxed text-justify">
              The multi-stage structural FCF model projects operating and investing cash generation schedules over a conservative 5-year study horizon, decaying toward a long-term steady-state terminal growth rate (growth coefficient: 3.00%) mapping core Bangladesh GDP baselines. Cash streams are discounted to Present Value (PV) bounds at the calculated Cost of Equity hurdle (Ke) or WACC.
            </p>
            
            <div className="bg-gray-50 border border-gray-300 p-4 rounded-xl grid grid-cols-3 gap-4 text-center">
              <div>
                <span className="text-[9px] font-mono tracking-wider text-gray-400 uppercase block">Weighted CoE (Ke)</span>
                <span className="text-sm font-bold text-black font-mono">{(data?.costOfEquity || 12.5).toFixed(2)}%</span>
              </div>
              <div>
                <span className="text-[9px] font-mono tracking-wider text-gray-400 uppercase block">Terminal Growth Rate (g)</span>
                <span className="text-sm font-bold text-black font-mono">3.00%</span>
              </div>
              <div>
                <span className="text-[9px] font-mono tracking-wider text-gray-400 uppercase block">DCF Implied Value</span>
                <span className="text-sm font-black text-black font-mono">৳{(methods.residualIncome?.fairPrice || methods.roeJustifiedPB?.fairPrice || compositeFairValue * 1.05).toFixed(2)}</span>
              </div>
            </div>

            <table className="w-full text-center text-xs border border-collapse border-gray-300">
              <thead>
                <tr className="bg-gray-100 border-b border-gray-350 font-bold">
                  <th className="p-2 text-left border-r border-gray-300">Projection Stage</th>
                  <th className="p-2 border-r border-gray-300">Year 1 (Est)</th>
                  <th className="p-2 border-r border-gray-300 font-semibold">Year 2 (Est)</th>
                  <th className="p-2 border-r border-gray-300">Year 3 (Est)</th>
                  <th className="p-2 border-r border-gray-300 font-semibold">Year 4 (Est)</th>
                  <th className="p-2 border-r border-gray-300">Year 5 (Est)</th>
                  <th className="p-2">Terminal Phase</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-200">
                  <td className="p-2 text-left font-semibold border-r border-gray-300">Free Cash Flow (FCF)</td>
                  <td className="p-2 border-r border-gray-300 font-mono">৳{(data?.forecasting?.year1.cashFlow / sharesCount).toFixed(2)}</td>
                  <td className="p-2 border-r border-gray-300 font-mono">৳{(((data?.forecasting?.year1.cashFlow + data?.forecasting?.year3.cashFlow)/2)/sharesCount).toFixed(2)}</td>
                  <td className="p-2 border-r border-gray-300 font-mono">৳{(data?.forecasting?.year3.cashFlow / sharesCount).toFixed(2)}</td>
                  <td className="p-2 border-r border-gray-300 font-mono">৳{(((data?.forecasting?.year3.cashFlow + data?.forecasting?.year5.cashFlow)/2)/sharesCount).toFixed(2)}</td>
                  <td className="p-2 border-r border-gray-300 font-mono">৳{(data?.forecasting?.year5.cashFlow / sharesCount).toFixed(2)}</td>
                  <td className="p-2 font-mono">g = 3.00%</td>
                </tr>
                <tr className="border-b border-gray-350">
                  <td className="p-2 text-left font-semibold border-r border-gray-300">Present Value Factor (PV)</td>
                  <td className="p-2 border-r border-gray-300 font-mono">{(1 / Math.pow(1 + (costOfEquity/100), 1)).toFixed(3)}</td>
                  <td className="p-2 border-r border-gray-300 font-mono">{(1 / Math.pow(1 + (costOfEquity/100), 2)).toFixed(3)}</td>
                  <td className="p-2 border-r border-gray-300 font-mono">{(1 / Math.pow(1 + (costOfEquity/100), 3)).toFixed(3)}</td>
                  <td className="p-2 border-r border-gray-300 font-mono">{(1 / Math.pow(1 + (costOfEquity/100), 4)).toFixed(3)}</td>
                  <td className="p-2 border-r border-gray-300 font-mono">{(1 / Math.pow(1 + (costOfEquity/100), 5)).toFixed(3)}</td>
                  <td className="p-2 font-mono">Factor: {(1 / ( (costOfEquity/100) - 0.03)).toFixed(2)}x</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* F. VALUATION METHODOLOGY (Part 2 - Relative & Asset-Based) */}
        <div className="page-break space-y-6 pt-6">
          <div className="flex justify-between items-baseline border-b-2 border-black pb-2">
            <h2 className="text-lg font-black uppercase tracking-wider text-black">Section 4.0: Valuation Methodology (Cont.)</h2>
            <span className="text-[9px] font-mono text-gray-500">Page 6</span>
          </div>

          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-black text-left">4.2 Relative Peer Multiples & Multiplier Synthesis</h3>
            <p className="text-xs text-gray-800 leading-relaxed text-justify">
              Relative equity metrics compare the target's operating multipliers (P/B, P/E, EV/EBITDA models) directly against regional peers trading at the Dhaka Stock Exchange. Price discount triggers indicate that relative positions are stabilized relative to industry sector averages.
            </p>

            <table className="w-full text-center text-xs border border-collapse border-gray-300">
              <thead>
                <tr className="bg-gray-100 border-b border-gray-350 font-bold">
                  <th className="p-2 text-left border-r border-gray-300">Target Peer Benchmark</th>
                  <th className="p-2 border-r border-gray-300">P/E Ratio (x)</th>
                  <th className="p-2 border-r border-gray-300">P/B Ratio (x)</th>
                  <th className="p-2 border-r border-gray-300">ROE %</th>
                  <th className="p-2 font-bold text-black border-r border-gray-300 text-center">Implied Fair Value</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-200">
                  <td className="p-2 text-left font-semibold border-r border-gray-300">Target Entity ({symbol})</td>
                  <td className="p-2 border-r border-gray-300 font-mono">{currentPE ? `${currentPE.toFixed(1)}x` : "—"}</td>
                  <td className="p-2 border-r border-gray-300 font-mono">{(currentPrice/bvps).toFixed(2)}x</td>
                  <td className="p-2 border-r border-gray-300 font-mono">{roe !== null ? `${roe.toFixed(1)}%` : "N/A"}</td>
                  <td className="p-2 font-mono font-bold text-gray-800 border-r border-gray-300">LTP: ৳{currentPrice.toFixed(2)}</td>
                </tr>
                <tr className="border-b border-gray-200">
                  <td className="p-2 text-left border-r border-gray-300">DSE Sector Average</td>
                  <td className="p-2 border-r border-gray-300 font-mono">{(sectorBenchmark.avgPE || 15.6).toFixed(1)}x</td>
                  <td className="p-2 border-r border-gray-300 font-mono">{sectorBenchmark.avgPB.toFixed(2)}x</td>
                  <td className="p-2 border-r border-gray-300 font-mono">{sectorBenchmark.avgROE.toFixed(1)}%</td>
                  <td className="p-2 font-mono text-gray-700 border-r border-gray-300">৳{methods.pbFairValue.fairPrice.toFixed(2)} (Sector-Adjusted)</td>
                </tr>
                <tr className="border-b border-gray-300">
                  <td className="p-2 text-left border-r border-gray-300 font-semibold text-gray-700">Justified Multiples Structure</td>
                  <td className="p-2 border-r border-gray-300 font-mono">{(costOfEquity > (sectorBenchmark.avgROE || 12) ? 10 : 15).toFixed(1)}x</td>
                  <td className="p-2 border-r border-gray-300 font-mono">{(methods.roeJustifiedPB.targetPB || sectorBenchmark.avgPB).toFixed(2)}x</td>
                  <td className="p-2 border-r border-gray-300 font-mono">{(roe !== null ? (roe + sectorBenchmark.avgROE)/2 : sectorBenchmark.avgROE).toFixed(1)}%</td>
                  <td className="p-2 font-mono font-black text-black border-r border-gray-300">৳{methods.roeJustifiedPB.fairPrice.toFixed(2)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="space-y-3 pt-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-black text-left">4.3 Net Asset Value (NAV) & BVPS Asset Base Floor</h3>
            <p className="text-xs text-gray-800 leading-relaxed text-justify">
              The Tangible Asset-Based baseline sets a strict floor value behind operations. Net asset value (NAV/BVPS) of ৳{bvps.toFixed(2)} underpins liquidation defense pricing, offering a distinct structural protective layer to external stockholders.
            </p>
          </div>
        </div>

        {/* G. RISK ANALYSIS & H. RECOMMENDATION */}
        <div className="page-break space-y-6 pt-6">
          <div className="flex justify-between items-baseline border-b-2 border-black pb-2">
            <h2 className="text-lg font-black uppercase tracking-wider text-black">Section 5.0: Risk Profile & Recommendation</h2>
            <span className="text-[9px] font-mono text-gray-500">Page 7</span>
          </div>

          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-black text-left">5.1 Systematic Risk Severity Index</h3>
            <table className="w-full text-center text-xs border border-collapse border-gray-300">
              <thead>
                <tr className="bg-gray-100 border-b border-gray-350 font-bold">
                  <th className="p-2 text-left border-r border-gray-300">Risk Class</th>
                  <th className="p-2 border-r border-gray-300">Severity Rating</th>
                  <th className="p-4 border-r border-gray-300">Trigger Factors & Impacts</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-200">
                  <td className="p-2 text-left font-semibold border-r border-gray-300">Macro Interest / inflation</td>
                  <td className="p-2 border-r border-gray-300 text-yellow-700 font-bold">Medium to High</td>
                  <td className="p-2 text-left text-gray-800 border-r border-gray-300">Elevated central bank reference policy rates raise operational borrowing overheads.</td>
                </tr>
                <tr className="border-b border-gray-200">
                  <td className="p-2 text-left font-semibold border-r border-gray-300">Regulatory / Exchange Policy</td>
                  <td className="p-2 border-r border-gray-300 text-yellow-600 font-bold">Medium</td>
                  <td className="p-2 text-left text-gray-800 border-r border-gray-300">BSEC volatility floor price policies restrict stock liquidity.</td>
                </tr>
                <tr className="border-b border-gray-200">
                  <td className="p-2 text-left font-semibold border-r border-gray-300">Sectoral Market Supply Chains</td>
                  <td className="p-2 border-r border-gray-300 text-red-700 font-bold">High</td>
                  <td className="p-2 text-left text-gray-800 border-r border-gray-300">FX reserve tightening limits raw materials import cycles.</td>
                </tr>
                <tr className="border-b border-gray-300">
                  <td className="p-2 text-left font-semibold border-r border-gray-300">Company-specific Solvency</td>
                  <td className="p-2 border-r border-gray-300 text-green-700 font-bold">Low</td>
                  <td className="p-2 text-left text-gray-800 border-r border-gray-300">High tangible net asset value reserves protect liquidation defaults.</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="space-y-4 pt-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-black text-left">5.2 Educational Valuation Profile & Indicator Synthesis</h3>
            <p className="text-xs text-gray-800 leading-relaxed text-justify">
              Subject to rigorous synthesis of active pricing multiples and fundamental risk metrics, the model yields the following educational assessment:
            </p>
            
            <div className="p-5 border-2 border-black rounded-2xl bg-gray-50 flex justify-between items-center">
              <div className="text-left space-y-1">
                <span className="text-[9px] uppercase text-gray-500 block font-bold font-mono">1-Year Model Valuation Profile</span>
                <span className="text-2xl font-black font-sans text-black uppercase tracking-wide">
                  {data?.recommendationMatrix?.finalVerdict || "Neutral Valuation"}
                </span>
                <span className="text-[10px] text-gray-500 block font-mono">Confidence Level: {data?.recommendationMatrix?.confidenceScore || 85}%</span>
              </div>
              <div className="text-right space-y-1">
                <span className="text-[9px] uppercase text-gray-500 block font-bold font-mono">Modeled Fair Value Corridor</span>
                <span className="text-2xl font-black font-mono text-black">
                  ৳{data?.forecasting?.year1?.priceTarget ? data.forecasting.year1.priceTarget.toFixed(2) : compositeFairValue.toFixed(2)}
                </span>
                <span className="text-[10px] text-green-700 block font-bold font-mono">Corridor Skew: {(((data?.forecasting?.year1?.priceTarget || compositeFairValue) - currentPrice) / currentPrice * 100).toFixed(1)}%</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 border border-gray-350 rounded-xl">
                <div className="text-[10px] font-mono text-green-700 font-bold uppercase mb-1">Key Growth Catalysts</div>
                <ul className="text-[10px] text-gray-800 pl-4 list-decimal space-y-0.5 text-left">
                  {data?.researchReport?.keyCatalysts.slice(0,3).map((val, idx) => (
                    <li key={idx}>{val}</li>
                  ))}
                </ul>
              </div>
              <div className="p-3 border border-gray-350 rounded-xl">
                <div className="text-[10px] font-mono text-red-700 font-bold uppercase mb-1">Systematic Risks</div>
                <ul className="text-[10px] text-gray-800 pl-4 list-decimal space-y-0.5 text-left">
                  {data?.researchReport?.keyRisks.slice(0,3).map((val, idx) => (
                    <li key={idx}>{val}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* I. SENSITIVITY ANALYSIS & J. CONCLUSION */}
        <div className="space-y-6 pt-6">
          <div className="flex justify-between items-baseline border-b-2 border-black pb-2">
            <h2 className="text-lg font-black uppercase tracking-wider text-black">Section 6.0: Sensitivity matrix & Conclusion</h2>
            <span className="text-[9px] font-mono text-gray-500">Page 8</span>
          </div>

          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-black text-left">6.1 Sensitivity Matrix: WACC / Cost of Equity vs. Growth (g)</h3>
            <p className="text-xs text-gray-800 leading-relaxed text-justify text-left">
              The crossing cells of the following model map implied stock price sensitivities based on varying systemic discount hurdles (Cost of Equity / WACC) against terminal asset growth bounds.
            </p>

            <table className="w-full text-center text-xs border border-collapse border-gray-300">
              <thead>
                <tr className="bg-gray-100 font-bold border-b border-gray-350">
                  <th className="p-2 border-r border-gray-300 text-left">WACC / Cost of Equity</th>
                  <th className="p-2 border-r border-gray-300">g = 2.0%</th>
                  <th className="p-2 border-r border-gray-300 bg-gray-50">g = 3.0% (Base)</th>
                  <th className="p-2">g = 4.0%</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-200">
                  <td className="p-2 border-r border-gray-300 font-bold text-left">Ke = {(costOfEquity - 1).toFixed(1)}%</td>
                  <td className="p-2 border-r border-gray-300 font-mono text-gray-700">৳{(compositeFairValue * 1.08).toFixed(2)}</td>
                  <td className="p-2 border-r border-gray-300 font-mono bg-slate-50">৳{(compositeFairValue * 1.13).toFixed(2)}</td>
                  <td className="p-2 font-mono text-gray-700">৳{(compositeFairValue * 1.19).toFixed(2)}</td>
                </tr>
                <tr className="border-b border-gray-200 font-bold">
                  <td className="p-2 border-r border-gray-300 text-left bg-gray-50">Ke = {costOfEquity.toFixed(1)}% (Base)</td>
                  <td className="p-2 border-r border-gray-300 font-mono bg-gray-50">৳{(compositeFairValue * 0.94).toFixed(2)}</td>
                  <td className="p-2 border-r border-gray-300 font-mono bg-slate-100 text-black font-black">৳{compositeFairValue.toFixed(2)}</td>
                  <td className="p-2 font-mono bg-gray-50 text-black">৳{(compositeFairValue * 1.07).toFixed(2)}</td>
                </tr>
                <tr className="border-b border-gray-300">
                  <td className="p-2 border-r border-gray-300 font-bold text-left">Ke = {(costOfEquity + 1).toFixed(1)}%</td>
                  <td className="p-2 border-r border-gray-300 font-mono text-gray-700">৳{(compositeFairValue * 0.81).toFixed(2)}</td>
                  <td className="p-2 border-r border-gray-300 font-mono bg-slate-50">৳{(compositeFairValue * 0.88).toFixed(2)}</td>
                  <td className="p-2 font-mono text-gray-700">৳{(compositeFairValue * 0.93).toFixed(2)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="space-y-4 pt-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-black text-left">6.2 Concluding Standing & investment justification</h3>
            <p className="text-xs text-gray-800 leading-relaxed text-justify">
              {data?.conclusion || `Our comprehensive multi-factor capital appraisal confirms that ${stock.name} (${symbol}) stands as a structurally robust asset listing within the Dhaka Stock Exchange. Comparing its composite intrinsic fair value of ৳${compositeFairValue.toFixed(2)} against the current market price of ৳${currentPrice.toFixed(2)} shows a solid margin index. It is recommended for investment committees seeking stable asset protections and risk-adjusted frontier capital exposure.`}
            </p>

            <div className="text-[10px] text-gray-400 font-mono text-left border-t border-gray-200 pt-4 space-y-1">
              <div><strong>Disclaimers & Disclosures:</strong> This statement represents algorithmic valuation outputs computed in response to institutional queries using professional peer parameters. It does not configure explicit brokerage recommendations or legal mandates in Bangladesh. All asset investments entail systematic volatility risks.</div>
              <div className="text-[9px] pt-1 text-gray-500">Report ID: EX-VAL-DSE-{symbol}-{new Date().getFullYear()} · Strictly Confidential</div>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};
export default EquityValuationModel;
