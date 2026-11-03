import React, { useMemo, useState } from "react";
import { TrendingUp, TrendingDown, Pause, Play } from "lucide-react";
import { StockData } from "../types";

interface TickerTapeProps {
  stocks: StockData[];
  onSelectStock: (symbol: string) => void;
  isLoggedIn?: boolean;
}

/**
 * Desktop-only "Top movers" strip. Hidden below the lg breakpoint, where it covered content and
 * collided with the stock page's bottom tab bar. Can be paused (WCAG 2.2.2) and stops moving under
 * prefers-reduced-motion (global CSS rule).
 */
export default function TickerTape({ stocks, onSelectStock }: TickerTapeProps) {
  const [paused, setPaused] = useState(false);

  // Top 5 traded movers by absolute % change (untraded securities have no meaningful move)
  const topMovers = useMemo(() => {
    if (!stocks || stocks.length === 0) return [];
    return [...stocks]
      .filter((s) => s.symbol && s.price > 0 && typeof s.changePercent === "number" && (s.volume ?? 0) > 0)
      .sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent))
      .slice(0, 5);
  }, [stocks]);

  if (topMovers.length === 0) return null;

  // Repeated copies make the loop seamless; only the first copy is exposed to assistive tech
  const copies = 5;

  return (
    <aside
      id="realtime-ticker-tape-container"
      aria-label="Top movers"
      className="hidden lg:flex fixed bottom-0 left-0 right-0 h-11 bg-[#0B0F19]/95 backdrop-blur-md border-t border-[var(--border)] z-40 items-center overflow-hidden select-none"
    >
      <style>{`
        @keyframes ticker-marquee { 0% { transform: translate3d(0,0,0); } 100% { transform: translate3d(-20%,0,0); } }
        .animate-ticker { display: flex; width: max-content; animation: ticker-marquee 30s linear infinite; }
        .animate-ticker:hover, .animate-ticker:focus-within, .animate-ticker.is-paused { animation-play-state: paused; }
      `}</style>

      <div className="bg-[var(--surface)] h-full px-3 border-r border-[var(--border)] flex items-center gap-2 shrink-0 z-10">
        <span className="text-xs font-semibold text-[var(--text)]">Top movers</span>
        <button
          type="button"
          onClick={() => setPaused(p => !p)}
          aria-label={paused ? "Resume scrolling" : "Pause scrolling"}
          aria-pressed={paused}
          className="p-1.5 rounded-md text-[var(--text-subtle)] hover:text-white hover:bg-white/10"
        >
          {paused ? <Play className="h-4 w-4" aria-hidden="true" /> : <Pause className="h-4 w-4" aria-hidden="true" />}
        </button>
      </div>

      <div className="flex-1 overflow-hidden relative h-full flex items-center pl-6">
        <div className={`animate-ticker ${paused ? "is-paused" : ""}`}>
          {Array.from({ length: copies }).flatMap((_, copy) =>
            topMovers.map((s) => {
              const isPos = s.changePercent > 0;
              const isNeg = s.changePercent < 0;
              return (
                <button
                  type="button"
                  key={`${s.symbol}-${copy}`}
                  onClick={() => onSelectStock(s.symbol)}
                  aria-hidden={copy > 0 ? true : undefined}
                  tabIndex={copy > 0 ? -1 : 0}
                  className="inline-flex items-center gap-2 px-5 hover:bg-white/5 border-r border-[var(--border)] text-sm h-11"
                >
                  <span className="font-semibold text-[var(--text)]">{s.symbol}</span>
                  <span className="text-[var(--text-muted)]">৳{s.price.toFixed(2)}</span>
                  <span className={`inline-flex items-center gap-1 font-semibold ${isPos ? "text-[var(--up)]" : isNeg ? "text-[var(--down)]" : "text-[var(--text-muted)]"}`}>
                    {isPos ? <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" /> : isNeg ? <TrendingDown className="h-3.5 w-3.5" aria-hidden="true" /> : null}
                    {isPos ? "+" : ""}{s.changePercent.toFixed(2)}%
                  </span>
                </button>
              );
            })
          )}
        </div>
      </div>
    </aside>
  );
}
