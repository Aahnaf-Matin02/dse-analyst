import React, { useState, useEffect } from "react";
import { RelativeVolumeResult } from "../../types";
import { BarChart3, AlertCircle, RefreshCw, TrendingUp, TrendingDown, Minus } from "lucide-react";

interface Props {
  symbol: string;
}

export const RelativeVolume: React.FC<Props> = ({ symbol }) => {
  const [data, setData] = useState<RelativeVolumeResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRelVol = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/signals/relative-volume/${symbol}`);
      if (!res.ok) {
        throw new Error("Failed to load relative volume statistics.");
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
    fetchRelVol();
  }, [symbol]);

  if (loading) {
    return (
      <div className="bg-slate-900 border border-slate-805 p-6 rounded-xl flex flex-col items-center justify-center min-h-[180px]">
        <RefreshCw className="animate-spin text-indigo-500 h-8 w-8 mb-2" />
        <span className="text-slate-400 font-mono text-sm">Quantifying trading velocity & correlation...</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-slate-900 border border-slate-805 p-6 rounded-xl text-center">
        <span className="text-red-400 font-mono text-sm">Failed to generate relative volume metrics</span>
      </div>
    );
  }

  // Define signal styles for relVol20 multiplier
  const getSignalStyle = (col: string) => {
    const val = data.relVol20;
    if (val >= 3.0) return { text: "text-rose-450 font-black glow-red", bg: "bg-rose-500/10 border-rose-500/20", label: "EXTREMELY HIGH VOLUME" };
    if (val >= 2.0) return { text: "text-orange-400 font-bold", bg: "bg-orange-500/10 border-orange-500/20", label: "VERY HIGH VOLUME (INSTITUTIONAL)" };
    if (val >= 1.5) return { text: "text-amber-400 font-semibold", bg: "bg-amber-500/10 border-amber-500/20", label: "ABOVE AVERAGE VOLUME" };
    if (val < 0.8) return { text: "text-sky-400/80 font-normal", bg: "bg-sky-500/5 border-sky-500/10", label: "BELOW AVERAGE VOLUME" };
    return { text: "text-slate-300 font-normal", bg: "bg-slate-500/5 border-slate-500/10", label: "NORMAL TRADING ACTIVITY" };
  };

  const statusStyle = getSignalStyle(data.volumeSignal);

  // Formatter for large numbers
  const formatShares = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(2)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const barTodayPercentage = Math.max(10, Math.min(100, (data.todayVolume / (data.avgVolume20D || 1)) * 50));
  const trendIcons = {
    "Rising": <TrendingUp className="h-4 w-4 text-emerald-400" />,
    "Falling": <TrendingDown className="h-4 w-4 text-rose-400" />,
    "Flat": <Minus className="h-4 w-4 text-slate-500" />
  };

  return (
    <div id="relative-volume-module" className="bg-slate-900/40 border border-slate-800 p-6 rounded-xl space-y-6">
      
      {/* Title */}
      <div className="flex justify-between items-start">
        <div>
          <h4 className="font-sans font-medium text-slate-100 flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-indigo-400" />
            Relative Volume Index (RVI)
          </h4>
          <p className="text-xs text-slate-400 mt-1">
            Detecting volume abnormalities to confirm or validate underlying price trends
          </p>
        </div>
        <button 
          onClick={fetchRelVol}
          className="p-1 hover:bg-slate-800 rounded transition text-slate-400 hover:text-slate-200"
          title="Refresh statistics"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Main Metric Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        
        {/* RV20D */}
        <div className={`p-4 border rounded-lg flex flex-col justify-between min-h-[110px] bg-slate-950/20 ${statusStyle.bg}`}>
          <div>
            <span className="text-[9.5px] font-mono text-slate-400 tracking-wider">RELATIVE VOLUME (20D)</span>
            <span className={`block text-3xl font-extrabold font-mono tracking-tight ${statusStyle.text} mt-1`}>
              {data.relVol20}x
            </span>
          </div>
          <span className="text-[10px] font-mono text-slate-400 block truncate mt-1">
            {statusStyle.label}
          </span>
        </div>

        {/* Real-time stats share volumes */}
        <div className="p-4 border border-slate-800 rounded-lg bg-slate-950/20 flex flex-col justify-between min-h-[110px]">
          <div>
            <span className="text-[9.5px] font-mono text-slate-400 tracking-wider">SHARE VOLUME PROFILE</span>
            <div className="mt-2 text-xs text-slate-300 space-y-1 font-mono">
              <div className="flex justify-between">
                <span className="text-slate-500">Today:</span>
                <span className="font-semibold text-slate-200">{formatShares(data.todayVolume)} shares</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">20D Avg:</span>
                <span className="text-slate-455">{formatShares(data.avgVolume20D)} shares</span>
              </div>
            </div>
          </div>
          <span className="text-[9.5px] font-mono text-slate-500">
            5D Short avg: {formatShares(data.avgVolume5D)} shares ({data.relVol5}x)
          </span>
        </div>

        {/* Volume Trend and Correlation */}
        <div className="p-4 border border-slate-800 rounded-lg bg-slate-950/20 flex flex-col justify-between min-h-[110px]">
          <div>
            <span className="text-[9.5px] font-mono text-slate-400 tracking-wider">ACTIVITY PROFILE</span>
            <div className="flex justify-between items-center mt-2.5">
              <span className="text-xs text-slate-500 font-mono">Volume Slope 10D:</span>
              <div className="flex items-center gap-1 bg-slate-800/40 px-2 py-0.5 rounded">
                {trendIcons[data.volumeTrend]}
                <span className="text-xs font-semibold text-slate-300 font-mono">{data.volumeTrend}</span>
              </div>
            </div>
          </div>
          <p className="text-[10px] text-slate-550 leading-relaxed font-mono">
            RVI evaluates institutional distribution zones vs retail buying pressure.
          </p>
        </div>

      </div>

      {/* Divergence banner warning */}
      {data.divergence && (
        <div className="bg-slate-950/50 border border-slate-800 p-4 rounded-lg flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-indigo-400 shrink-0 mt-0.5 animate-pulse" />
          <div className="text-xs">
            <span className="font-semibold font-mono text-slate-200 block">DIVERGENCE EVENT DETECTED</span>
            <p className="text-slate-400 leading-normal mt-0.5">{data.interpretation}</p>
          </div>
        </div>
      )}

      {/* Comparison visualization bar */}
      <div className="space-y-2 bg-slate-950/20 p-4 border border-slate-800/50 rounded-lg">
        <span className="text-xs text-slate-400 font-mono block">VOLUME FLOW COMPARATIVE BAR</span>
        <div className="space-y-4">
          {/* 20D Baseline */}
          <div className="space-y-1">
            <div className="flex justify-between text-[11px] text-slate-500 font-mono">
              <span>Historical 20-Day Baseline Average</span>
              <span>100%</span>
            </div>
            <div className="h-2.5 bg-slate-800/40 border border-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-slate-600 rounded-full" style={{ width: "50%" }}></div>
            </div>
          </div>

          {/* Today's volume bar relative to baseline */}
          <div className="space-y-1">
            <div className="flex justify-between text-[11px] font-mono">
              <span className="text-slate-350">Today's Cumulative Trading Volume</span>
              <span className={statusStyle.text}>{(data.relVol20 * 100).toFixed(0)}%</span>
            </div>
            <div className="h-2.5 bg-slate-800/40 border border-slate-800 rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all duration-500 ${
                  data.relVol20 >= 1.5 ? "bg-indigo-500" : "bg-slate-500"
                }`}
                style={{ width: `${barTodayPercentage}%` }}
              ></div>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};
