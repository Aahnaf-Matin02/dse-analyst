import React, { useMemo } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";
import { StockData } from "../types";

interface TickerTapeProps {
  stocks: StockData[];
  onSelectStock: (symbol: string) => void;
  isLoggedIn?: boolean;
}

export default function TickerTape({ stocks, onSelectStock, isLoggedIn }: TickerTapeProps) {
  // Identify the top 5 moving stocks by absolute percentage change
  const topMovers = useMemo(() => {
    if (!stocks || stocks.length === 0) return [];

    return [...stocks]
      .filter((s) => s.symbol && s.price > 0 && s.changePercent !== undefined)
      .sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent))
      .slice(0, 5);
  }, [stocks]);

  if (topMovers.length === 0) return null;

  // Let's duplicate the list several times to ensure continuous, seamless scrolling
  const scrollItems = [...topMovers, ...topMovers, ...topMovers, ...topMovers, ...topMovers];

  return (
    <div 
      id="realtime-ticker-tape-container" 
      className={`fixed ${
        isLoggedIn ? "bottom-14 lg:bottom-0" : "bottom-0"
      } left-0 right-0 h-10 bg-[#0B0F19]/95 backdrop-blur-md border-t border-[rgba(255,255,255,0.08)] z-40 flex items-center overflow-hidden select-none shadow-[0_-4px_20px_rgba(0,0,0,0.5)] transition-all`}
    >
      {/* CSS Keyframes for infinite scrolling horizontal translation */}
      <style>{`
        @keyframes ticker-marquee {
          0% {
            transform: translate3d(0, 0, 0);
          }
          100% {
            transform: translate3d(-20%, 0, 0);
          }
        }
        .animate-ticker {
          display: flex;
          width: max-content;
          animation: ticker-marquee 25s linear infinite;
        }
        .animate-ticker:hover {
          animation-play-state: paused;
        }
      `}</style>

      {/* Label Indicator Block */}
      <div className="bg-[#111827] h-full px-4 border-r border-[rgba(255,255,255,0.08)] flex items-center gap-1.5 shrink-0 z-10 shadow-[4px_0_12px_rgba(0,0,0,0.5)]">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00D4FF] opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-[#00D4FF]"></span>
        </span>
        <span className="font-display text-[9px] font-black text-white tracking-widest uppercase mb-0.5">
          TOP MOVERS
        </span>
      </div>

      {/* Scrolling Content Wrapper with left padding to prevent any overlap on load */}
      <div className="flex-1 overflow-hidden relative h-full flex items-center pl-6 sm:pl-8 lg:pl-10">
        <div className="animate-ticker">
          {scrollItems.map((s, idx) => {
            const isPos = s.changePercent > 0;
            const isNeg = s.changePercent < 0;
            return (
              <div
                key={`${s.symbol}-${idx}`}
                onClick={() => onSelectStock(s.symbol)}
                className="inline-flex items-center gap-1.5 px-4 lg:px-6 hover:bg-white/5 active:bg-white/10 transition-colors cursor-pointer border-r border-[rgba(255,255,255,0.04)] text-[10px] lg:text-xs h-10 font-mono"
                title={`Click to analyze ${s.symbol} (${s.name})`}
              >
                <span className="font-bold text-[#F0F4FF] tracking-wider">{s.symbol}</span>
                <span className="text-[#94A3B8] text-[9px] lg:text-[10px]">৳{s.price.toFixed(2)}</span>
                
                <span className={`inline-flex items-center gap-0.5 font-bold ${
                  isPos ? "text-[#10B981]" : isNeg ? "text-[#EF4444]" : "text-slate-400"
                }`}>
                  {isPos ? (
                    <TrendingUp className="h-3 w-3 shrink-0" />
                  ) : isNeg ? (
                    <TrendingDown className="h-3 w-3 shrink-0" />
                  ) : null}
                  {isPos ? "+" : ""}{s.changePercent.toFixed(2)}%
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
