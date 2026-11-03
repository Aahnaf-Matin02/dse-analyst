import React, { useState, useEffect, useMemo } from "react";
import { Coins, Calendar, HelpCircle, Percent, Info, Layers, TrendingUp, ArrowUpRight } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell, ReferenceLine, CartesianGrid } from "recharts";

interface DividendPayout {
  year: string;
  type: string;
  percentage: number;
  valuePerShare: number;
  recordDate: string;
  paymentDate: string;
  remarks?: string;
}

interface DividendHistoryProps {
  symbol: string;
}

export default function DividendHistory({ symbol }: DividendHistoryProps) {
  const [viewMode, setViewMode] = useState<"percentage" | "cash">("percentage");
  const [dividends, setDividends] = useState<DividendPayout[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showSectorCompare, setShowSectorCompare] = useState(false);
  const [sectorData, setSectorData] = useState<any | null>(null);
  const [isSectorLoading, setIsSectorLoading] = useState(false);
  const [sectorError, setSectorError] = useState<string | null>(null);

  // CAGR Calculation
  const latestYear = useMemo(() => {
    return dividends.length > 0 
      ? Math.max(...dividends.map(d => parseInt(d.year))) 
      : 2025;
  }, [dividends]);

  // Aggregate annual dividends for stable CAGR computation
  const annualTotals = useMemo(() => {
    const totals: Record<number, { percentage: number; valuePerShare: number }> = {};
    dividends.forEach(p => {
      const yr = parseInt(p.year);
      if (!isNaN(yr)) {
        if (!totals[yr]) {
          totals[yr] = { percentage: 0, valuePerShare: 0 };
        }
        totals[yr].percentage += p.percentage;
        totals[yr].valuePerShare += p.valuePerShare;
      }
    });
    return totals;
  }, [dividends]);

  // Helper function to calculate Compound Annual Growth Rate
  const calculateCagr = (years: number, type: "percentage" | "valuePerShare") => {
    const endYear = latestYear;
    const startYear = latestYear - years;
    const endData = annualTotals[endYear];
    const startData = annualTotals[startYear];

    if (!endData || !startData) return null;

    const endVal = endData[type];
    const startVal = startData[type];

    // If initial value or final value is non-positive, CAGR cannot be computed
    if (startVal <= 0 || endVal <= 0) return null;

    try {
      const baseRatio = endVal / startVal;
      const cagrValue = Math.pow(baseRatio, 1 / years) - 1;
      return parseFloat((cagrValue * 100).toFixed(2));
    } catch (e) {
      return null;
    }
  };

  // Pre-calculate CAGR metrics for 3, 5, 10 years
  const cagrMetrics = useMemo(() => {
    if (dividends.length === 0) return [];
    
    const periods = [
      { name: "3-Year", years: 3 },
      { name: "5-Year", years: 5 },
      { name: "10-Year", years: 10 }
    ];

    return periods.map(p => {
      const rateCagr = calculateCagr(p.years, "percentage");
      const cashCagr = calculateCagr(p.years, "valuePerShare");
      const startYear = latestYear - p.years;

      return {
        period: p.name,
        range: `${startYear} → ${latestYear}`,
        rateCagr,
        cashCagr,
        displayCagr: viewMode === "cash" ? cashCagr : rateCagr
      };
    });
  }, [dividends, annualTotals, latestYear, viewMode]);

  // YoY Growth state and calculations
  const [selectedGrowthPeriod, setSelectedGrowthPeriod] = useState<"all" | "3" | "5" | "10">("all");

  const annualGrowthData = useMemo(() => {
    const years = Object.keys(annualTotals)
      .map(Number)
      .sort((a, b) => a - b);

    const growthData: Array<{
      year: string;
      value: number;
      prevValue: number;
      growth: number;
    }> = [];

    const isCashMode = viewMode === "cash";

    for (let i = 1; i < years.length; i++) {
      const prevYr = years[i - 1];
      const currYr = years[i];
      const prevData = annualTotals[prevYr];
      const currData = annualTotals[currYr];

      if (!prevData || !currData) continue;

      const prevVal = isCashMode ? prevData.valuePerShare : prevData.percentage;
      const currVal = isCashMode ? currData.valuePerShare : currData.percentage;

      let growth = 0;
      if (prevVal > 0) {
        growth = parseFloat((((currVal - prevVal) / prevVal) * 100).toFixed(2));
      } else if (prevVal === 0 && currVal > 0) {
        growth = 100;
      }

      growthData.push({
        year: currYr.toString(),
        value: currVal,
        prevValue: prevVal,
        growth: growth
      });
    }

    return growthData;
  }, [annualTotals, viewMode]);

  const activeCagr = useMemo(() => {
    if (selectedGrowthPeriod === "all") return null;
    const metric = cagrMetrics.find(m => m.period.startsWith(selectedGrowthPeriod));
    return metric ? metric.displayCagr : null;
  }, [selectedGrowthPeriod, cagrMetrics]);

  useEffect(() => {
    if (!showSectorCompare) return;

    let active = true;
    const fetchSectorDetails = async () => {
      setIsSectorLoading(true);
      setSectorError(null);
      try {
        const res = await fetch(`/api/dividends/${symbol}/sector`);
        if (!res.ok) {
          throw new Error("Failed to load sector metrics.");
        }
        const data = await res.json();
        if (active) {
          setSectorData(data);
        }
      } catch (err: any) {
        if (active) {
          setSectorError(err.message || "Failed to load sector yield rates.");
        }
      } finally {
        if (active) {
          setIsSectorLoading(false);
        }
      }
    };

    fetchSectorDetails();
    return () => {
      active = false;
    };
  }, [symbol, showSectorCompare]);

  useEffect(() => {
    let active = true;
    const fetchDividends = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/dividends/${symbol}`);
        if (!res.ok) {
          throw new Error("Failed to load historical payouts dataset.");
        }
        const data = await res.json();
        if (active) {
          setDividends(data);
        }
      } catch (err: any) {
        if (active) {
          setError(err.message || "Something went wrong.");
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    fetchDividends();
    return () => {
      active = false;
    };
  }, [symbol]);

  return (
    <div 
      id="dividend-history-section" 
      className="bg-[#111827] border border-[rgba(255,255,255,0.08)] rounded-3xl p-6 shadow-[0_2px_12px_rgba(0,0,0,0.4)] relative overflow-hidden card-lift"
    >
      <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none"></div>
      
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-6 border-b border-[rgba(255,255,255,0.05)] pb-4">
        <div>
          <span className="text-[10px] uppercase font-mono tracking-wider text-emerald-450 font-bold flex items-center gap-1">
            <Coins className="h-3.5 w-3.5 text-emerald-500 animate-spin-slow" /> Payout Tracker Ledger
          </span>
          <h3 className="font-display text-sm font-extrabold text-white mt-1">
            Historical Dividend Distributions — {symbol}
          </h3>
          <p className="text-xs text-[#94A3B8] font-sans mt-0.5">
            Retrieved dividend yielding statistics, declaration rates, and corporate register closure dates.
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2 text-white">
          <button
            id="btn-compare-sector"
            onClick={() => setShowSectorCompare(!showSectorCompare)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-mono font-bold uppercase border transition-all duration-300 cursor-pointer ${
              showSectorCompare
                ? "bg-purple-900/40 border-purple-800/40 text-purple-400 shadow-[0_2px_12px_rgba(0,0,0,0.4)]"
                : "bg-[#1A2235] border-[rgba(255,255,255,0.08)] text-[#CBD5E1] hover:bg-[#1A2235]/80 hover:border-[rgba(255,255,255,0.14)]"
            }`}
          >
            <Layers className="h-3.5 w-3.5" />
            {showSectorCompare ? "Dividend Sparklines" : "Compare with Sector"}
          </button>

          <div className="flex items-center gap-2 text-[11px] bg-[#1A2235] border border-[rgba(255,255,255,0.08)] px-2.5 py-1.5 rounded-xl text-[#94A3B8] font-mono font-bold shadow-[0_2px_12px_rgba(0,0,0,0.4)]">
            <Calendar className="h-3.5 w-3.5 text-blue-400" />
            <span>Accounting Basis: AGM</span>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="py-12 flex flex-col items-center justify-center space-y-2">
          <div className="w-6 h-6 border-2 border-t-transparent border-emerald-500 rounded-full animate-spin"></div>
          <span className="text-xs font-mono text-emerald-500 animate-pulse font-bold">Querying general ledgers...</span>
        </div>
      ) : error ? (
        <div className="py-8 bg-rose-950/40 border border-rose-800/40 rounded-2xl text-center text-xs text-rose-450 font-mono p-4">
          Error sync-fetching dividend ledgers: {error}
        </div>
      ) : dividends.length === 0 ? (
        <div className="py-10 text-center text-xs text-[#64748B] font-sans">
          No dividend declarations indexed for {symbol}.
        </div>
      ) : (
        <>
          {showSectorCompare ? (
            /* Sector Peer-Average Dividend Yield Comparison Chart */
            <div className="mb-6 bg-[rgba(147,51,234,0.05)] border border-purple-900/30 rounded-2xl p-5 relative overflow-hidden transition-all duration-300">
              <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 rounded-full blur-3xl pointer-events-none"></div>

              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-5 pb-3 border-b border-purple-900/20">
                <div>
                  <div className="text-[10px] font-mono text-purple-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                    <Layers className="h-3 w-3" /> Sector Yield Comparison
                  </div>
                  <h4 className="text-sm font-bold text-white mt-1 font-display">
                    {sectorData?.sectorName || "Industry Peers"} — Annual Dividend Yield
                  </h4>
                  <p className="text-xs text-[#94A3B8] mt-0.5">
                    Benchmarking {symbol} against sector peers' annual dividend yield ratios.
                  </p>
                </div>

                <div className="text-left sm:text-right">
                  <span className="text-[10px] font-mono text-[#64748B] block uppercase font-bold tracking-tight">Sector Average Yield</span>
                  <span className="text-base font-extrabold text-purple-400 font-mono">
                    {isSectorLoading ? "Loading..." : sectorData ? `${sectorData.averageYield}%` : "—"}
                  </span>
                </div>
              </div>

              {isSectorLoading ? (
                <div className="py-10 flex flex-col items-center justify-center space-y-2.5">
                  <div className="w-5 h-5 border-2 border-t-transparent border-purple-500 rounded-full animate-spin"></div>
                  <span className="text-xs font-mono text-purple-500 font-bold animate-pulse">Loading industry metrics matrix...</span>
                </div>
              ) : sectorError ? (
                <div className="py-8 text-center text-xs text-rose-450 border border-rose-900/30 rounded-xl bg-rose-955/20 font-mono p-4">
                  Failed to load sector metrics: {sectorError}
                </div>
              ) : sectorData ? (
                <div className="space-y-4">
                  {/* Peer List Bar Chart */}
                  <div className="space-y-3">
                    {sectorData.peers.map((peer: any) => {
                      const isSelected = peer.symbol === symbol;
                      const yieldVal = peer.divYield;
                      const maxYield = Math.max(...sectorData.peers.map((p: any) => p.divYield), 8);
                      const barWidthPercent = maxYield > 0 ? (yieldVal / maxYield) * 100 : 0;

                      return (
                        <div 
                          key={peer.symbol} 
                          className={`relative p-3 rounded-xl border transition-all ${
                            isSelected 
                              ? "bg-[rgba(16,185,129,0.06)] border-emerald-500/30 shadow-[0_2px_12px_rgba(0,0,0,0.4)]" 
                              : "bg-[#111827] border-[rgba(255,255,255,0.06)] hover:border-[rgba(255,255,255,0.12)] hover:bg-[#1A2235]"
                          }`}
                        >
                          <div className="flex justify-between items-center z-10 relative">
                            <div className="flex items-center gap-2.5">
                              <span className={`text-[10px] font-mono font-black px-2 py-0.5 rounded border ${
                                isSelected ? "bg-emerald-600 border-emerald-700 text-white" : "bg-[#1A2235] border-[rgba(255,255,255,0.08)] text-[#94A3B8]"
                              }`}>
                                {peer.symbol}
                              </span>
                              <span className="text-xs text-white font-bold truncate max-w-[150px] sm:max-w-[250px]" title={peer.name}>
                                {peer.name}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-mono font-black text-white">{yieldVal.toFixed(2)}%</span>
                              {isSelected && (
                                <span className="text-[9px] font-mono text-emerald-300 font-black bg-emerald-900/30 px-1.5 py-0.5 rounded border border-emerald-800/40 uppercase tracking-wide">Selected</span>
                              )}
                            </div>
                          </div>
                          
                          {/* Colored bar tracks */}
                          <div className="mt-2.5 w-full bg-[#1A2235] h-1.5 rounded-full overflow-hidden relative border border-[rgba(255,255,255,0.04)]">
                            <div 
                              className={`h-full rounded-full transition-all duration-500 ${
                                isSelected 
                                  ? "bg-emerald-500 shadow-sm" 
                                  : "bg-purple-500"
                              }`}
                              style={{ width: `${Math.max(barWidthPercent, 2.5)}%` }}
                            ></div>
                            
                            {/* Dotted Vertical Guide line marking Sector Average */}
                            <div 
                              className="absolute top-0 bottom-0 border-l border-dashed border-[#64748B]" 
                              style={{ left: `${(sectorData.averageYield / maxYield) * 100}%` }}
                              title={`Sector Average: ${sectorData.averageYield}%`}
                            ></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Summary Metric Footer */}
                  <div className="mt-4 pt-3 border-t border-purple-900/30 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 text-xs">
                    <div className="flex flex-wrap gap-4 text-[11px] text-[#64748B] font-mono font-bold">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-1 bg-emerald-500 rounded-full inline-block"></span>
                        <span>{symbol} Yield: <strong className="text-emerald-400">{sectorData.selectedYield.toFixed(2)}%</strong></span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-1 bg-purple-500 rounded-full inline-block"></span>
                        <span>Sector Average: <strong className="text-purple-400">{sectorData.averageYield.toFixed(2)}%</strong></span>
                      </div>
                    </div>

                    <div className="text-xs rounded-xl bg-[#111827] border border-[rgba(255,255,255,0.08)] px-3 py-1.5 font-sans font-medium text-[#CBD5E1] shadow-[0_2px_12px_rgba(0,0,0,0.4)]">
                      {sectorData.selectedYield >= sectorData.averageYield ? (
                        <div className="text-emerald-400 flex items-center gap-1">
                          <span className="text-amber-500">★</span> Yield Premium: <strong className="font-bold">+{(sectorData.selectedYield - sectorData.averageYield).toFixed(2)}%</strong> above industry benchmark.
                        </div>
                      ) : (
                        <div className="text-amber-400 flex items-center gap-1">
                          <span>⚠️</span> Yield Gap: <strong className="font-bold">{(sectorData.averageYield - sectorData.selectedYield).toFixed(2)}%</strong> below industry peers.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-6">
              {/* Sparkline / Bar Chart Trend Visualizer */}
              <div id="payout-trend-tracker" className="lg:col-span-7 bg-[#111827] border border-[rgba(255,255,255,0.08)] rounded-2xl p-5 flex flex-col justify-between shadow-[inset_0_2px_8px_rgba(0,0,0,0.3)] min-h-[380px]">
                <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-3 border-b border-[rgba(255,255,255,0.04)] pb-2.5">
                  <div>
                    <div className="text-[11px] font-mono text-emerald-450 font-bold uppercase tracking-wider flex items-center gap-1">
                      <Percent className="h-3 w-3" /> Yield & Growth Trajectory
                    </div>
                    <h4 className="text-sm font-bold text-white mt-1 font-display">Payout Trend Line</h4>
                    <p className="text-xs text-[#94A3B8] mt-0.5">
                      Chronological analysis of the last 5 registered distributions.
                    </p>
                  </div>

                  {/* Interactive View Toggle */}
                  <div className="flex bg-[#1A2235] border border-[rgba(255,255,255,0.08)] rounded-lg p-0.5 w-fit shrink-0">
                    <button
                      id="tab-payout-percentage"
                      onClick={() => setViewMode("percentage")}
                      className={`px-3 py-1 text-[10px] font-mono font-bold uppercase rounded-md transition-all duration-200 cursor-pointer ${
                        viewMode === "percentage"
                          ? "bg-emerald-600 text-white shadow-sm font-extrabold pb-1 pt-1"
                          : "text-[#64748B] hover:text-[#94A3B8] pb-1 pt-1"
                      }`}
                    >
                      Rate %
                    </button>
                    <button
                      id="tab-payout-cash"
                      onClick={() => setViewMode("cash")}
                      className={`px-3 py-1 text-[10px] font-mono font-bold uppercase rounded-md transition-all duration-200 cursor-pointer ${
                        viewMode === "cash"
                          ? "bg-emerald-600 text-white shadow-sm font-extrabold pb-1 pt-1"
                          : "text-[#64748B] hover:text-[#94A3B8] pb-1 pt-1"
                      }`}
                    >
                      Cash (BDT)
                    </button>
                  </div>
                </div>
                
                {/* YoY and Spark Container */}
                <div className="flex-1 w-full flex flex-col justify-end">
                  {/* YoY change indicators row directly above the sparkline */}
                  <div className="grid grid-cols-5 gap-3 px-2 mb-3 text-center border-b border-[rgba(255,255,255,0.08)] pb-2">
                    {(() => {
                      const trendData = [...dividends]
                        .sort((a, b) => parseInt(a.year) - parseInt(b.year))
                        .slice(-5);
                      
                      const isCashMode = viewMode === "cash";
                      
                      return trendData.map((item, idx) => {
                        if (idx === 0) {
                          return (
                            <div key={`yoy-${item.year}`} className="flex flex-col items-center justify-center">
                              <span className="text-[8px] font-mono font-bold uppercase text-[#64748B] tracking-wider">YoY Change</span>
                              <span className="text-[10px] font-mono text-[#64748B] font-bold mt-0.5">—</span>
                            </div>
                          );
                        }
                        
                        const prevVal = isCashMode ? trendData[idx - 1].valuePerShare : trendData[idx - 1].percentage;
                        const currentVal = isCashMode ? item.valuePerShare : item.percentage;
                        
                        let yoyPercent = 0;
                        if (prevVal > 0) {
                          yoyPercent = ((currentVal - prevVal) / prevVal) * 100;
                        } else if (prevVal === 0 && currentVal > 0) {
                          yoyPercent = 100;
                        }
                        
                        const isPositive = yoyPercent > 0;
                        const isNegative = yoyPercent < 0;
                        
                        return (
                          <div key={`yoy-${item.year}`} className="flex flex-col items-center justify-center">
                            <span className="text-[8px] font-mono font-bold text-[#64748B] uppercase tracking-tight">YoY Change</span>
                            <span className={`text-[9px] font-mono font-bold mt-0.5 flex items-center justify-center gap-0.5 px-1 py-0.5 rounded ${
                              isPositive
                                ? "text-emerald-400 bg-emerald-500/10 border border-emerald-500/20"
                                : isNegative
                                ? "text-rose-400 bg-rose-500/10 border border-rose-500/20"
                                : "text-[#94A3B8] bg-[#1A2235] border border-[rgba(255,255,255,0.08)]"
                            }`}>
                              {isPositive ? "▲" : isNegative ? "▼" : "•"}{" "}
                              {isPositive ? `+${yoyPercent.toFixed(1)}%` : isNegative ? `${yoyPercent.toFixed(1)}%` : "0.0%"}
                            </span>
                          </div>
                        );
                      });
                    })()}
                  </div>

                  {/* The micro spark bar layout */}
                  <div className="grid grid-cols-5 gap-3 h-24 items-end pt-1 px-2">
                    {(() => {
                      const trendData = [...dividends]
                        .sort((a, b) => parseInt(a.year) - parseInt(b.year))
                        .slice(-5);
                      
                      const isCashMode = viewMode === "cash";
                      const maxVal = Math.max(
                        ...trendData.map(d => isCashMode ? d.valuePerShare : d.percentage),
                        isCashMode ? 1.0 : 10
                      );
                      
                      return trendData.map((item, idx) => {
                        const currentVal = isCashMode ? item.valuePerShare : item.percentage;
                        const heightPercent = maxVal > 0 ? (currentVal / maxVal) * 100 : 0;
                        const isZero = currentVal === 0;
                        
                        const displayLabel = isCashMode 
                          ? `৳${item.valuePerShare.toFixed(1)}` 
                          : `${item.percentage}%`;

                        return (
                          <div key={item.year} className="group relative flex flex-col items-center h-full justify-end">
                             {/* Inside Spark interactive metrics hover */}
                            <div className="absolute bottom-full mb-2 hidden group-hover:flex flex-col items-center bg-[#1A2235] border border-[rgba(255,255,255,0.10)] rounded-lg p-2 text-[10px] text-[#F0F4FF] shadow-[0_8px_32px_rgba(0,0,0,0.5)] z-25 min-w-[130px] pointer-events-none">
                              <span className="font-bold text-white">{item.year} Payout</span>
                              <div className="flex flex-col gap-0.5 mt-1 font-mono text-[9px] w-full items-start border-t border-[rgba(255,255,255,0.05)] pt-1">
                                <span className={`flex justify-between w-full gap-2 ${!isCashMode ? "text-emerald-400 font-bold" : "text-[#94A3B8]"}`}>
                                  <span>Rate:</span>
                                  <span>{item.percentage}%</span>
                                </span>
                                <span className={`flex justify-between w-full gap-2 ${isCashMode ? "text-emerald-400 font-bold" : "text-[#94A3B8]"}`}>
                                  <span>Value:</span>
                                  <span>BDT {item.valuePerShare.toFixed(2)}</span>
                                </span>
                              </div>
                              <span className="text-[#64748B] italic text-[9px] mt-1 border-t border-[rgba(255,255,255,0.05)] pt-0.5 w-full text-center truncate">{item.type}</span>
                              <div className="w-1.5 h-1.5 bg-[#1A2235] border-r border-b border-[rgba(255,255,255,0.08)] rotate-45 -mb-2.5 mt-1"></div>
                            </div>

                            {/* Bar depiction */}
                            <div className="w-full flex flex-col items-center gap-1.5 h-full justify-end">
                              <div className="text-[10px] font-mono font-bold text-[#64748B] group-hover:text-emerald-400 transition-colors w-full text-center truncate" title={isZero ? "0" : displayLabel}>
                                {isZero ? "0" : displayLabel}
                              </div>
                              
                              <div className="w-full bg-[#1A2235] rounded-lg h-12 relative overflow-hidden group-hover:bg-[#2D3A50]/60 transition-colors border border-[rgba(255,255,255,0.06)]">
                                <div 
                                  className={`absolute bottom-0 left-0 right-0 rounded-t-md transition-all duration-300 origin-bottom ${
                                    isZero
                                      ? "bg-red-500/20 border-t border-red-500/40"
                                      : item.type.toLowerCase().includes("stock")
                                      ? "bg-blue-500"
                                      : "bg-emerald-600"
                                    }`}
                                  style={{ height: `${Math.max(heightPercent, 6)}%` }}
                                >
                                  {!isZero && <div className="absolute top-[1px] left-0 right-0 h-[1px] bg-white/20"></div>}
                                </div>
                              </div>

                              <div className="text-[10px] font-mono text-[#64748B] group-hover:text-[#94A3B8] font-bold tracking-tight">
                                {item.year}
                              </div>
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              </div>

              {/* CAGR Compound Calculator Section */}
              <div id="cagr-analysis-dashboard" className="lg:col-span-5 bg-[#111827] border border-[rgba(255,255,255,0.08)] rounded-2xl p-5 flex flex-col justify-between shadow-[inset_0_2px_8px_rgba(0,0,0,0.3)] min-h-[380px]">
                <div>
                  <div className="text-[11px] font-mono text-purple-400 font-bold uppercase tracking-wider flex items-center gap-1">
                    <TrendingUp className="h-3 w-3" /> Growth Modeling
                  </div>
                  <h4 className="text-sm font-bold text-white mt-1 font-display flex items-center gap-1.5">
                    Dividend CAGR Analysis 
                    <span className="text-[10px] font-mono text-gray-500 font-normal">({viewMode === "cash" ? "Cash BDT" : "Rate %"})</span>
                  </h4>
                  <p className="text-xs text-[#94A3B8] mt-0.5">
                    Compound Annual Growth Rates computed across active investment horizons.
                  </p>
                </div>

                {/* CAGRs Chart Container */}
                <div className="h-32 w-full mt-4 relative">
                  {(() => {
                    const cagrChartData = cagrMetrics.map(item => ({
                      period: item.period,
                      value: item.displayCagr !== null ? item.displayCagr : 0,
                      range: item.range,
                      rateCagr: item.rateCagr,
                      cashCagr: item.cashCagr,
                      isNull: item.displayCagr === null
                    }));

                    const isAllNull = cagrMetrics.every(m => m.displayCagr === null);

                    if (isAllNull) {
                      return (
                        <div className="absolute inset-0 flex flex-col items-center justify-center border border-dashed border-[rgba(255,255,255,0.06)] rounded-xl bg-rose-955/5 p-4 text-center">
                          <span className="text-rose-400 font-bold text-[11px] font-mono uppercase">CAGR Matrix Indeterminate</span>
                          <span className="text-gray-500 text-[10px] mt-1">Zero or suspended payouts in the period boundary prevent compound rate calculations (e.g., brand-new counter or payout freeze).</span>
                        </div>
                      );
                    }

                    return (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          layout="vertical"
                          data={cagrChartData}
                          margin={{ top: 5, right: 15, left: -25, bottom: 5 }}
                        >
                          <XAxis type="number" stroke="rgba(255,255,255,0.3)" fontSize={9} fontFamily="monospace" unit="%" />
                          <YAxis dataKey="period" type="category" stroke="rgba(255,255,255,0.4)" fontSize={9} fontFamily="monospace" width={55} />
                          <Tooltip
                            cursor={{ fill: "rgba(255,255,255,0.02)" }}
                            contentStyle={{ backgroundColor: "#111827", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px", fontFamily: "monospace" }}
                            content={({ active, payload }) => {
                              if (active && payload && payload.length) {
                                const data = payload[0].payload;
                                return (
                                  <div className="bg-[#111827] border border-[rgba(255,255,255,0.1)] rounded-xl p-3 text-[10px] space-y-1 rounded shadow-lg animate-fade-in">
                                    <span className="font-bold text-white block">{data.period} Profile ({data.range})</span>
                                    <div className="h-[1px] bg-[rgba(255,255,255,0.05)] my-1"></div>
                                    <span className="flex justify-between gap-4 text-gray-400">
                                      <span>Cash DPS CAGR:</span>
                                      <span className={data.cashCagr === null ? "text-rose-450 font-bold" : data.cashCagr >= 0 ? "text-emerald-400 font-bold" : "text-rose-450 font-bold"}>
                                        {data.cashCagr === null ? "N/A" : `${data.cashCagr > 0 ? "+" : ""}${data.cashCagr}%`}
                                      </span>
                                    </span>
                                    <span className="flex justify-between gap-4 text-gray-400">
                                      <span>Rate declared CAGR:</span>
                                      <span className={data.rateCagr === null ? "text-rose-450 font-bold" : data.rateCagr >= 0 ? "text-emerald-400 font-bold" : "text-rose-450 font-bold"}>
                                        {data.rateCagr === null ? "N/A" : `${data.rateCagr > 0 ? "+" : ""}${data.rateCagr}%`}
                                      </span>
                                    </span>
                                  </div>
                                );
                              }
                              return null;
                            }}
                          />
                          <Bar dataKey="value" barSize={12} radius={[0, 4, 4, 0]}>
                            {cagrChartData.map((entry, index) => (
                              <Cell 
                                key={`cell-${index}`} 
                                fill={entry.isNull ? "rgba(239, 68, 68, 0.15)" : entry.value >= 0 ? "#10B981" : "#EF4444"} 
                                stroke={entry.isNull ? "#EF4444" : "none"}
                                strokeDasharray={entry.isNull ? "2 2" : "none"}
                              />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    );
                  })()}
                </div>

                {/* Grid layout parameter details */}
                <div className="grid grid-cols-3 gap-2 mt-3.5">
                  {cagrMetrics.map((m) => {
                    const isRateNull = m.rateCagr === null;
                    const isCashNull = m.cashCagr === null;
                    
                    return (
                      <div 
                        key={m.period}
                        className="bg-[#1A2235]/50 hover:bg-[#1A2235]/80 border border-[rgba(255,255,255,0.05)] rounded-xl p-2 transition-all duration-300 flex flex-col justify-between"
                      >
                        <div className="text-[9px] uppercase font-mono font-black text-[#94A3B8] tracking-wide">
                          {m.period}
                        </div>
                        <div className="text-[8px] font-mono text-[#64748B] mt-0.5">
                          {m.range}
                        </div>
                        
                        <div className="mt-2.5 space-y-1">
                          <div className="flex justify-between items-center text-[10px] font-mono border-t border-[rgba(255,255,255,0.03)] pt-1">
                            <span className="text-[#64748B] text-[8px]">Cash BDT</span>
                            <span className={`font-bold text-[9px] ${isCashNull ? "text-rose-500/60" : m.cashCagr! >= 0 ? "text-emerald-400" : "text-rose-450"}`}>
                              {isCashNull ? "N/A" : `${m.cashCagr! > 0 ? "+" : ""}${m.cashCagr}%`}
                            </span>
                          </div>
                          
                          <div className="flex justify-between items-center text-[10px] font-mono pt-0.5">
                            <span className="text-[#64748B] text-[8px]">Rate %</span>
                            <span className={`font-bold text-[9px] ${isRateNull ? "text-rose-500/60" : m.rateCagr! >= 0 ? "text-emerald-400" : "text-rose-450"}`}>
                              {isRateNull ? "N/A" : `${m.rateCagr! > 0 ? "+" : ""}${m.rateCagr}%`}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* YoY Dividend Growth Rate Analysis Panel */}
          {!showSectorCompare && (
            <div id="yoy-growth-analysis-panel" className="mb-6 bg-[#111827] border border-[rgba(255,255,255,0.08)] rounded-2xl p-5 flex flex-col gap-5 shadow-[0_4px_24px_rgba(0,0,0,0.5)]">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[rgba(255,255,255,0.05)] pb-4">
                <div>
                  <span className="text-[10px] font-mono text-emerald-400 font-bold uppercase tracking-wider flex items-center gap-1">
                    <TrendingUp className="h-3 w-3" /> YoY Change Matrix
                  </span>
                  <h4 className="text-sm font-bold text-white mt-1 font-display">
                    Annual Dividend Growth Percentages
                  </h4>
                  <p className="text-xs text-[#94A3B8] mt-0.5">
                    Visualizes year-over-year rate of change, overlaid with compound growth trends.
                  </p>
                </div>

                {/* Period Highlighter controls */}
                <div className="flex flex-wrap items-center gap-1.5 bg-[#1A2235] border border-[rgba(255,255,255,0.08)] rounded-xl p-1 shrink-0">
                  <span className="text-[9px] font-mono font-bold uppercase text-[#64748B] px-2">Highlight CAGR Period:</span>
                  {(["all", "3", "5", "10"] as const).map(p => {
                    const isActive = selectedGrowthPeriod === p;
                    return (
                      <button
                        key={p}
                        id={`btn-yoy-highlight-${p}`}
                        onClick={() => setSelectedGrowthPeriod(p)}
                        className={`px-3 py-1 text-[10px] font-mono font-bold uppercase rounded-lg transition-all duration-200 cursor-pointer ${
                          isActive
                            ? "bg-emerald-600 text-white font-extrabold pb-1 pt-1"
                            : "text-[#64748B] hover:text-[#94A3B8] pb-1 pt-1"
                        }`}
                      >
                        {p === "all" ? "Show All" : `${p}-Yr`}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Main YoY growth chart container */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
                <div className="lg:col-span-8 h-64 w-full">
                  {annualGrowthData.length === 0 ? (
                    <div className="w-full h-full flex items-center justify-center border border-dashed border-[rgba(255,255,255,0.08)] rounded-xl">
                      <span className="text-[#64748B] text-xs font-mono">Insufficient historical periods to calculate YoY growth.</span>
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={annualGrowthData}
                        margin={{ top: 10, right: 10, left: -20, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                        <XAxis 
                          dataKey="year" 
                          stroke="rgba(255,255,255,0.3)" 
                          fontSize={9} 
                          fontFamily="monospace"
                          tickLine={false}
                        />
                        <YAxis 
                          stroke="rgba(255,255,255,0.3)" 
                          fontSize={9} 
                          fontFamily="monospace"
                          unit="%"
                          tickLine={false}
                        />
                        <Tooltip
                          cursor={{ fill: "rgba(255,255,255,0.02)" }}
                          contentStyle={{ backgroundColor: "#111827", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px", fontFamily: "monospace" }}
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              const data = payload[0].payload;
                              const isPositive = data.growth > 0;
                              const isNegative = data.growth < 0;
                              return (
                                <div className="bg-[#111827] border border-[rgba(255,255,255,0.1)] rounded-xl p-3 text-[10px] space-y-1 rounded shadow-lg animate-fade-in">
                                  <span className="font-bold text-white block">{data.year} Growth Analysis</span>
                                  <div className="h-[1px] bg-[rgba(255,255,255,0.05)] my-1"></div>
                                  <span className="flex justify-between gap-4 text-gray-400">
                                    <span>Payout:</span>
                                    <span className="text-white font-mono font-bold">
                                      {viewMode === "cash" ? `BDT ${data.value.toFixed(2)}` : `${data.value}%`}
                                    </span>
                                  </span>
                                  <span className="flex justify-between gap-4 text-gray-400">
                                    <span>Prev Payout:</span>
                                    <span className="text-gray-500 font-mono">
                                      {viewMode === "cash" ? `BDT ${data.prevValue.toFixed(2)}` : `${data.prevValue}%`}
                                    </span>
                                  </span>
                                  <span className="flex justify-between gap-4 text-gray-400 border-t border-[rgba(255,255,255,0.05)] pt-1 mt-1">
                                    <span>YoY Growth:</span>
                                    <span className={`font-mono font-bold ${isPositive ? "text-emerald-400" : isNegative ? "text-rose-450" : "text-gray-400"}`}>
                                      {isPositive ? "+" : ""}{data.growth}%
                                    </span>
                                  </span>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Bar dataKey="growth" barSize={24} radius={[4, 4, 0, 0]}>
                          {annualGrowthData.map((entry, index) => {
                            const yearInt = parseInt(entry.year);
                            const isHighlighted = selectedGrowthPeriod === "all" || 
                              (selectedGrowthPeriod === "3" && yearInt > latestYear - 3) ||
                              (selectedGrowthPeriod === "5" && yearInt > latestYear - 5) ||
                              (selectedGrowthPeriod === "10" && yearInt > latestYear - 10);

                            let fill = entry.growth >= 0 ? "#10B981" : "#EF4444";
                            let opacity = isHighlighted ? 1.0 : 0.15;

                            return (
                              <Cell 
                                key={`cell-growth-${index}`} 
                                fill={fill}
                                fillOpacity={opacity}
                                stroke={entry.growth >= 0 ? "#10B981" : "#EF4444"}
                                strokeOpacity={opacity}
                              />
                            );
                          })}
                        </Bar>
                        
                        {/* Highlight active CAGR level across the period */}
                        {activeCagr !== null && (
                          <ReferenceLine 
                            y={activeCagr} 
                            stroke="#A78BFA" 
                            strokeDasharray="4 4" 
                            strokeWidth={2}
                            label={{ 
                              value: `${selectedGrowthPeriod}-Yr CAGR: ${activeCagr}%`, 
                              position: "top", 
                              fill: "#C084FC", 
                              fontSize: 10,
                              fontFamily: "monospace",
                              fontWeight: "bold"
                            }} 
                          />
                        )}
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>

                {/* Detail narrative on YoY vs CAGR */}
                <div className="lg:col-span-4 bg-[#1A2235]/30 border border-[rgba(255,255,255,0.05)] rounded-2xl p-4 flex flex-col justify-between h-auto lg:h-full min-h-[220px]">
                  <div>
                    <h5 className="text-xs font-bold text-white font-display uppercase tracking-wide flex items-center gap-1.5">
                      <ArrowUpRight className="h-3.5 w-3.5 text-[#C084FC]" />
                      {selectedGrowthPeriod === "all" ? "Whole Era Summary" : `${selectedGrowthPeriod}-Year Focus Spectrum`}
                    </h5>
                    <div className="h-[1px] bg-[rgba(255,255,255,0.05)] my-2"></div>
                    
                    {(() => {
                      // stats for selected period
                      const filteredData = annualGrowthData.filter(d => {
                        const yr = parseInt(d.year);
                        if (selectedGrowthPeriod === "all") return true;
                        return yr > latestYear - parseInt(selectedGrowthPeriod);
                      });

                      const count = filteredData.length;
                      const positiveCount = filteredData.filter(d => d.growth > 0).length;
                      const negativeCount = filteredData.filter(d => d.growth < 0).length;
                      
                      const avgGrowth = count > 0 
                        ? parseFloat((filteredData.reduce((acc, d) => acc + d.growth, 0) / count).toFixed(2))
                        : 0;

                      return (
                        <div className="space-y-3 font-sans text-xs text-[#94A3B8]">
                          <p className="leading-relaxed">
                            {selectedGrowthPeriod === "all" ? (
                              `Across the full historical range, ${symbol} declared dividend payout changes representing both upward accretion and defensive consolidations.`
                            ) : (
                              `Focusing on the ${selectedGrowthPeriod}-year horizon (${latestYear - parseInt(selectedGrowthPeriod)} → ${latestYear}), the asset exhibits an annualized compound growth rate (CAGR) of ${activeCagr !== null ? `${activeCagr}%` : "N/A"}.`
                            )}
                          </p>
                          
                          <div className="space-y-1.5 font-mono text-[10px] bg-[#111827]/50 rounded-xl p-3 border border-[rgba(255,255,255,0.04)]">
                            <div className="flex justify-between border-b border-[rgba(255,255,255,0.03)] pb-1 mb-1 text-[#64748B] uppercase font-black text-[9px]">
                              <span>Metric Parameter</span>
                              <span>Value</span>
                            </div>
                            
                            <div className="flex justify-between">
                              <span>Evaluated Years:</span>
                              <span className="text-white font-bold">{count}</span>
                            </div>
                            <div className="flex justify-between text-emerald-400">
                              <span>Positive Growth Years:</span>
                              <span className="font-bold">{positiveCount} {positiveCount > 0 ? "▲" : ""}</span>
                            </div>
                            <div className="flex justify-between text-rose-450">
                              <span>Negative Growth Years:</span>
                              <span className="font-bold">{negativeCount} {negativeCount > 0 ? "▼" : ""}</span>
                            </div>
                            <div className="flex justify-between text-blue-300 font-bold border-t border-[rgba(255,255,255,0.03)] pt-1 mt-1">
                              <span>Avg Annual Growth:</span>
                              <span>{avgGrowth > 0 ? "+" : ""}{avgGrowth}%</span>
                            </div>

                            {activeCagr !== null && (
                              <div className="flex justify-between text-[#C084FC] font-extrabold border-t border-[rgba(255,255,255,0.03)] pt-1 mt-1">
                                <span>Horizon CAGR:</span>
                                <span>{activeCagr > 0 ? "+" : ""}{activeCagr}%</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                  
                  <div className="text-[9px] text-gray-500 font-mono italic mt-3 border-t border-[rgba(255,255,255,0.03)] pt-2">
                    * Note: CAGR measures the smooth annualized return, ignoring yearly peaks or valleys, whereas YoY bars show actual historical noise.
                  </div>
                </div>
              </div>
            </div>
          )}


          <div className="overflow-x-auto rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#111827]/50 shadow-[inset_0_2px_8px_rgba(0,0,0,0.3)] scrollbar-none -mx-1 px-1">
            <table className="w-full text-left text-xs text-[#CBD5E1] border-collapse">
              <thead>
                <tr className="bg-[#1A2235] text-[#94A3B8] font-mono text-[10px] tracking-wider border-b border-[rgba(255,255,255,0.08)] uppercase font-black">
                  <th className="px-4 py-3">Fiscal Year</th>
                  <th className="px-4 py-3">Distribution Type</th>
                  <th className="px-4 py-3 text-right">Dividend Rate %</th>
                  <th className="px-4 py-3 text-right">Payout per Share</th>
                  <th className="px-4 py-3">Record/Book Closure</th>
                  <th className="px-4 py-3">Disbursement Date</th>
                  <th className="px-4 py-3 max-w-[150px]">Auditor Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgba(255,255,255,0.08)]">
                {dividends.map((div, idx) => {
                  const isZero = div.percentage === 0;
                  return (
                    <tr 
                      key={`${div.year}-${idx}`} 
                      className="hover:bg-[#1A2235]/50 transition-colors font-sans"
                    >
                      <td className="px-4 py-3.5 font-bold font-mono text-white">{div.year}</td>
                      <td className="px-4 py-3.5">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-black border tracking-wide uppercase ${
                          isZero 
                            ? "bg-red-500/10 border-red-500/20 text-red-400" 
                            : "bg-blue-500/10 border-blue-500/20 text-blue-400"
                        }`}>
                          {div.type}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono font-bold text-[#CBD5E1]">
                        {isZero ? "-" : `${div.percentage}%`}
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono font-bold text-emerald-400">
                        {isZero ? "-" : `BDT ${div.valuePerShare.toFixed(2)}`}
                      </td>
                      <td className="px-4 py-3.5 text-[#64748B] font-mono text-[11px] font-semibold">{div.recordDate}</td>
                      <td className="px-4 py-3.5 text-[#64748B] font-mono text-[11px] font-semibold">{div.paymentDate}</td>
                      <td className="px-4 py-3.5 text-[#64748B] italic text-[11px] truncate max-w-[180px] font-medium" title={div.remarks}>
                        {div.remarks || "Regular dispatch"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Advisory Note */}
      <div className="flex gap-2.5 items-start mt-4 p-4 bg-[#1A2235]/40 rounded-2xl border border-blue-500/20 text-[11px] text-[#94A3B8] leading-relaxed shadow-[0_2px_12px_rgba(0,0,0,0.4)]">
        <Info className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
        <span className="font-sans">
          <strong>Investor Disclosure:</strong> Dividends declared by DSE counters are approved in the general board meetings of each corporate listing. Yield rates fluctuate under macroeconomic balance-sheet transformations. Future disbursements are subject to direct cash reserves solvency indices.
        </span>
      </div>
    </div>
  );
}
