import React, { useState, useEffect } from "react";
import { Flame, RefreshCw, Info, Percent, Sparkles, TrendingUp, TrendingDown, ArrowRight } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface VolatileStock {
  symbol: string;
  name: string;
  price: number;
  changePercent: number;
  currentVariance: number;
  historicalVariance30d: number;
  volRatio: number;
}

interface SectorVolatility {
  sector: string;
  componentCount: number;
  avgPrice: number;
  avgChangePercent: number;
  intradayVariance: number;
  historicalVariance30d: number;
  volatilityRatio: number;
  priceSma30: number;
  priceDeviationFromSma30: number;
  topVolatileStocks: VolatileStock[];
}

interface Props {
  onSelectSymbol?: (symbol: string) => void;
}

export const SectorVolatilityHeatmap: React.FC<Props> = ({ onSelectSymbol }) => {
  const [data, setData] = useState<SectorVolatility[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSec, setSelectedSec] = useState<SectorVolatility | null>(null);

  const fetchVolatilityData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/market/sectors/volatility");
      if (!res.ok) {
        throw new Error("Failed to load DSE sector volatility matrix");
      }
      const json = await res.json();
      setData(json);
      if (json.length > 0) {
        // Set first sector as default selected details
        setSelectedSec(json[0]);
      }
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVolatilityData();
  }, []);

  const getHeatmapColorClass = (ratio: number) => {
    if (ratio >= 1.5) {
      return {
        bg: "bg-rose-950/20 hover:bg-rose-955/35 border-rose-500/25 text-rose-300",
        badge: "bg-rose-500/10 text-rose-400 border-rose-500/20",
        label: "Spike",
        glow: "shadow-[inset_0_0_12px_rgba(244,63,94,0.06)]"
      };
    }
    if (ratio >= 1.2) {
      return {
        bg: "bg-amber-950/15 hover:bg-amber-950/25 border-amber-500/25 text-amber-300",
        badge: "bg-amber-500/10 text-amber-400 border-amber-500/20",
        label: "Elevated",
        glow: "shadow-[inset_0_0_12px_rgba(245,158,11,0.04)]"
      };
    }
    if (ratio >= 0.8) {
      return {
        bg: "bg-emerald-950/10 hover:bg-emerald-955/20 border-emerald-500/20 text-emerald-300",
        badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
        label: "Normal",
        glow: ""
      };
    }
    return {
      bg: "bg-blue-955/10 hover:bg-blue-955/20 border-[#3b82f6]/15 text-blue-300",
      badge: "bg-blue-500/10 text-blue-400 border-blue-550/20",
      label: "Subdued",
      glow: ""
    };
  };

  if (loading) {
    return (
      <div className="bg-[#111827] border border-[rgba(255,255,255,0.06)] rounded-3xl p-8 flex flex-col items-center justify-center min-h-[320px]">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-[#00D4FF] border-r-2 mb-4" />
        <p className="text-xs text-[#94A3B8] font-mono">Computing intraday variances vs 30-day moving summaries...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-[#111827] border border-[rgba(255,255,255,0.06)] rounded-3xl p-8 flex flex-col items-center justify-center min-h-[200px] text-center">
        <span className="text-rose-400 font-mono text-sm">Failed to generate DSE volatility heat map</span>
        <button 
          onClick={fetchVolatilityData}
          className="mt-4 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-mono text-xs rounded-xl border border-slate-700 select-none cursor-pointer"
        >
          Retry Calculation
        </button>
      </div>
    );
  }

  return (
    <div className="bg-[#111827] border border-[rgba(255,255,255,0.06)] rounded-3xl p-6 shadow-2xl relative overflow-hidden flex flex-col gap-6" id="volatility-heatmap-card">
      {/* Background glow effects */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-[#00D4FF]/3 rounded-full blur-3xl pointer-events-none -z-10"></div>
      
      {/* Header section */}
      <div className="border-b border-[rgba(255,255,255,0.06)] pb-5">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-[#00D4FF]/10 rounded-xl border border-[#00D4FF]/20">
                <Flame className="h-4.5 w-4.5 text-[#00D4FF]" />
              </div>
              <div>
                <span className="text-[9px] font-mono text-[#00D4FF] tracking-widest uppercase font-black block">HEAT MAP INDICES</span>
                <h3 className="font-display text-sm font-extrabold text-white uppercase tracking-wider">
                  🔥 Sectoral Volatility Heat Map
                </h3>
              </div>
            </div>
            <p className="text-[11px] text-[#94A3B8] leading-normal font-sans pt-1">
              Compares today's average intraday trading range (high vs low spread) against the 30-day historical moving average of sector variance. Spoking ratios indicate localized liquidity flows and breakout momentum.
            </p>
          </div>
          
          <button
            onClick={fetchVolatilityData}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-mono font-bold border border-[rgba(255,255,255,0.08)] bg-[#1A2235] text-[#94A3B8] hover:bg-[#243044] hover:text-[#F0F4FF] transition-all cursor-pointer select-none"
            title="Recalculate Volatilities"
          >
            <RefreshCw className="h-3 w-3" />
            <span>RECOMPUTE</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Heatmap + Detailed Insight Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Aspect: The Heatmap Matrix */}
        <div className="lg:col-span-8 space-y-3">
          <span className="text-[10px] font-mono text-[#94A3B8] uppercase block tracking-wider font-bold">
            DSE Sectors Volatility Ratio Grid (Current vs 30d SMA Volatility)
          </span>
          
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
            {data.map((sec) => {
              const styles = getHeatmapColorClass(sec.volatilityRatio);
              const isSelected = selectedSec?.sector === sec.sector;

              return (
                <motion.div
                  key={sec.sector}
                  onClick={() => setSelectedSec(sec)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer relative flex flex-col justify-between h-[100px] ${styles.bg} ${styles.glow} ${
                    isSelected 
                      ? "border-l-4 border-l-[#00D4FF] bg-[#1A2235]/65 ring-1 ring-[#00D4FF]/30 border-white/20" 
                      : "border-transparent text-opacity-95"
                  }`}
                >
                  <div>
                    <div className="flex justify-between items-start gap-1">
                      <span className="font-sans font-extrabold text-[11px] text-white tracking-wide truncate leading-tight block w-[70%]">
                        {sec.sector}
                      </span>
                      <span className={`px-1.5 py-0.5 rounded text-[8px] font-mono font-black border uppercase ${styles.badge} shrink-0`}>
                        {styles.label}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-[#64748B] block mt-0.5">
                      {sec.componentCount} assets
                    </span>
                  </div>

                  <div className="flex justify-between items-baseline mt-2 pt-1 border-t border-[rgba(255,255,255,0.03)]">
                    <span className="text-[9px] font-mono text-[#94A3B8] leading-none uppercase">Vol ratio</span>
                    <span className="text-xs font-mono font-black text-white flex items-baseline gap-0.5">
                      {sec.volatilityRatio.toFixed(2)}x
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Guide Legend */}
          <div className="flex flex-wrap gap-4 items-center justify-start bg-[#1A2235]/40 border border-[rgba(255,255,255,0.04)] py-2.5 px-4 rounded-xl mt-4">
            <span className="text-[9px] font-mono text-[#64748B] uppercase tracking-wider">INDICATOR GUIDE</span>
            <div className="flex items-center gap-1.5 text-[10px] font-mono text-rose-400">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500/20 border border-rose-500/40"></span>
              <span>Spike (&gt;1.5x SMA)</span>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] font-mono text-amber-400">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500/20 border border-amber-500/40"></span>
              <span>Elevated (&gt;1.2x SMA)</span>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] font-mono text-emerald-400">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/20 border border-emerald-500/40"></span>
              <span>Normal</span>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] font-mono text-blue-400">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500/20 border border-blue-500/40"></span>
              <span>Subdued</span>
            </div>
          </div>
        </div>

        {/* Right Aspect: Contextual constituents breakdown in chosen Sector */}
        <div className="lg:col-span-4 flex flex-col h-full justify-between">
          <AnimatePresence mode="wait">
            {selectedSec ? (
              <motion.div
                key={selectedSec.sector}
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                className="bg-[#1A2235]/40 border border-[rgba(255,255,255,0.06)] rounded-2xl p-5 space-y-4 flex flex-col justify-between h-full"
              >
                {/* Sector stats card header */}
                <div className="border-b border-[rgba(255,255,255,0.06)] pb-3">
                  <div className="flex items-baseline justify-between">
                    <h4 className="font-display text-sm font-extrabold text-white uppercase tracking-wider truncate">
                      📊 {selectedSec.sector}
                    </h4>
                    <span className="text-[10px] font-mono text-[#00D4FF] tracking-wide">
                      {selectedSec.componentCount} Stocks
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs mt-2">
                    <span className="text-[#94A3B8]">Avg Return today:</span>
                    <span className={`font-mono font-bold flex items-center gap-0.5 ${
                      selectedSec.avgChangePercent >= 0 ? "text-emerald-400" : "text-rose-400"
                    }`}>
                      {selectedSec.avgChangePercent >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                      {selectedSec.avgChangePercent >= 0 ? "+" : ""}{selectedSec.avgChangePercent}%
                    </span>
                  </div>
                </div>

                {/* Diagnostics analysis */}
                <div className="space-y-3 py-1">
                  <div>
                    <span className="text-[9px] font-mono text-[#64748B] uppercase tracking-wider block">Intraday Volatility Ratio</span>
                    <div className="flex items-baseline gap-1.5 mt-1">
                      <span className="text-xl font-mono font-black text-white">
                        {selectedSec.volatilityRatio.toFixed(2)}x
                      </span>
                      <span className="text-[10px] text-[#94A3B8] font-sans">
                        vs 30d Moving Average baseline
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 bg-slate-950/20 p-2.5 rounded-xl border border-white/[0.02]">
                    <div>
                      <span className="text-[8px] font-mono text-[#64748B] uppercase block">Today Var</span>
                      <span className="text-xs font-mono font-bold text-[#F0F4FF]">{selectedSec.intradayVariance.toFixed(2)}%</span>
                    </div>
                    <div>
                      <span className="text-[8px] font-mono text-[#64748B] uppercase block">SMA30 Var</span>
                      <span className="text-xs font-mono font-bold text-[#94A3B8]">{selectedSec.historicalVariance30d.toFixed(2)}%</span>
                    </div>
                  </div>

                  <div>
                    <span className="text-[9px] font-mono text-[#64748B] uppercase tracking-wider block">Price deviation vs SMA30</span>
                    <div className="flex items-baseline gap-1.5 mt-0.5">
                      <span className={`text-sm font-mono font-bold ${selectedSec.priceDeviationFromSma30 >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                        {selectedSec.priceDeviationFromSma30 >= 0 ? "+" : ""}{selectedSec.priceDeviationFromSma30.toFixed(2)}%
                      </span>
                      <span className="text-[10px] text-[#64748B] font-mono">
                        (Close: BDT {selectedSec.avgPrice.toFixed(1)})
                      </span>
                    </div>
                  </div>
                </div>

                {/* Sub-component contributors */}
                <div className="space-y-2 pt-2 border-t border-[rgba(255,255,255,0.06)]">
                  <span className="text-[9px] font-mono text-[#94A3B8] uppercase block tracking-wider font-bold">
                    💥 Top Volatile Assets Today
                  </span>
                  
                  <div className="space-y-1.5">
                    {selectedSec.topVolatileStocks.map((stock) => (
                      <div 
                        key={stock.symbol}
                        className="flex items-center justify-between text-xs p-2 rounded-xl bg-slate-950/30 border border-white/[0.02] hover:bg-slate-950/50 hover:border-[#00D4FF]/20 group transition-all"
                      >
                        <div className="flex flex-col">
                          <span className="font-mono font-bold text-white group-hover:text-[#00D4FF] transition-colors">{stock.symbol}</span>
                          <span className="text-[9px] text-[#64748B] max-w-[120px] truncate">{stock.name}</span>
                        </div>
                        
                        <div className="flex items-center gap-3">
                          <div className="text-right flex flex-col">
                            <span className="font-mono text-[#94A3B8]">BDT {stock.price.toFixed(1)}</span>
                            <span className={`text-[10px] font-mono ${stock.changePercent >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                              {stock.changePercent >= 0 ? "+" : ""}{stock.changePercent}%
                            </span>
                          </div>

                          <div className="text-right flex flex-col">
                            <span className="text-[9px] font-mono text-[#64748B] uppercase shrink-0">Spread</span>
                            <span className="font-mono font-bold text-[#F0F4FF] shrink-0">{stock.currentVariance.toFixed(1)}%</span>
                          </div>

                          {onSelectSymbol && (
                            <button
                              onClick={() => onSelectSymbol(stock.symbol)}
                              className="p-1 rounded bg-[#00D4FF]/10 text-[#00D4FF] hover:bg-[#00D4FF] hover:text-[#0a0f1d] active:scale-95 cursor-pointer select-none transition-all"
                              title={`Analyze ${stock.symbol} on Dashboard`}
                            >
                              <ArrowRight className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

              </motion.div>
            ) : (
              <div className="flex flex-col items-center justify-center p-6 text-center border border-dashed border-[rgba(255,255,255,0.1)] rounded-2xl h-full min-h-[300px]">
                <Info className="h-6 w-6 text-slate-500 mb-2 animate-bounce" />
                <span className="text-[10px] font-mono text-slate-500 uppercase">Select a Sector to inspect assets</span>
              </div>
            )}
          </AnimatePresence>
        </div>

      </div>
    </div>
  );
};
