import React, { useState, useEffect } from "react";
import { 
  ResponsiveContainer, 
  PieChart as RechartsPieChart, 
  Pie, 
  Cell, 
  Tooltip 
} from "recharts";
import { Scale, Info, RefreshCw } from "lucide-react";
import { Holding, StockData } from "../types";
import { DSE_COMPANIES } from "../data/dseData";
import { 
  generateCovarianceMatrix, 
  calculateDetailedRiskAttribution 
} from "../utils/portfolioAnalytics";

// Premium color palette matching the executive dark-glass design
const PREMIUM_COLORS = [
  "#f43f5e", // Rose
  "#8b5cf6", // Violet
  "#06b6d4", // Cyan
  "#f97316", // Coral/Orange
  "#10b981", // Emerald
  "#eab308", // Amber
  "#3b82f6", // Blue
  "#ec4899", // Pink
];

// Custom high-tech tooltips for hovering over the donut chart elements
const CustomRiskTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-[#0b0f19]/95 backdrop-blur-md border border-[rgba(255,255,255,0.15)] p-2.5 rounded-xl shadow-2xl font-mono text-[10px] z-50 animate-in fade-in zoom-in-95 duration-100">
        <div className="flex items-center gap-1.5 font-sans font-extrabold text-white">
          <span className="w-2 h-2 rounded-full ring-2 ring-white/10" style={{ backgroundColor: data.fill }} />
          <span className="tracking-wider">{data.name}</span>
        </div>
        <div className="mt-1.5 flex flex-col gap-0.5 border-t border-[rgba(255,255,255,0.06)] pt-1.5">
          <div className="text-slate-400 text-[8.5px]">RISK CONTRIBUTION</div>
          <div className="text-rose-450 font-black text-xs flex items-baseline gap-1">
            {payload[0].value.toFixed(2)}%
            <span className="text-[8px] text-slate-500 font-normal">of Total Vol</span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

export default function RiskContributionSidebarWidget() {
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [stocksMap, setStocksMap] = useState<Record<string, StockData>>({});
  const [riskData, setRiskData] = useState<Array<{ name: string; value: number }>>([]);
  const [totalRiskVal, setTotalRiskVal] = useState<number>(0);
  const [lastUpdated, setLastUpdated] = useState<string>("");
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  // Periodically read holdings and stocks map to remain in perfect real-time sync with user modifications
  const fetchAndSyncData = async () => {
    try {
      // 1. Fetch latest prices
      const res = await fetch("/api/stocks");
      const mapping: Record<string, StockData> = {};
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          data.forEach((st: StockData) => {
            mapping[st.symbol] = st;
          });
        }
      }
      
      // Assure DSE_COMPANIES fallback mappings
      Object.keys(DSE_COMPANIES).forEach(sym => {
        if (!mapping[sym]) {
          mapping[sym] = DSE_COMPANIES[sym];
        }
      });
      setStocksMap(mapping);

      // 2. Load active holdings from local storage, or use default seeds
      const stored = localStorage.getItem("dse_portfolio_holdings");
      let currentHoldings: Holding[] = [];
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          currentHoldings = parsed;
        }
      }

      if (currentHoldings.length === 0) {
        // Safe interactive seed fallbacks matching portfolio optimizer initial state
        currentHoldings = [
          { id: "seed-1", symbol: "GP", quantity: 1500, buyPrice: 242.10, purchaseDate: "2025-08-10" },
          { id: "seed-2", symbol: "SQURPHARMA", quantity: 2000, buyPrice: 212.50, purchaseDate: "2025-09-12" },
          { id: "seed-3", symbol: "BEXIMCO", quantity: 800, buyPrice: 110.00, purchaseDate: "2025-11-15" },
          { id: "seed-4", symbol: "BATBC", quantity: 500, buyPrice: 380.00, purchaseDate: "2026-01-20" },
          { id: "seed-5", symbol: "BRACBANK", quantity: 3000, buyPrice: 42.10, purchaseDate: "2026-02-14" }
        ];
      }
      setHoldings(currentHoldings);

      // 3. Compute detailed mathematical risk attributes using Ledoit-Wolf Shrinkage Covariance
      const warnings: string[] = [];
      const Sigma = generateCovarianceMatrix(currentHoldings, mapping, warnings);
      const riskAttrs = calculateDetailedRiskAttribution(currentHoldings, mapping, Sigma);

      if (riskAttrs && riskAttrs.riskContributionByStock) {
        const formatted = riskAttrs.riskContributionByStock.map(item => ({
          name: item.symbol,
          value: item.riskContribution
        }));
        
        // Sum total risk percentages (should be close to 100%)
        const sum = formatted.reduce((acc, current) => acc + current.value, 0);
        
        setRiskData(formatted);
        setTotalRiskVal(riskAttrs.portfolioVaR95 || sum || 100);
      }
      
      const now = new Date();
      setLastUpdated(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    } catch (err) {
      console.warn("Failed fetching and building risk contribution sidebar module:", err);
    }
  };

  useEffect(() => {
    fetchAndSyncData();

    // Listen to storage changes, trigger events, and keep a periodic refresh timer for high-frequency synchronization
    window.addEventListener("storage", fetchAndSyncData);
    window.addEventListener("trigger-reoptimize", fetchAndSyncData);
    
    const interval = setInterval(fetchAndSyncData, 2500);

    return () => {
      window.removeEventListener("storage", fetchAndSyncData);
      window.removeEventListener("trigger-reoptimize", fetchAndSyncData);
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="bg-[#111827]/75 backdrop-blur-xl border border-white/[0.07] rounded-3xl p-4 shadow-2xl relative overflow-hidden" id="sidebar-risk-contribution-card">
      {/* Visual background ambient glow overlay */}
      <div className="absolute top-0 right-0 w-20 h-20 bg-rose-500/5 rounded-full blur-2xl pointer-events-none" />
      
      {/* Card Header */}
      <div className="flex border-b border-[rgba(255,255,255,0.05)] pb-2.5 mb-3 justify-between items-center">
        <div className="flex items-center gap-1.5">
          <Scale className="h-4 w-4 text-rose-500" />
          <h4 className="text-[10px] font-sans font-extrabold uppercase text-white tracking-widest">Risk Contribution</h4>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[7.5px] font-mono text-slate-500">SYNCED {lastUpdated}</span>
        </div>
      </div>

      {riskData.length === 0 ? (
        <div className="py-6 text-center text-[10px] font-mono text-slate-500">
          No holdings to analyze risk.
        </div>
      ) : (
        <div className="space-y-3.5">
          {/* Donut Chart container with absolute centered labels */}
          <div className="h-32 w-full relative flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <RechartsPieChart>
                <Pie
                  data={riskData}
                  cx="50%"
                  cy="50%"
                  innerRadius={32}
                  outerRadius={50}
                  paddingAngle={3}
                  dataKey="value"
                  animationDuration={600}
                  onMouseEnter={(_, index) => setActiveIndex(index)}
                  onMouseLeave={() => setActiveIndex(null)}
                >
                  {riskData.map((entry, index) => {
                    const isMainActive = activeIndex === index;
                    return (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={PREMIUM_COLORS[index % PREMIUM_COLORS.length]} 
                        opacity={activeIndex === null ? 1 : (isMainActive ? 1 : 0.4)}
                        stroke={isMainActive ? "#ffffff" : "transparent"}
                        strokeWidth={isMainActive ? 1.5 : 0}
                        style={{
                          transform: isMainActive ? "scale(1.06)" : "scale(1)",
                          transformOrigin: "50% 50%",
                          transition: "all 300ms cubic-bezier(0.16, 1, 0.3, 1)",
                          filter: isMainActive ? `drop-shadow(0px 0px 6px ${PREMIUM_COLORS[index % PREMIUM_COLORS.length]}aa)` : "none",
                        }}
                        className="cursor-pointer outline-none"
                      />
                    );
                  })}
                </Pie>
                <Tooltip content={<CustomRiskTooltip />} />
              </RechartsPieChart>
            </ResponsiveContainer>
            
            {/* Absolute center display of standard systematic risk */}
            <div className="absolute flex flex-col items-center justify-center pointer-events-none text-center">
              <span className="text-[8px] font-mono text-rose-500/80 uppercase tracking-widest font-bold">PORT VaR</span>
              <span className="text-xs font-black text-rose-450 tracking-tight font-mono">{totalRiskVal.toFixed(1)}%</span>
            </div>
          </div>

          {/* Structured list legend and labels detailing individual risk impacts */}
          <div className="space-y-1.5 max-h-[190px] overflow-y-auto pr-1 select-none custom-scrollbar " style={{ scrollbarWidth: "thin" }}>
            {riskData.map((asset, index) => {
              const color = PREMIUM_COLORS[index % PREMIUM_COLORS.length];
              const isHovered = activeIndex === index;
              return (
                <div 
                  key={asset.name} 
                  onMouseEnter={() => setActiveIndex(index)}
                  onMouseLeave={() => setActiveIndex(null)}
                  className={`flex justify-between items-center p-1.5 rounded-xl border transition-all duration-200 cursor-pointer ${
                    isHovered 
                      ? "bg-white/[0.08] border-white/[0.12] translate-x-1 shadow-md" 
                      : activeIndex !== null 
                        ? "bg-white/[0.01] border-white/[0.02] opacity-35 scale-[0.98]" 
                        : "bg-white/[0.02] border-white/[0.03]"
                  }`}
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span 
                      className={`w-2 h-2 rounded shrink-0 ring-1 ring-white/10 transition-transform duration-200 ${isHovered ? "scale-125" : "scale-100"}`} 
                      style={{ backgroundColor: color }} 
                    />
                    <span className={`font-mono text-[9px] font-extrabold truncate transition-colors ${isHovered ? "text-white" : "text-white/80"}`}>{asset.name}</span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 font-mono text-[9.5px]">
                    <span className={`font-semibold transition-colors ${isHovered ? "text-rose-400 font-bold" : "text-slate-400"}`}>{asset.value.toFixed(1)}%</span>
                    <span className="text-[7.5px] text-slate-500">risk</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Helpful helper tips footer */}
          <div className="flex items-start gap-1 p-2 bg-rose-500/5 rounded-xl border border-rose-500/10 text-[8.5px] font-sans text-slate-400 leading-normal">
            <Info className="h-3 w-3 text-rose-500 shrink-0 mt-0.5" />
            <span>Hover on chart sectors above to view exact systematic Risk contributions. Adjust holdings to balance high-volatility targets.</span>
          </div>
        </div>
      )}
    </div>
  );
}
