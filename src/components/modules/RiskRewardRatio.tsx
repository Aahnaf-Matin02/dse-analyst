import React, { useState, useEffect } from "react";
import { RiskRewardResult, RiskRewardCombination } from "../../types";
import { Scale, AlertTriangle, CheckCircle, RefreshCw } from "lucide-react";

interface Props {
  symbol: string;
}

export const RiskRewardRatio: React.FC<Props> = ({ symbol }) => {
  const [data, setData] = useState<RiskRewardResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRiskReward = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/signals/risk-reward/${symbol}`);
      if (!res.ok) {
        throw new Error("Failed to load risk/reward ratio tables.");
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
    fetchRiskReward();
  }, [symbol]);

  if (loading) {
    return (
      <div className="bg-slate-900 border border-slate-805 p-6 rounded-xl flex flex-col items-center justify-center min-h-[220px]">
        <RefreshCw className="animate-spin text-lime-500 h-8 w-8 mb-2" />
        <span className="text-slate-400 font-mono text-sm">Evaluating trade skews & combinations...</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-slate-900 border border-slate-805 p-6 rounded-xl text-center">
        <span className="text-red-400 font-mono text-sm">Failed to generate Risk/Reward analysis</span>
      </div>
    );
  }

  // Quality color mapping
  const qualityStyles: Record<string, { badge: string; text: string; bg: string }> = {
    "Excellent": { badge: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30", text: "text-emerald-400", bg: "bg-emerald-950/20" },
    "Good": { badge: "bg-teal-500/20 text-teal-400 border-teal-500/30", text: "text-teal-400", bg: "bg-teal-950/20" },
    "Acceptable": { badge: "bg-amber-500/25 text-amber-400 border-amber-500/30", text: "text-amber-400", bg: "bg-amber-950/20" },
    "Poor": { badge: "bg-red-500/20 text-red-500 border-red-505/20", text: "text-red-400", bg: "bg-red-950/15" }
  };

  const isBestCombinationAvailable = !!data.bestCombination;

  return (
    <div id="risk-reward-ratio-module" className="bg-slate-900/40 border border-slate-800 p-6 rounded-xl space-y-6">
      {/* Title */}
      <div className="flex justify-between items-start">
        <div>
          <h4 className="font-sans font-medium text-slate-100 flex items-center gap-2">
            <Scale className="h-4 w-4 text-lime-400" />
            Risk / Reward Ratio Analyzer
          </h4>
          <p className="text-xs text-slate-400 mt-1">
            Quantifying reward capture parameters relative to stop-out drawdowns across multiple setups
          </p>
        </div>
        <button 
          onClick={fetchRiskReward}
          className="p-1 hover:bg-slate-800 rounded transition text-slate-400 hover:text-slate-200"
          title="Recalculate ratios"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Warning/Alert if NO COMBINATION has RR >= 1.5 */}
      {data.bestCombination && data.bestCombination.ratio < 1.5 && (
        <div className="bg-rose-950/35 border border-rose-500/20 text-rose-300 p-4 rounded-lg flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-rose-450 shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <span className="font-semibold block">Sub-optimal Risk Skew Warning</span>
            <p className="text-rose-400/80 leading-normal">
              No mathematical combinations on this asset satisfy the minimum institutional safety parameter of <span className="font-semibold text-rose-300">1.50x Reward-to-Risk</span>. Current market coordinates represent severe entry congestion.
            </p>
          </div>
        </div>
      )}

      {/* Best setup highlighting block */}
      {data.bestCombination && (
        <div className={`p-4 border border-slate-800 rounded-lg flex flex-col md:flex-row justify-between items-start md:items-center gap-4 ${qualityStyles[data.bestCombination.quality]?.bg || ""}`}>
          <div className="space-y-1">
            <span className="text-[10px] font-mono text-slate-400 block tracking-wider uppercase">RECOMMENDED SETUP MATRIX</span>
            <span className="text-sm font-semibold text-slate-200">
              {data.bestCombination.entryType} ({data.bestCombination.stopType})
            </span>
            <p className="text-xs text-slate-400 leading-normal">
              Entering at ৳{data.bestCombination.entryPrice.toFixed(2)} with stop at ৳{data.bestCombination.stopPrice.toFixed(2)} vs target {data.bestCombination.target}
            </p>
          </div>

          <div className="flex items-center gap-4 shrink-0">
            <div className="text-left md:text-right">
              <span className="text-[10px] font-mono text-slate-550 block">RATIO (X:1)</span>
              <span className="text-2xl font-bold font-mono tracking-tight text-white">
                {data.bestCombination.ratio.toFixed(2)}
              </span>
            </div>
            <span className={`text-[11px] font-mono font-semibold px-2.5 py-1 rounded border ${qualityStyles[data.bestCombination.quality]?.badge}`}>
              {data.bestCombination.quality.toUpperCase()}
            </span>
          </div>
        </div>
      )}

      {/* Recommendation statement block */}
      <div className="p-3.5 bg-slate-950/40 border border-slate-800/60 rounded text-xs text-slate-300 leading-relaxed font-sans">
        {data.recommendation}
      </div>

      {/* Combination Comparative Matrix Table */}
      <div className="space-y-3">
        <span className="text-xs text-slate-400 font-mono block">ALL EXPERIMENTAL SETUPS COMPARED</span>
        <div className="overflow-x-auto border border-slate-800 rounded-lg">
          <table className="w-full text-xs text-left text-slate-300 border-collapse">
            <thead className="text-[10px] font-mono text-slate-500 uppercase bg-slate-950/60 border-b border-slate-800">
              <tr>
                <th className="p-3">Setup Params</th>
                <th className="p-3">Target Level</th>
                <th className="p-3">Points Stop / Gained</th>
                <th className="p-3 text-right font-mono">Ratio</th>
                <th className="p-3 text-center">Security Rating</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/40 bg-slate-950/10">
              {data.combinations.map((c, i) => {
                const isBest = data.bestCombination && 
                  data.bestCombination.entryType === c.entryType && 
                  data.bestCombination.stopType === c.stopType && 
                  data.bestCombination.targetPrice === c.targetPrice;

                return (
                  <tr 
                    key={i} 
                    className={`hover:bg-slate-850/20 transition-colors ${
                      isBest ? "bg-slate-800/20 font-medium" : ""
                    }`}
                  >
                    <td className="p-3 text-slate-300">
                      <div className="flex flex-col">
                        <span>{c.entryType}</span>
                        <span className="text-[10.5px] text-slate-500 font-mono">
                          Entry: ৳{c.entryPrice} · Stop: ৳{c.stopPrice}
                        </span>
                      </div>
                    </td>
                    <td className="p-3 text-slate-350">
                      <div className="flex flex-col">
                        <span>{c.target}</span>
                        <span className="text-[10px] text-slate-500 font-mono">Target: ৳{c.targetPrice}</span>
                      </div>
                    </td>
                    <td className="p-3 text-slate-400 font-mono text-[11px]">
                      Risk: -৳{c.risk.toFixed(1)} / Gain: +৳{c.reward.toFixed(1)}
                    </td>
                    <td className="p-3 text-right font-mono font-semibold text-slate-100">
                      {c.ratio.toFixed(2)}x
                    </td>
                    <td className="p-3 text-center">
                      <span className={`inline-block text-[10px] font-mono px-2 py-0.5 rounded border ${qualityStyles[c.quality]?.badge}`}>
                        {c.quality}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
