import React, { useState, useEffect } from "react";
import { StressTestResult, Holding } from "../../types";
import { Shield, ChevronDown, ChevronUp, AlertCircle, RefreshCw, Landmark } from "lucide-react";

interface Props {
  holdings: Holding[];
}

export const StressTesting: React.FC<Props> = ({ holdings }) => {
  const [data, setData] = useState<StressTestResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedScenario, setExpandedScenario] = useState<number | null>(null);

  const calculateStressTest = async () => {
    try {
      setLoading(true);
      setError(null);

      const mappedHoldings = holdings.map(h => ({
        symbol: h.symbol,
        quantity: h.quantity,
        buyPrice: h.buyPrice
      }));

      const res = await fetch("/api/portfolio/stress-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ holdings: mappedHoldings })
      });

      if (!res.ok) {
        throw new Error("Failed to compute stress test simulation.");
      }

      const json = await res.json();
      setData(json);
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    calculateStressTest();
  }, [holdings]);

  if (loading) {
    return (
      <div className="bg-slate-900 border border-slate-805 p-6 rounded-xl flex flex-col items-center justify-center min-h-[220px]">
        <RefreshCw className="animate-spin text-indigo-500 h-8 w-8 mb-2" />
        <span className="text-slate-400 font-mono text-sm">Running macroeconomic event modeling...</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-slate-900 border border-slate-805 p-6 rounded-xl text-center">
        <span className="text-red-400 font-mono text-sm">Failed to generate stress testing models</span>
      </div>
    );
  }

  // Risk Rating Configs
  const riskConfigs: Record<string, { badge: string; text: string; bg: string }> = {
    "Critical": { badge: "bg-red-500/20 text-red-400 border-red-505/30", text: "text-red-400", bg: "bg-red-955/20 border-red-900/30" },
    "High": { badge: "bg-orange-500/10 text-orange-400 border-orange-500/20", text: "text-orange-400", bg: "bg-orange-955/20 border-orange-900/10" },
    "Moderate": { badge: "bg-amber-500/10 text-amber-400 border-amber-500/20", text: "text-amber-400", bg: "bg-amber-955/10 border-amber-900/10" },
    "Low": { badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20", text: "text-emerald-400", bg: "bg-emerald-955/10 border-emerald-900/10" }
  };

  const activeRisk = riskConfigs[data.overallRiskRating] || riskConfigs["Low"];

  const toggleScenario = (idx: number) => {
    if (expandedScenario === idx) {
      setExpandedScenario(null);
    } else {
      setExpandedScenario(idx);
    }
  };

  const formatLoss = (loss: number) => {
    // Loss is negative or positive
    const cleanLoss = Math.abs(loss);
    if (cleanLoss === 0) return "৳0";
    if (cleanLoss >= 100000) return `৳${(loss < 0 ? "-" : "")}${(cleanLoss / 100000).toFixed(2)} Lakh`;
    return `৳${(loss < 0 ? "-" : "")}${cleanLoss.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  };

  return (
    <div id="stress-testing-module" className="bg-slate-900/40 border border-slate-800 p-6 rounded-xl space-y-6">
      
      {/* Title */}
      <div className="flex justify-between items-start">
        <div>
          <h4 className="font-sans font-medium text-slate-100 flex items-center gap-2">
            <Landmark className="h-4 w-4 text-indigo-400" />
            Macro Stress Testing & Hedging
          </h4>
          <p className="text-xs text-slate-400 mt-1">
            Simulating extreme macroeconomic event shocks across Bangladesh markets to analyze systemic drawdowns and portfolio defensive hedges
          </p>
        </div>
        <button 
          onClick={calculateStressTest}
          className="p-1 hover:bg-slate-800 rounded transition text-slate-400 hover:text-slate-200"
          title="Recalculate simulations"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Hero Summary Badge */}
      <div className={`p-4 rounded-lg border flex flex-col md:flex-row justify-between items-start md:items-center gap-4 ${activeRisk.bg}`}>
        <div className="space-y-1">
          <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest block">PORTFOLIO SHOCK TOLERANCE</span>
          <span className="text-base font-bold text-slate-200">
            Overall Vulnerability Threshold: <span className={activeRisk.text}>{data.overallRiskRating.toUpperCase()}</span>
          </span>
          <p className="text-xs text-slate-400 leading-relaxed font-sans">
            Evaluated by scanning maximum capital drawdowns under simulated interest rate increases, local BDT depreciation, and inflation expansions.
          </p>
        </div>
        <span className={`text-xs font-mono font-bold px-3 py-1.5 rounded border shadow-sm ${activeRisk.badge}`}>
          {data.overallRiskRating.toUpperCase()} RISK
        </span>
      </div>

      {/* Resilience Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-3 border border-slate-800 rounded-lg bg-slate-950/25 space-y-1">
          <span className="text-[10px] font-mono text-slate-500 uppercase block">MOST VULNERABLE HOLDINGS</span>
          <div className="flex gap-2 pt-1">
            {data.mostVulnerable.length > 0 ? (
              data.mostVulnerable.map((s, i) => (
                <span key={i} className="text-xs font-mono bg-rose-950/20 text-rose-455 px-2.5 py-1 rounded border border-rose-500/20 font-semibold">
                  {s}
                </span>
              ))
            ) : (
              <span className="text-xs text-slate-500 font-mono">No vulnerabilities flagged - fully hedged</span>
            )}
          </div>
        </div>

        <div className="p-3 border border-slate-800 rounded-lg bg-slate-950/25 space-y-1">
          <span className="text-[10px] font-mono text-slate-500 uppercase block">MOST RESILIENT SHOT SHIELDS</span>
          <div className="flex gap-2 pt-1">
            {data.mostResilient.length > 0 ? (
              data.mostResilient.map((s, i) => (
                <span key={i} className="text-xs font-mono bg-emerald-950/20 text-emerald-400 px-2.5 py-1 rounded border border-emerald-500/20 font-semibold">
                  {s}
                </span>
              ))
            ) : (
              <span className="text-xs text-slate-500 font-mono">No protective shields detected</span>
            )}
          </div>
        </div>
      </div>

      {/* List of Scenarios Accordion */}
      <div className="space-y-3">
        <span className="text-xs text-slate-400 font-mono block">MACRO MODEL SIMULATIONS</span>
        <div className="space-y-2.5">
          {data.scenarios.map((scen, idx) => {
            const isExpanded = expandedScenario === idx;
            const isLossPositive = scen.estimatedLoss >= 0;
            const percentColor = scen.portfolioImpact < 0 ? "text-rose-455" : scen.portfolioImpact > 0 ? "text-emerald-400" : "text-slate-400";

            return (
              <div 
                key={idx} 
                className="border border-slate-800 rounded-lg bg-slate-950/15 overflow-hidden transition-all"
              >
                {/* Header block click */}
                <div 
                  onClick={() => toggleScenario(idx)}
                  className="flex flex-col md:flex-row justify-between items-start md:items-center p-4 hover:bg-slate-900/30 cursor-pointer transition-colors gap-3"
                >
                  <div className="space-y-1 flex-1">
                    <span className="text-xs font-semibold text-slate-200 block">{scen.name}</span>
                    <p className="text-[11px] text-slate-450 leading-relaxed font-sans max-w-2xl">
                      {scen.description}
                    </p>
                  </div>

                  <div className="flex items-center gap-6 self-stretch justify-between md:self-auto shrink-0 border-t border-slate-800/40 md:border-t-0 pt-2.5 md:pt-0">
                    <div className="text-left md:text-right">
                      <span className="text-[9.5px] font-mono text-slate-550 block">ESTIMATED DROP</span>
                      <span className={`text-sm font-extrabold font-mono ${percentColor}`}>
                        {scen.portfolioImpact > 0 ? `+${scen.portfolioImpact}%` : `${scen.portfolioImpact}%`}
                      </span>
                    </div>

                    <div className="text-left md:text-right font-mono text-xs">
                      <span className="text-[9.5px] font-mono text-slate-550 block">VALUATION LOSS</span>
                      <span className={scen.estimatedLoss < 0 ? "text-rose-400" : "text-slate-300"}>
                        {formatLoss(scen.estimatedLoss)}
                      </span>
                    </div>

                    <div className="text-slate-500 pl-2">
                      {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </div>
                  </div>
                </div>

                {/* Expanded asset details layout */}
                {isExpanded && (
                  <div className="p-4 bg-slate-950/40 border-t border-slate-850 space-y-4 animate-fadeIn">
                    
                    {/* Resisters/vulnerabilities */}
                    <div className="grid grid-cols-2 gap-4 text-[11px] border-b border-slate-850 pb-3 font-mono">
                      <div className="p-2 bg-slate-900/20 rounded border border-slate-800">
                        <span className="text-slate-500 block">BEST RESISTING ASSET</span>
                        <span className="font-semibold text-emerald-400 mt-1 block font-sans">
                          {scen.bestResistingHolding}
                        </span>
                      </div>
                      <div className="p-2 bg-slate-900/20 rounded border border-slate-800">
                        <span className="text-slate-500 block">MOST CRITICAL EXPOSURE</span>
                        <span className="font-semibold text-rose-400 mt-1 block font-sans">
                          {scen.worstHolding}
                        </span>
                      </div>
                    </div>

                    {/* Holdings Table impact view list */}
                    <div className="space-y-2">
                      <span className="text-[10px] font-mono text-slate-500 tracking-wider uppercase block">IMPACT PROFILE PER ASSET</span>
                      <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
                        {scen.holdingImpacts.map((h, hIdx) => {
                          const hColor = h.impact < 0 ? "text-rose-400" : h.impact > 0 ? "text-emerald-455" : "text-slate-400";
                          return (
                            <div key={hIdx} className="bg-slate-900/20 p-2.5 rounded border border-slate-850/60 flex justify-between items-start gap-4 text-xs">
                              <div className="space-y-0.5">
                                <span className="font-mono font-bold text-slate-350">{h.symbol}</span>
                                <p className="text-[10.5px] text-slate-500 font-sans leading-normal">
                                  {h.reason}
                                </p>
                              </div>
                              <div className="text-right shrink-0 font-mono text-xs">
                                <span className={hColor}>{h.impact > 0 ? `+${h.impact}%` : `${h.impact}%`}</span>
                                <span className="block text-[10px] text-slate-500 mt-0.5">
                                  ৳{Math.abs(h.loss).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
};
