import React, { useState, useEffect } from "react";
import { BreakoutResult } from "../../types";
import { Zap, Compass, RefreshCw } from "lucide-react";

interface Props {
  symbol: string;
}

export const BreakoutScore: React.FC<Props> = ({ symbol }) => {
  const [data, setData] = useState<BreakoutResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchScore = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/signals/breakout/${symbol}`);
      if (!res.ok) {
        throw new Error("Failed to load breakout technical scorer.");
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
    fetchScore();
  }, [symbol]);

  if (loading) {
    return (
      <div className="bg-slate-900 border border-slate-805 p-6 rounded-xl flex flex-col items-center justify-center min-h-[220px]">
        <RefreshCw className="animate-spin text-cyan-500 h-8 w-8 mb-2" />
        <span className="text-slate-400 font-mono text-sm">Measuring technical energy build...</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-slate-900 border border-slate-805 p-6 rounded-xl text-center">
        <span className="text-red-400 font-mono text-sm">Failed to generate Breakout Score details</span>
      </div>
    );
  }

  // Define signal styles
  const signalConfigs: Record<string, { color: string; bg: string; text: string; glow: string }> = {
    "Imminent Breakout": { color: "bg-cyan-500", bg: "bg-cyan-950/40", text: "text-cyan-400", glow: "shadow-cyan-500/20 shadow-lg border-cyan-500/40 animate-pulse" },
    "Breakout Building": { color: "bg-emerald-500", bg: "bg-emerald-950/20", text: "text-emerald-400", glow: "border-emerald-500/30" },
    "Consolidating": { color: "bg-amber-500", bg: "bg-amber-950/20", text: "text-amber-400", glow: "border-amber-500/20" },
    "No Setup": { color: "bg-slate-500", bg: "bg-slate-950/25", text: "text-slate-400", glow: "border-slate-800" },
    "Breakdown Risk": { color: "bg-rose-500", bg: "bg-rose-950/30", text: "text-rose-450", glow: "shadow-rose-500/15 shadow-md border-rose-500/30 font-semibold" }
  };

  const currentConf = signalConfigs[data.signal] || signalConfigs["No Setup"];

  return (
    <div id="breakout-score-module" className="bg-slate-900/40 border border-slate-800 p-6 rounded-xl space-y-6">
      
      {/* Title */}
      <div className="flex justify-between items-start">
        <div>
          <h4 className="font-sans font-medium text-slate-100 flex items-center gap-2">
            <Zap className="h-4 w-4 text-cyan-400" />
            Vibe Breakout Scorer (VBS)
          </h4>
          <p className="text-xs text-slate-400 mt-1">
            Analyzing volatility squeeze compressions and price tests of key technical levels (scale 0-100)
          </p>
        </div>
        <button 
          onClick={fetchScore}
          className="p-1 hover:bg-slate-800 rounded transition text-slate-400 hover:text-slate-200"
          title="Refresh calculations"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Hero display block */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
        
        {/* Progress or Score circle gauge */}
        <div className="col-span-1 md:col-span-5 flex flex-col items-center justify-center p-5 border border-slate-800 rounded-lg bg-slate-950/30 text-center">
          <span className="text-[10px] font-mono text-slate-500 tracking-wider">BREAKOUT STRENGTH</span>
          
          {/* Visual numeric indicator */}
          <div className="relative flex items-center justify-center my-4 h-24 w-24">
            <svg className="absolute -rotate-90 transform h-24 w-24">
              <circle
                cx="48"
                cy="48"
                r="40"
                stroke="#1e293b"
                strokeWidth="6"
                fill="transparent"
              />
              <circle
                cx="48"
                cy="48"
                r="40"
                stroke={data.breakoutScore >= 60 ? "#06b6d4" : data.breakoutScore >= 40 ? "#f59e0b" : "#f43f5e"}
                strokeWidth="6"
                fill="transparent"
                strokeDasharray="251.2"
                strokeDashoffset={251.2 - (251.2 * data.breakoutScore) / 100}
                className="transition-all duration-1000 ease-out"
              />
            </svg>
            <span className="text-3xl font-extrabold font-mono text-slate-100">{data.breakoutScore}</span>
          </div>

          <span className={`text-xs px-2.5 py-1 rounded border font-mono font-medium tracking-tight ${currentConf.bg} ${currentConf.text} ${currentConf.glow}`}>
            {data.signal.toUpperCase()}
          </span>
        </div>

        {/* Interpretations and metadata */}
        <div className="col-span-1 md:col-span-12 lg:col-span-7 space-y-4">
          <div className="space-y-1">
            <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wide">ANALYST REPORT SUMMARY</span>
            <p className="text-xs text-slate-300 leading-relaxed font-sans">
              {data.interpretation}
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3 pt-2">
            <div className="bg-slate-950/30 p-2.5 border border-slate-800 rounded text-center">
              <span className="text-[9px] font-mono text-slate-500 block">PROXIMITY TO R1</span>
              <span className="text-sm font-semibold font-mono text-slate-200 mt-1 block">
                {data.proximityToR1}%
              </span>
            </div>
            <div className="bg-slate-950/30 p-2.5 border border-slate-800 rounded text-center">
              <span className="text-[9px] font-mono text-slate-500 block">BANDWIDTH WIDTH</span>
              <span className="text-sm font-semibold font-mono text-slate-200 mt-1 block">
                {data.bandWidth}%
              </span>
            </div>
            <div className="bg-slate-950/30 p-2.5 border border-slate-800 rounded text-center">
              <span className="text-[9px] font-mono text-slate-500 block">RESISTANCE TESTS</span>
              <span className="text-sm font-semibold font-mono text-slate-200 mt-1 block">
                {data.resistanceTests}x
              </span>
            </div>
          </div>
        </div>

      </div>

      {/* Component progress breakdown list */}
      <div className="space-y-3 border-t border-slate-800 pt-5">
        <span className="text-xs text-slate-400 font-mono block">BREAKOUT SCORE WEIGHT CONTRIBUTIONS</span>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
          
          {/* Proximity */}
          <div className="space-y-1 bg-slate-950/20 p-3 rounded border border-slate-800/40">
            <div className="flex justify-between text-slate-450">
              <span>Proximity to resistance</span>
              <span className="text-slate-300">{data.components.proximity || 0}/25 pts</span>
            </div>
            <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-cyan-500" style={{ width: `${((data.components.proximity || 0) / 25) * 100}%` }}></div>
            </div>
          </div>

          {/* Squeeze */}
          <div className="space-y-1 bg-slate-950/20 p-3 rounded border border-slate-800/40">
            <div className="flex justify-between text-slate-450">
              <span>Volatility Squeeze</span>
              <span className="text-slate-300">{data.components.squeeze || 0}/20 pts</span>
            </div>
            <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-cyan-500" style={{ width: `${((data.components.squeeze || 0) / 20) * 100}%` }}></div>
            </div>
          </div>

          {/* Volume */}
          <div className="space-y-1 bg-slate-950/20 p-3 rounded border border-slate-800/40">
            <div className="flex justify-between text-slate-450">
              <span>Volume Confirmation</span>
              <span className="text-slate-300">{data.components.volume || 0}/20 pts</span>
            </div>
            <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-cyan-500" style={{ width: `${((data.components.volume || 0) / 20) * 100}%` }}></div>
            </div>
          </div>

          {/* Tests */}
          <div className="space-y-1 bg-slate-950/20 p-3 rounded border border-slate-800/40">
            <div className="flex justify-between text-slate-450">
              <span>Resistance test density</span>
              <span className="text-slate-300">{data.components.resistanceTests || 0}/20 pts</span>
            </div>
            <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-cyan-500" style={{ width: `${((data.components.resistanceTests || 0) / 20) * 100}%` }}></div>
            </div>
          </div>

        </div>
      </div>

    </div>
  );
};
