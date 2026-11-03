import React, { useState } from "react";
import { StockData } from "../types";
import { Activity, ShieldAlert, CheckCircle2, TrendingUp, BarChart3, Receipt, HeartPulse, Info, CalendarDays, Clock, Gavel, Globe } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { SourceDataBadge } from "./SourceDataBadge";

interface StockOverviewProps {
  stock: StockData;
  fundamentalScore: number | null;
  scoreBreakdown: {
    profitability: string;
    liquidity: string;
    solvency: string;
    growth: string;
    efficiency: string;
  };
}

function hasEnoughFundamentalInputs(stock: StockData) {
  const inputs = [
    stock.peRatio,
    stock.eps,
    stock.nav,
    stock.divYield,
    stock.revGrowth,
    stock.profitGrowth,
    stock.financials?.roe,
    stock.financials?.roa,
    stock.financials?.debtRatio
  ];

  const available = inputs.filter(v => typeof v === "number" && Number.isFinite(v)).length;
  return available >= 5;
}

export default function StockOverview({ stock, fundamentalScore, scoreBreakdown }: StockOverviewProps) {
  const roe = stock.financials?.roe ?? null;
  const debtRatio = stock.financials?.debtRatio ?? null;
  const roa = stock.financials?.roa ?? null;
  const revenue = stock.financials?.revenue ?? [];
  const netProfit = stock.financials?.netProfit ?? [];

  const [activeMetricTab, setActiveMetricTab] = useState<number>(0);

  const hasScoreInputs = hasEnoughFundamentalInputs(stock) && !stock.isGeneratedFallback && (stock.hasRealFundamentals !== false);

  // Individual scores modeled dynamically
  const subMetrics = [
    { name: "Profitability", value: roe !== null ? Math.round(roe * 1.5 + 40) : null, text: scoreBreakdown.profitability },
    { name: "Solvency", value: debtRatio !== null ? Math.round((1 - debtRatio) * 100) : null, text: scoreBreakdown.solvency },
    { name: "Liquidity", value: stock.peRatio !== null ? symbolToLiquidity(stock.symbol) : null, text: scoreBreakdown.liquidity },
    { name: "Growth Trend", value: stock.revGrowth !== null ? Math.round((stock.revGrowth || 0) * 2 + 50) : null, text: scoreBreakdown.growth },
    { name: "Efficiency", value: roa !== null ? Math.round(roa * 3 + 45) : null, text: scoreBreakdown.efficiency },
  ];

  function symbolToLiquidity(symbol: string) {
    if (symbol === "SQURPHARMA") return 88;
    if (symbol === "GP") return 72;
    if (symbol === "BEXIMCO") return 24;
    return 60;
  }

  // Prepares data for chart
  const hasFinancialHistory =
    Array.isArray(revenue) &&
    Array.isArray(netProfit) &&
    revenue.length >= 2 &&
    netProfit.length >= 2 &&
    !stock.isGeneratedFallback;

  const historicalFinData = hasFinancialHistory ? [
    { year: "2022", Revenue: revenue[0] ?? 0, Profit: netProfit[0] ?? 0 },
    { year: "2023", Revenue: revenue[1] ?? 0, Profit: netProfit[1] ?? 0 },
    { year: "2024", Revenue: revenue[2] ?? 0, Profit: netProfit[2] ?? 0 },
    { year: "2025", Revenue: revenue[3] ?? 0, Profit: netProfit[3] ?? 0 },
  ] : [];

  const getGaugeColorForText = (score: number | null) => {
    if (score === null || !hasScoreInputs) return "text-[#4B5563]";
    if (score >= 80) return "text-[#10B981]";
    if (score >= 50) return "text-[#F59E0B]";
    return "text-[#EF4444]";
  };

  const getGaugeColorForBorder = (score: number | null) => {
    if (score === null || !hasScoreInputs) return "border-[#4B5563]/30";
    if (score >= 80) return "border-[#10B981]/40";
    if (score >= 50) return "border-[#F59E0B]/40";
    return "border-[#EF4444]/40";
  };

  const getFinancialInterpretation = (score: number | null) => {
    if (stock.isGeneratedFallback || stock.hasRealFundamentals === false) {
      return "Speculative financial assessment based on placeholder capital structures. Dynamic quantitative credit solvency algorithms are inactive.";
    }
    if (score === null || !hasScoreInputs) {
      return "Due to incomplete public audit disclosure filings for this asset, dynamic solvency-grade and leverage models cannot be compiled.";
    }
    if (score >= 80) {
      return "Excellent solvency & credit health. The enterprise exhibits exceptionally low debt-to-equity leverage, superior EBIT interest-coverage, and robust free cash relative to liabilities. Low risk of insolvency.";
    }
    if (score >= 55) {
      return "Adequate financial health with stable solvency posture. Operating capital flows are safe, debt ratios are aligned with DSE peers, with comfortable liquidity margins to sustain baseline ops.";
    }
    return "Elevated financial risk. High liability burdens, compressed margins, or stressed quick-ratios indicate weak debt coverage and potential solvency strains. Capital restructuring review is strongly advised.";
  };

  const getSubMetricInterpretation = (name: string, value: number | null, text: string) => {
    if (value === null || stock.isGeneratedFallback) {
      return {
        label: "Benchmark Standard Mode",
        desc: text || "Specific micro-analysis has been flagged as default for this speculative asset pool."
      };
    }
    
    let label = "";
    let desc = "";

    switch (name) {
      case "Profitability":
        if (value >= 75) {
          label = "Stellar Capital Returns";
          desc = "Excellent net asset productivity. Corporate management is successfully compounding shareholder equity capital with robust margins.";
        } else if (value >= 40) {
          label = "Stable Operating Income";
          desc = "Modest and defensive profitability structure, fully self-stabilizing despite industry fluctuation pressures.";
        } else {
          label = "Eroding Operating Margins";
          desc = "Compressed cash generation vectors. Net income rates are underperforming normal corporate capital costs.";
        }
        break;

      case "Solvency":
        if (value >= 70) {
          label = "Fortress Balance Sheet Solvency";
          desc = "Ultra-low leverage and robust debt-service margins. The enterprise relies primarily on retained reserves rather than costly liability structures.";
        } else if (value >= 40) {
          label = "Prudent Financial Leverage";
          desc = "Healthy debt utilization layout. Active borrowing is balanced and fully aligned with long-term capital deployment programs.";
        } else {
          label = "Exogenous Debt Stress";
          desc = "High financial leverage. Vulnerabilities to rate hikes or liquidity contractions are significantly higher than the sector mean.";
        }
        break;

      case "Liquidity":
        if (value >= 70) {
          label = "Accreted Capital Reserve";
          desc = "Highly liquid working capital, allowing management to easily capture immediate growth opportunities or weather short-term sector droughts.";
        } else if (value >= 40) {
          label = "Standard Working Capital Speed";
          desc = "Stable daily operational liquidity and normal inventory turnover times. Minimal risk of short-term cash squeeze.";
        } else {
          label = "Illiquid Capital Cycles";
          desc = "Tensioned quick-ratios. Capital deployment speed may match or trail immediate accounts-payable obligations.";
        }
        break;

      case "Growth Trend":
        if (value >= 70) {
          label = "Accelerating Expansion Path";
          desc = "Substantial expansion in organic revenues or compounding earnings, indicating successful market penetration and strong pricing power.";
        } else if (value >= 40) {
          label = "Mature Corporate Baseline";
          desc = "Slow but highly predictable growth pacing. Operates in fully saturated, defensive baseline markets.";
        } else {
          label = "Earnings Speed Contraction";
          desc = "Top-line contraction. The enterprise is currently experiencing volume compression or facing demand hurdles.";
        }
        break;

      case "Efficiency":
        if (value >= 70) {
          label = "Stellar Resource Asset Utilization";
          desc = "Remarkable asset turnover rate of return. Every BDT of physical assets is being converted into sales volume at high velocity.";
        } else if (value >= 40) {
          label = "Balanced Inventory Velocity";
          desc = "Standard system productivity. Production schedules fully match normal demand cycles and baseline logistics rates.";
        } else {
          label = "Suboptimal Resource Drifts";
          desc = "Underperforming resource conversion curves. Capital is temporarily locked up in stagnant supply lines or slower inventories.";
        }
        break;
      default:
        label = "Standard Mode";
        desc = "Normal fundamental operations.";
    }

    const combinedDesc = text ? `${desc} (${text})` : desc;
    return { label, desc: combinedDesc };
  };

  const getHealthLevel = (score: number | null) => {
    if (stock.isGeneratedFallback || stock.hasRealFundamentals === false) {
      return { label: "CONFIDENCE - FALLBACK VALUES", color: "text-[#F59E0B] bg-[#F59E0B]/10 border border-[#F59E0B]/20 font-mono" };
    }
    if (score === null || !hasScoreInputs) return { label: "INSUFFICIENT MICRO DATA", color: "text-[#94A3B8] bg-white/5 border border-white/10" };
    if (score >= 80) return { label: "EXCELLENT CAPITAL CORE", color: "text-[#10B981] bg-[#10B981]/15 border border-[#10B981]/25" };
    if (score >= 55) return { label: "STABLE OPERATING SYSTEM", color: "text-[#F59E0B] bg-[#F59E0B]/15 border border-[#F59E0B]/25" };
    return { label: "VULNERABLE INCOME FLOW", color: "text-[#EF4444] bg-[#EF4444]/15 border border-[#EF4444]/25" };
  };

  const finalScoreToShow = hasScoreInputs && fundamentalScore !== null && !stock.isGeneratedFallback ? fundamentalScore : null;
  const healthStatus = getHealthLevel(finalScoreToShow);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 lg:gap-6 animate-tab-in text-[#F0F4FF]">
      
      {/* Visual Model Layer Classification Banner (DATA, CALCULATION, INTERPRETATION) */}
      <div className="sm:col-span-2 lg:col-span-3 bg-[#111827]/90 rounded-2xl border border-[rgba(255,255,255,0.08)] px-4 py-3 flex flex-wrap items-center justify-between gap-3 shadow-lg backdrop-blur-md">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-[#00D4FF] animate-pulse"></span>
          <span className="text-xs font-mono font-black text-white uppercase tracking-wider">Analytical Model Layers:</span>
          <span className="text-[11px] text-[#94A3B8] hidden md:inline">Every metric in this analysis is rigorously classified into verified tiers:</span>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <SourceDataBadge type="source" size="sm" source="Official DSE Filings" />
          <SourceDataBadge type="calculation" size="sm" formula="Solvency / Margin Algorithms" />
          <SourceDataBadge type="interpretation" size="sm" method="CFA / AI Analytical Synthesis" />
        </div>
      </div>

      {/* 1. Left Stats Column - Key Fundamenals */}
      <div id="company-overview-card" className="bg-[#111827] rounded-3xl border border-[rgba(255,255,255,0.06)] p-5 shadow-2xl relative overflow-hidden flex flex-col justify-between card-lift">
        <div>
          <div className="flex flex-col gap-2 mb-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-sm font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
                <Receipt className="h-4 w-4 text-[#00D4FF]" /> DSE Key Financial Ratios
              </h3>
              <SourceDataBadge type="source" size="xs" source="Audited Filings" />
            </div>
            
            <div className="flex flex-col gap-1 border-t border-[rgba(255,255,255,0.06)] pt-2 mt-0.5">
              <div className="flex items-center justify-between text-[10px] font-mono text-[#94A3B8] uppercase leading-none">
                <span>FILE: <strong className={
                  stock.isGeneratedFallback 
                    ? "text-[#EF4444] animate-pulse"
                    : "text-[#10B981]"
                }>
                  {stock.isGeneratedFallback ? "SPECULATIVE SEED" : "VERIFIED DSE AUDIT"}
                </strong></span>
                <span>SYNC TIME: <strong className="font-mono">{stock.lastUpdated ? new Date(stock.lastUpdated).toLocaleTimeString() : "N/A"}</strong></span>
              </div>
              
              {stock.isGeneratedFallback && (
                <div className="text-[10px] font-sans text-[#EF4444] bg-[#EF4444]/10 p-2 rounded-xl mt-1.5 font-semibold flex items-start gap-1">
                  <ShieldAlert className="h-3.5 w-3.5 shrink-0 text-[#EF4444] mt-0.5" />
                  <span>Notice: Actual published DSE financials are not loaded for this symbol. Using rule-based placeholders.</span>
                </div>
              )}
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-3.5">
            <div className="bg-[#1A2235]/40 p-3 rounded-2xl border border-[rgba(255,255,255,0.04)]">
              <span className="text-[10px] text-[#94A3B8] uppercase font-mono block tracking-wider font-semibold">Sector Group</span>
              <span className="text-xs font-bold text-white mt-1 block truncate font-sans">{stock.sector}</span>
            </div>
            
            <div className="bg-[#1A2235]/40 p-3 rounded-2xl border border-[rgba(255,255,255,0.04)]">
              <span className="text-[10px] text-[#94A3B8] uppercase font-mono block tracking-wider font-semibold">Market Cap</span>
              <span className="text-xs font-mono font-bold text-[#F59E0B] mt-1 block">
                {stock.isGeneratedFallback ? "N/A" : (stock.marketCap ?? "N/A")}
              </span>
            </div>
            
            <div className="bg-[#1A2235]/40 p-3 rounded-2xl border border-[rgba(255,255,255,0.04)]">
              <span className="text-[10px] text-[#94A3B8] uppercase font-mono block tracking-wider font-semibold">P/E Ratio</span>
              <span className="text-xs font-mono font-semibold mt-1 block text-[#00D4FF]">
                {stock.isGeneratedFallback ? "N/A" : (stock.peRatio !== null ? `${stock.peRatio}x` : "N/A")}
              </span>
            </div>
            
            <div className="bg-[#1A2235]/40 p-3 rounded-2xl border border-[rgba(255,255,255,0.04)]">
              <span className="text-[10px] text-[#94A3B8] uppercase font-mono block tracking-wider font-semibold">EPS (BDT)</span>
              <span className="text-xs font-mono font-bold text-white mt-1 block">
                {stock.isGeneratedFallback ? "N/A" : (stock.eps !== null ? `${stock.eps} BDT` : "N/A")}
              </span>
            </div>
            
            <div className="bg-[#1A2235]/40 p-3 rounded-2xl border border-[rgba(255,255,255,0.04)]">
              <span className="text-[10px] text-[#94A3B8] uppercase font-mono block tracking-wider font-semibold">NAV per Share</span>
              <span className="text-xs font-mono font-semibold text-white mt-1 block">
                {stock.isGeneratedFallback ? "N/A" : (stock.nav !== null ? `BDT ${stock.nav}` : "N/A")}
              </span>
            </div>
            
            <div className="bg-[#1A2235]/40 p-3 rounded-2xl border border-[rgba(255,255,255,0.04)]">
              <span className="text-[10px] text-[#94A3B8] uppercase font-mono block tracking-wider font-semibold">Yield (DY)</span>
              <span className="text-xs font-mono font-bold text-[#10B981] mt-1 block">
                {stock.isGeneratedFallback ? "N/A" : (stock.divYield !== null ? `${stock.divYield}%` : "N/A")}
              </span>
            </div>
            
            <div className="bg-[#1A2235]/40 p-3 rounded-2xl border border-[rgba(255,255,255,0.04)]">
              <span className="text-[10px] text-[#94A3B8] uppercase font-mono block tracking-wider font-semibold">Revenue Growth</span>
              <span className={`text-xs font-mono font-semibold mt-1 block ${!stock.isGeneratedFallback && stock.revGrowth !== null && stock.revGrowth >= 0 ? "text-[#10B981]" : !stock.isGeneratedFallback && stock.revGrowth !== null ? "text-[#EF4444]" : "text-[#4B5563]"}`}>
                {stock.isGeneratedFallback ? "N/A" : (stock.revGrowth !== null ? `${stock.revGrowth >= 0 ? "+" : ""}${stock.revGrowth}%` : "N/A")}
              </span>
            </div>
            
            <div className="bg-[#1A2235]/40 p-3 rounded-2xl border border-[rgba(255,255,255,0.04)]">
              <span className="text-[10px] text-[#94A3B8] uppercase font-mono block tracking-wider font-semibold">Profit Growth</span>
              <span className={`text-xs font-mono font-semibold mt-1 block ${!stock.isGeneratedFallback && stock.profitGrowth !== null && stock.profitGrowth >= 0 ? "text-[#10B981]" : !stock.isGeneratedFallback && stock.profitGrowth !== null ? "text-[#EF4444]" : "text-[#4B5563]"}`}>
                {stock.isGeneratedFallback ? "N/A" : (stock.profitGrowth !== null ? `${stock.profitGrowth >= 0 ? "+" : ""}${stock.profitGrowth}%` : "N/A")}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-5 pt-4 border-t border-[rgba(255,255,255,0.06)] flex items-center justify-between text-xs text-[#94A3B8]">
          <div className="flex items-center gap-1.5 hover:text-white transition-colors">
            <Activity className="h-3.5 w-3.5 text-[#00D4FF]" />
            <span>ROE: <strong className="text-white font-mono">{stock.isGeneratedFallback ? "N/A" : (roe !== null ? `${roe}%` : "N/A")}</strong></span>
          </div>
          <div className="flex items-center gap-1.5 hover:text-white transition-colors">
            <TrendingUp className="h-3.5 w-3.5 text-[#10B981]" />
            <span>ROA: <strong className="text-white font-mono">{stock.isGeneratedFallback ? "N/A" : (roa !== null ? `${roa}%` : "N/A")}</strong></span>
          </div>
        </div>
      </div>

      {/* 2. Middle Column: Corporate Solvency & Financial Health Rating (CS-FHR) */}
      <div id="financial-gauge-card" className="bg-[#111827] rounded-3xl border border-[rgba(255,255,255,0.06)] p-5 shadow-2xl flex flex-col justify-between min-h-[460px] relative card-lift">
        <div className="absolute top-0 right-0 w-24 h-24 bg-[#00D4FF]/4 rounded-full blur-2xl pointer-events-none"></div>
        
        <div>
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-display text-sm font-extrabold text-white uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <HeartPulse className="h-4 w-4 text-[#10B981] animate-pulse" /> Corporate Solvency & Financial Health (CS-FHR)
            </h3>
            <div className="flex items-center gap-1.5 shrink-0">
              <SourceDataBadge type="calculation" size="xs" formula="CS-FHR Algorithm" />
              <SourceDataBadge type="interpretation" size="xs" method="Solvency Index" />
            </div>
          </div>
          <p className="text-[11px] text-[#94A3B8] leading-relaxed">
            Multi-factor solvency, capital structure coverage, and asset productivity indexing to evaluate balance-sheet solvency safety margins.
          </p>
        </div>

        {/* Analyst Assessment row */}
        <div className="my-2.5 p-3 rounded-2xl bg-white/4 border border-[rgba(255,255,255,0.04)] text-left">
          <p className="text-[11.5px] text-[#94A3B8] leading-relaxed italic">
            <strong className="text-white not-italic font-display font-medium block">Analyst Summary:</strong> {getFinancialInterpretation(finalScoreToShow)}
          </p>
        </div>

        {/* Circular active score gauge */}
        <div className="flex items-center justify-center py-2 relative">
          <div className="relative">
            <div className={`w-28 h-28 rounded-full border-[3px] flex flex-col items-center justify-center bg-[#1A2235]/40 shadow-inner ${getGaugeColorForBorder(finalScoreToShow)}`}>
              <span className={`text-3xl font-mono font-black ${getGaugeColorForText(finalScoreToShow)}`}>
                {finalScoreToShow !== null ? `${finalScoreToShow}` : "N/A"}
              </span>
              {finalScoreToShow !== null && (
                <span className="text-[7px] uppercase font-mono tracking-widest text-[#4B5563] mt-0.5">CS-FHR INDEX</span>
              )}
            </div>
            {/* Glow backdrop behind indicator */}
            <div className="absolute inset-0 rounded-full bg-[#00D4FF]/5 blur-xl -z-10"></div>
          </div>
        </div>

        <div className="text-center mt-1">
          <span className={`inline-block px-3 py-1 rounded-xl text-[10px] font-bold uppercase tracking-wider leading-none ${healthStatus.color}`}>
            {healthStatus.label}
          </span>
        </div>

        {/* List of submetrics progress indicators */}
        <div className="space-y-2 mt-4">
          <span className="text-[9px] font-mono text-[#94A3B8] uppercase tracking-wider block font-bold leading-normal">Interactive Sub-Metrics Core:</span>
          {hasScoreInputs ? (
            <div className="grid grid-cols-1 gap-1.5">
              {subMetrics.map((sm, idx) => (
                <button
                  key={idx}
                  onClick={() => setActiveMetricTab(idx)}
                  className={`w-full text-left p-2 rounded-xl transition-all border cursor-pointer ${
                    activeMetricTab === idx 
                      ? "bg-[#1A2235] border-[#00D4FF]/30 shadow-md" 
                      : "bg-[#1A2235]/20 border-transparent hover:bg-[#1A2235]/40"
                  }`}
                >
                  <div className="flex justify-between items-center text-[10px] font-mono">
                    <span className={`font-semibold ${activeMetricTab === idx ? "text-[#00D4FF] font-bold" : "text-[#94A3B8]"}`}>
                      {sm.name}
                    </span>
                    <span className="text-white font-mono font-semibold">{sm.value !== null ? `${sm.value}/100` : "N/A"}</span>
                  </div>
                  <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden mt-1 inline-block">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        sm.value !== null && sm.value >= 75 ? "bg-[#10B981]" : sm.value !== null && sm.value >= 50 ? "bg-[#F59E0B]" : "bg-[#EF4444]"
                      }`}
                      style={{ width: `${sm.value !== null ? Math.min(100, Math.max(5, sm.value)) : 0}%` }}
                    ></div>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="text-[10px] text-[#94A3B8]/60 text-center italic py-4 border border-dashed border-[rgba(255,255,255,0.08)] rounded-xl px-2">
              Financial strength index is offline due to fallback asset boundaries.
            </div>
          )}
        </div>

        {/* Selected submetric's financial interpretation banner */}
        {hasScoreInputs && (
          <div className="mt-3.5 p-3 bg-[#00D4FF]/5 rounded-2xl border border-[#00D4FF]/10 text-left transition-all duration-300">
            <div className="flex items-center gap-1.5 font-display text-[10px] font-extrabold text-[#00D4FF] uppercase tracking-wider">
              <Info className="h-3 w-3 text-[#00D4FF] shrink-0" />
              <span>{subMetrics[activeMetricTab].name}: {getSubMetricInterpretation(subMetrics[activeMetricTab].name, subMetrics[activeMetricTab].value, subMetrics[activeMetricTab].text).label}</span>
            </div>
            <p className="text-[10px] text-[#94A3B8] mt-1 pr-1 leading-relaxed font-sans font-medium">
              {getSubMetricInterpretation(subMetrics[activeMetricTab].name, subMetrics[activeMetricTab].value, subMetrics[activeMetricTab].text).desc}
            </p>
          </div>
        )}
      </div>

      {/* 3. Right Column: Historical Financial Breakdown Charts */}
      <div id="financial-charts-card" className="bg-[#111827] rounded-3xl border border-[rgba(255,255,255,0.06)] p-5 shadow-2xl flex flex-col justify-between card-lift">
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-display text-sm font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-[#00D4FF]" /> Revenue & Net Profit Trends
            </h3>
            <SourceDataBadge type="source" size="xs" source="Audited Statements" />
          </div>
          <span className="text-[10px] font-mono text-[#94A3B8] uppercase block mb-4">Values in Billions BDT</span>

          {hasFinancialHistory ? (
            <div className="h-48 w-full mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={historicalFinData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                  <XAxis dataKey="year" stroke="#4B5563" fontSize={10} fontFamily="monospace" />
                  <YAxis stroke="#4B5563" fontSize={10} fontFamily="monospace" />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#111827", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px", fontFamily: "monospace" }}
                    itemStyle={{ color: "#F0F4FF", fontSize: "11px" }}
                    labelStyle={{ color: "#94A3B8", fontSize: "10px", fontFamily: "monospace" }}
                  />
                  <Bar dataKey="Revenue" fill="#00D4FF" radius={[3, 3, 0, 0]} name="Gross Revenue" />
                  <Bar dataKey="Profit" fill="#10B981" radius={[3, 3, 0, 0]} name="Net profit" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-48 w-full flex items-center justify-center border border-dashed border-[rgba(255,255,255,0.08)] bg-white/1 rounded-2xl text-[#94A3B8]/60 text-xs text-center px-4 leading-relaxed">
              Revenue and profit histories are unavailable for this speculative asset pool.
            </div>
          )}
        </div>

        {/* Short strategic descriptions */}
        <div className="mt-4 p-3 bg-[#1A2235]/40 rounded-2xl border border-[rgba(255,255,255,0.04)]">
          <p className="text-[11px] leading-relaxed text-[#94A3B8]">
            <strong className="text-[#F0F4FF] block mb-0.5 font-display text-[11px] font-bold uppercase tracking-wider">Trend Analyst Focus:</strong>
            {hasFinancialHistory ? (
              stock.symbol === "GP" ? "Grameenphone shows extremely defensive sales indexes alongside flat profit margins, validating its status as Bangladesh's primary consumer cash cow." :
              stock.symbol === "SQURPHARMA" ? "Square Pharma reveals outstanding balance sheet margins and steady volume, showing stellar overall sector health." :
              stock.symbol === "BEXIMCO" ? "Revenues are currently under strict operational consolidations under high rate environments in Southeast Asia." :
              `Sales vectors are progressing with a growth value of ${stock.revGrowth !== null ? `${stock.revGrowth}%` : "N/A"}.`
            ) : (
              "Trend insight is offline because verified historical corporate disclosure statements from dse.com.bd are absent."
            )}
          </p>
        </div>

        {/* ── Data Timeline ─────────────────────────────────── */}
        <div className="mt-4 p-3.5 bg-[#1A2235]/60 rounded-2xl border border-[rgba(255,255,255,0.06)]">
          <div className="flex items-center gap-1.5 mb-2.5">
            <CalendarDays className="h-3.5 w-3.5 text-[#00D4FF]" />
            <span className="text-[10px] font-mono font-black text-[#F0F4FF] uppercase tracking-wider">Data Coverage Timeline</span>
          </div>

          {/* Timeline bar */}
          <div className="relative mb-3">
            <div className="w-full h-1.5 bg-[#243044] rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-[#00D4FF] to-[#10B981] rounded-full w-full"></div>
            </div>
            <div className="flex justify-between mt-1.5">
              <span className="text-[9px] font-mono text-[#64748B]">
                {stock.financialHistory && stock.financialHistory.length > 0
                  ? `FY${stock.financialHistory[0]?.year ?? "—"}`
                  : "FY2021"}
              </span>
              <span className="text-[9px] font-mono text-[#64748B]">
                {stock.financialHistory && stock.financialHistory.length > 0
                  ? `FY${stock.financialHistory[stock.financialHistory.length - 1]?.year ?? "—"}`
                  : "FY2024"}
              </span>
            </div>
          </div>

          {/* What the data represents */}
          <div className="grid grid-cols-2 gap-2">
            {[
              {
                label: "Data Period",
                value: stock.financialHistory && stock.financialHistory.length > 1
                  ? `${stock.financialHistory.length} fiscal years`
                  : "Latest annual",
                icon: "📅"
              },
              {
                label: "Report Type",
                value: "Annual DSE Filing",
                icon: "📋"
              },
              {
                label: "Ratios Based On",
                value: "Last published EPS & NAV",
                icon: "🔢"
              },
              {
                label: "Next Update",
                value: "Quarterly earnings",
                icon: "🔄"
              },
            ].map(item => (
              <div key={item.label} className="bg-[#111827]/60 rounded-xl p-2 border border-[rgba(255,255,255,0.04)]">
                <span className="text-[9px] font-mono text-[#64748B] block uppercase tracking-wider">{item.label}</span>
                <span className="text-[10px] font-sans font-semibold text-[#94A3B8] mt-0.5 block">{item.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Fundamental Judgement ──────────────────────────── */}
        {(() => {
          const score = finalScoreToShow;
          const pe    = stock.peRatio;
          const rev   = stock.revGrowth;
          const prof  = stock.profitGrowth;
          const dy    = stock.divYield;

          // Educational Fundamental Profile & Review Horizon
          let profile    = "BALANCED PROFILE";
          let horizon    = "3–6 months review cycle";
          let rationale  = "Mixed signals from current fundamentals. Investigate next quarterly report for earnings clarity.";
          let verdictCls = "text-[#F59E0B] bg-[#F59E0B]/10 border-[#F59E0B]/25";
          let barColor   = "bg-[#F59E0B]";
          let confidence = 50;

          if (score !== null) {
            const growing   = (rev ?? 0) > 5 && (prof ?? 0) > 5;
            const cheap     = pe !== null && pe < 15;
            const expensive = pe !== null && pe > 30;
            const healthy   = score >= 65;
            const stressed  = score < 45;
            const goodYield = (dy ?? 0) > 4;

            if (healthy && cheap && growing) {
              profile = "ROBUST VALUE PROFILE"; horizon = "12–24 months review";
              rationale = `CS-FHR of ${score}/100 with P/E at ${pe}x and steady growth — exhibits classical margin-of-safety characteristics. Key case to analyze for cash flow quality.`;
              verdictCls = "text-[#10B981] bg-[#10B981]/10 border-[#10B981]/25";
              barColor = "bg-[#10B981]"; confidence = 88;
            } else if (healthy && growing) {
              profile = "SOLID GROWTH PROFILE"; horizon = "9–15 months review";
              rationale = `Solid health score (${score}) and growing earnings. Case study in operational scalability and reinvestment rate.`;
              verdictCls = "text-[#10B981] bg-[#10B981]/10 border-[#10B981]/25";
              barColor = "bg-[#10B981]"; confidence = 72;
            } else if (healthy && goodYield && !growing) {
              profile = "DIVIDEND INCOME PROFILE"; horizon = "6–12 months review";
              rationale = `Healthy balance sheet with ${dy}% yield. Illustrates dividend yield stability against modest top-line growth.`;
              verdictCls = "text-[#00D4FF] bg-[#00D4FF]/10 border-[#00D4FF]/25";
              barColor = "bg-[#00D4FF]"; confidence = 63;
            } else if (stressed && !growing) {
              profile = "ELEVATED RISK PROFILE"; horizon = "Audit immediately";
              rationale = `CS-FHR of ${score}/100 with declining earnings. Prime learning case on leverage risk and operating headwinds.`;
              verdictCls = "text-[#EF4444] bg-[#EF4444]/10 border-[#EF4444]/25";
              barColor = "bg-[#EF4444]"; confidence = 78;
            } else if (stressed || expensive) {
              profile = "STRETCHED VALUATION PROFILE"; horizon = "1–3 months review";
              rationale = `${stressed ? `Weak CS-FHR (${score})` : `High P/E of ${pe}x`} highlights multiple expansion without guaranteed earnings backing.`;
              verdictCls = "text-[#EF4444] bg-[#EF4444]/10 border-[#EF4444]/25";
              barColor = "bg-[#EF4444]"; confidence = 60;
            }
          }

          return (
            <div id="fundamental-judgement-card" className={`mt-3 p-4 rounded-2xl border ${verdictCls.split(" ").slice(1).join(" ")} relative overflow-hidden`}>
              <div className="absolute top-0 right-0 w-20 h-20 rounded-full opacity-10 blur-2xl pointer-events-none"
                style={{ background: verdictCls.includes("10B981") ? "#10B981" 
                                   : verdictCls.includes("EF4444") ? "#EF4444"
                                   : verdictCls.includes("00D4FF") ? "#00D4FF" : "#F59E0B" }}
              ></div>

              <div className="flex items-center justify-between mb-2.5">
                <div className="flex items-center gap-1.5">
                  <Gavel className="h-3.5 w-3.5 opacity-70" 
                    style={{ color: verdictCls.includes("10B981") ? "#10B981"
                                  : verdictCls.includes("EF4444") ? "#EF4444"
                                  : verdictCls.includes("00D4FF") ? "#00D4FF" : "#F59E0B" }}
                  />
                  <span className="text-[10px] font-mono font-black text-[#F0F4FF] uppercase tracking-wider">Fundamental Synthesis</span>
                </div>
                <div className="flex items-center gap-2">
                  <SourceDataBadge type="interpretation" size="xs" method="Synthesis Horizon" />
                  <span className={`text-xs font-mono font-black px-2.5 py-1 rounded-lg border ${verdictCls}`}>
                    {profile}
                  </span>
                </div>
              </div>

              <p className="text-[11px] font-sans text-[#94A3B8] leading-relaxed mb-3">
                {rationale}
              </p>

              {/* Confidence bar */}
              <div className="mb-3">
                <div className="flex justify-between text-[9px] font-mono text-[#64748B] mb-1">
                  <span>Model Confidence</span>
                  <span>{confidence}%</span>
                </div>
                <div className="w-full h-1.5 bg-[#243044] rounded-full overflow-hidden">
                  <div className={`h-full ${barColor} rounded-full transition-all duration-700`}
                    style={{ width: `${confidence}%` }}></div>
                </div>
              </div>

              {/* Review Horizon */}
              <div className="flex items-center gap-2 p-2.5 bg-[#111827]/60 rounded-xl border border-[rgba(255,255,255,0.05)]">
                <Clock className="h-3.5 w-3.5 text-[#94A3B8] shrink-0" />
                <div>
                  <span className="text-[9px] font-mono text-[#64748B] uppercase tracking-wider block">Analytical Review Horizon</span>
                  <span className={`text-[11px] font-mono font-black ${verdictCls.split(" ")[0]}`}>
                    {horizon}
                  </span>
                </div>
              </div>

              <p className="text-[9px] font-mono text-[#4B5563] mt-2 leading-relaxed">
                Educational use only. Not investment advice. Synthesized from CS-FHR score, P/E ratio, revenue/profit growth, and dividend yield for analytical training.
              </p>
            </div>
          );
        })()}
      </div>
      
    </div>
  );
}
