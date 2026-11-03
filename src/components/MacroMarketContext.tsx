import React, { useState, useEffect } from "react";
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Legend 
} from "recharts";
import { 
  Activity, 
  TrendingUp, 
  TrendingDown, 
  Percent, 
  Scale, 
  Globe, 
  Grid, 
  HelpCircle,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  Calculator,
  AlertCircle
} from "lucide-react";

interface MacroMarketContextProps {
  selectedSymbol: string;
  selectedStockName: string;
  stockChartData: { date: string; close: number; open: number; high: number; low: number; volume?: number }[];
}

interface IndexQuote {
  symbol: string;
  name: string;
  value: number;
  change: number;
  changePercent: number;
}

interface IndexState {
  DSEX: IndexQuote;
  DSES: IndexQuote;
  DS30: IndexQuote;
  timestamp: string;
  source?: string;
}

function normalizeDateKey(input: string): string {
  const d = new Date(input);
  if (!Number.isNaN(d.getTime())) {
    return d.toISOString().slice(0, 10);
  }
  return input.trim();
}

export default function MacroMarketContext({ 
  selectedSymbol, 
  selectedStockName, 
  stockChartData 
}: MacroMarketContextProps) {
  const [indexData, setIndexData] = useState<IndexState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [historicalIndex, setHistoricalIndex] = useState<{ date: string; close: number }[]>([]);
  const [historicalSource, setHistoricalSource] = useState<string>("");
  const [historyLoading, setHistoryLoading] = useState(true);

  // New state variables to fetch exactly 24 months of historical stock data for high precision Comparative Analysis
  const [stockHistory24M, setStockHistory24M] = useState<{ date: string; close: number; open: number; high: number; low: number; volume?: number }[]>([]);
  const [stockHistoryLoading, setStockHistoryLoading] = useState(false);
  
  // Selected comparison index: DSEX, DSES, or DS30
  const [selectedIndex, setSelectedIndex] = useState<"DSEX" | "DSES" | "DS30">("DSEX");
  // Visual Mode: normal (Dual Y-Axis) vs normalized (% return since start of chart)
  const [viewMode, setViewMode] = useState<"dual" | "normalized">("normalized");

  // Stock history coverage from API
  const [coverageStatus, setCoverageStatus] = useState<"None" | "Partial" | "Sufficient" | "FullOneYear">("None");

  const fetchStockCoverage = async (symbol: string) => {
    try {
      const res = await fetch(`/api/history/${symbol}/coverage`);
      if (res.ok) {
        const contentType = res.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const result = await res.json();
          setCoverageStatus(result.coverageStatus || "None");
        } else {
          console.warn("[MacroMarketContext] Coverage response not JSON.");
        }
      }
    } catch (err) {
      console.error("Failed fetching stock history coverage:", err);
    }
  };

  const fetchStockHistory24M = async (symbol: string) => {
    setStockHistoryLoading(true);
    try {
      // 24 months of calendar days is 730 days, which returns all stock files' records with excellent depth
      const res = await fetch(`/api/stocks/${symbol}/chart?days=730`);
      if (res.ok) {
        const contentType = res.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const result = await res.json();
          if (result && Array.isArray(result.data)) {
            setStockHistory24M(result.data);
            return;
          }
        }
      }
      setStockHistory24M([]);
    } catch (err) {
      console.error("Failed fetching 24M stock history:", err);
      setStockHistory24M([]);
    } finally {
      setStockHistoryLoading(false);
    }
  };

  useEffect(() => {
    if (selectedSymbol) {
      fetchStockCoverage(selectedSymbol);
      fetchStockHistory24M(selectedSymbol);
    }
  }, [selectedSymbol]);

  // Decoupled stock data: uses the 24M comprehensive history if loaded, otherwise falls back to the short main chart stockChartData prop
  const activeStockData = React.useMemo(() => {
    return stockHistory24M.length > 0 ? stockHistory24M : (stockChartData || []);
  }, [stockHistory24M, stockChartData]);

  // Fetch index quotes
  const fetchIndexQuotes = async () => {
    try {
      const res = await fetch("/api/market/indices");
      if (!res.ok) {
        console.warn("[MacroMarketContext] Indices endpoint warming up...");
        return;
      }
      
      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        console.warn("[MacroMarketContext] Server index endpoint returned non-JSON during warmup.");
        return;
      }
      
      const data = await res.json();
      setIndexData(data);
      setError(null);
    } catch (err: any) {
      console.warn("[MacroMarketContext] Index feed temporarily offline:", err.message);
      setError("Market intelligence feed temporarily disconnected.");
    } finally {
      setLoading(false);
    }
  };

  // Fetch index history
  const fetchIndexHistory = async (symbol: string) => {
    setHistoryLoading(true);
    try {
      const res = await fetch(`/api/market/indices/${symbol}/chart?days=5000`);
      if (!res.ok) throw new Error("Failed to fetch historical index charts.");
      
      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error("Invalid response format (expected application/json).");
      }
      
      const result = await res.json();
      setHistoricalSource(result.source || "");
      if (result && Array.isArray(result.data)) {
        setHistoricalIndex(result.data.map((d: any) => {
          const closeVal = d.close !== undefined ? d.close : (d.value !== undefined ? d.value : d.close_value);
          return {
            date: d.date,
            close: typeof closeVal === "string" ? parseFloat(closeVal) : closeVal
          };
        }));
      } else {
        setHistoricalIndex([]);
      }
    } catch (err) {
      console.error("Failed downloading index historical line:", err);
      setHistoricalIndex([]);
      setHistoricalSource("NoHistoricalIndexData");
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    fetchIndexQuotes();
    // Poll index quotes every 3 minutes
    const interval = setInterval(fetchIndexQuotes, 3 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    fetchIndexHistory(selectedIndex);
  }, [selectedIndex]);

  // Combine stock data and index data on the same timeline
  const combinedChartData = React.useMemo(() => {
    if (!activeStockData || activeStockData.length === 0 || historicalIndex.length === 0) return [];

    // Map by date to guarantee match
    const indexMap = new Map(
      historicalIndex.map(item => [normalizeDateKey(item.date), item.close])
    );
    
    // Find the first overlapping date point and fetch its starting closes for both stock and index
    const { firstMatchedStockClose, firstMatchedIndexClose } = (() => {
      for (const item of activeStockData) {
        const key = normalizeDateKey(item.date);
        const idxVal = indexMap.get(key);
        if (idxVal != null) {
          return { firstMatchedStockClose: item.close, firstMatchedIndexClose: idxVal };
        }
      }
      return { 
        firstMatchedStockClose: activeStockData[0]?.close || 1, 
        firstMatchedIndexClose: historicalIndex[0]?.close || 1 
      };
    })();

    return activeStockData.map((item, idx) => {
      const stockDateKey = normalizeDateKey(item.date);
      const indexClose = indexMap.get(stockDateKey);

      const alignedIndexClose = indexClose ?? null;

      if (alignedIndexClose === null) return null;
      
      const correctStockReturn = ((item.close - firstMatchedStockClose) / firstMatchedStockClose) * 100;
      const correctIndexReturn = (((alignedIndexClose as number) - (firstMatchedIndexClose as number)) / (firstMatchedIndexClose as number)) * 100;

      return {
        date: item.date,
        stockRaw: item.close,
        indexRaw: alignedIndexClose,
        stockReturn: parseFloat(correctStockReturn.toFixed(2)),
        indexReturn: parseFloat(correctIndexReturn.toFixed(2)),
        // Display tags
        [`${selectedSymbol}_raw`]: item.close,
        [`${selectedIndex}_raw`]: alignedIndexClose,
        [`${selectedSymbol}_return`]: parseFloat(correctStockReturn.toFixed(2)),
        [`${selectedIndex}_return`]: parseFloat(correctIndexReturn.toFixed(2)),
      };
    }).filter(Boolean) as any[];
  }, [activeStockData, historicalIndex, selectedSymbol, selectedIndex]);

  // Strictly date-aligned pairs
  const alignedPairs = React.useMemo(() => {
    if (!activeStockData || activeStockData.length === 0 || historicalIndex.length === 0) return [];

    const indexMap = new Map<string, number>();
    for (const item of historicalIndex) {
      indexMap.set(normalizeDateKey(item.date), item.close);
    }

    const pairs: { date: string; stockClose: number; indexClose: number }[] = [];
    for (const item of activeStockData) {
      const dateKey = normalizeDateKey(item.date);
      if (indexMap.has(dateKey)) {
        pairs.push({
          date: item.date,
          stockClose: item.close,
          indexClose: indexMap.get(dateKey)!,
        });
      }
    }

    return pairs.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [activeStockData, historicalIndex]);

  // Quantitative benchmark calculations
  const benchmarkStats = React.useMemo(() => {
    if (alignedPairs.length < 2) return null;

    const N = alignedPairs.length;
    const oldest = alignedPairs[0];
    const latest = alignedPairs[N - 1];

    const stockReturn = ((latest.stockClose - oldest.stockClose) / oldest.stockClose) * 100;
    const indexReturn = ((latest.indexClose - oldest.indexClose) / oldest.indexClose) * 100;

    const excessReturn = stockReturn - indexReturn;
    const relativeStrengthRatio = (latest.stockClose / oldest.stockClose) / (latest.indexClose / oldest.indexClose);

    // Calculate daily variances, covariance, beta, correlation
    const stockDailyReturns: number[] = [];
    const indexDailyReturns: number[] = [];

    for (let i = 1; i < N; i++) {
      const prev = alignedPairs[i - 1];
      const curr = alignedPairs[i];
      
      const sRet = (curr.stockClose - prev.stockClose) / prev.stockClose;
      const idxRet = (curr.indexClose - prev.indexClose) / prev.indexClose;
      
      stockDailyReturns.push(sRet);
      indexDailyReturns.push(idxRet);
    }

    const M = stockDailyReturns.length;
    if (M === 0) return null;

    const meanStockReturn = stockDailyReturns.reduce((sum, r) => sum + r, 0) / M;
    const meanIndexReturn = indexDailyReturns.reduce((sum, r) => sum + r, 0) / M;

    let varStock = 0;
    let varIndex = 0;
    let cov = 0;

    for (let i = 0; i < M; i++) {
      const devStock = stockDailyReturns[i] - meanStockReturn;
      const devIndex = indexDailyReturns[i] - meanIndexReturn;
      
      varStock += devStock * devStock;
      varIndex += devIndex * devIndex;
      cov += devStock * devIndex;
    }

    const div = M > 1 ? M - 1 : 1;
    varStock /= div;
    varIndex /= div;
    cov /= div;

    const stdevStockDaily = Math.sqrt(varStock);
    const stdevIndexDaily = Math.sqrt(varIndex);

    // Annualized Volatility assuming 252 active trading days/year
    const volStockAnnual = stdevStockDaily * Math.sqrt(252) * 100;
    const volIndexAnnual = stdevIndexDaily * Math.sqrt(252) * 100;
    const volDiff = volStockAnnual - volIndexAnnual;

    const beta = varIndex > 0 ? cov / varIndex : 1.0;
    const stdevProduct = stdevStockDaily * stdevIndexDaily;
    const correlation = stdevProduct > 0 ? cov / stdevProduct : 0.0;

    // Drawdown Calculation
    let peakStock = -Infinity;
    let maxDrawdownStock = 0;
    for (let i = 0; i < N; i++) {
      const price = alignedPairs[i].stockClose;
      if (price > peakStock) peakStock = price;
      const dd = (peakStock - price) / peakStock;
      if (dd > maxDrawdownStock) maxDrawdownStock = dd;
    }

    let peakIndex = -Infinity;
    let maxDrawdownIndex = 0;
    for (let i = 0; i < N; i++) {
      const price = alignedPairs[i].indexClose;
      if (price > peakIndex) peakIndex = price;
      const dd = (peakIndex - price) / peakIndex;
      if (dd > maxDrawdownIndex) maxDrawdownIndex = dd;
    }

    const getReturnOfLastKDays = (k: number) => {
      if (N < 2) return { stock: 0, index: 0, exist: false };
      const indexFromEnd = Math.max(0, N - k);
      const startPoint = alignedPairs[indexFromEnd];
      const endPoint = alignedPairs[N - 1];
      
      const sRet = ((endPoint.stockClose - startPoint.stockClose) / startPoint.stockClose) * 100;
      const iRet = ((endPoint.indexClose - startPoint.indexClose) / startPoint.indexClose) * 100;
      return { stock: sRet, index: iRet, exist: N >= k };
    };

    const timeframe5D = getReturnOfLastKDays(5);
    const timeframe20D = getReturnOfLastKDays(20);

    let rating: "OUTPERFORM" | "UNDERPERFORM" | "MARKET PERFORM" = "MARKET PERFORM";
    let ratingColor = "bg-[#1A2235]/40 border-[rgba(255,255,255,0.05)] text-white";
    let ratingBadge = "bg-[#1A2235] text-white border-[rgba(255,255,255,0.08)]";
    let ratingDescription = "";

    if (excessReturn > 1.5) {
      rating = "OUTPERFORM";
      ratingColor = "bg-emerald-500/10 border-emerald-500/20 text-emerald-300";
      ratingBadge = "bg-emerald-500/22 text-emerald-300 border-emerald-500/30";
      ratingDescription = `${selectedSymbol} has outpaced the ${selectedIndex} index by +${excessReturn.toFixed(1)}% absolute return over the aligned ${N}-day historical observation window.`;
    } else if (excessReturn < -1.5) {
      rating = "UNDERPERFORM";
      ratingColor = "bg-rose-500/10 border-rose-500/20 text-rose-300";
      ratingBadge = "bg-rose-500/22 text-rose-300 border-rose-500/30";
      ratingDescription = `${selectedSymbol} has lagged behind the ${selectedIndex} index by ${excessReturn.toFixed(1)}% absolute return over the aligned ${N}-day historical observation window.`;
    } else {
      rating = "MARKET PERFORM";
      ratingColor = "bg-amber-500/10 border-amber-500/20 text-amber-300";
      ratingBadge = "bg-amber-500/22 text-amber-300 border-amber-500/30";
      ratingDescription = `${selectedSymbol} has tracked the ${selectedIndex} index within a safe tracking difference threshold of ±1.5%.`;
    }

    return {
      alignedDays: N,
      stockReturn,
      indexReturn,
      excessReturn,
      relativeStrengthRatio,
      beta,
      correlation,
      volStockAnnual,
      volIndexAnnual,
      volDiff,
      maxDrawdownStock: maxDrawdownStock * 100,
      maxDrawdownIndex: maxDrawdownIndex * 100,
      timeframe5D,
      timeframe20D,
      rating,
      ratingColor,
      ratingBadge,
      ratingDescription
    };
  }, [alignedPairs, selectedSymbol, selectedIndex]);

  const activeIndexDetails = indexData ? indexData[selectedIndex] : null;

  return (
    <div className="space-y-6" id="macro-index-dashboard">
      
      {/* 1. Real-time Index Bento Cards */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="font-display text-sm font-extrabold text-[#F0F4FF] tracking-tight flex items-center gap-1.5 uppercase">
              <Globe className="h-4 w-4 text-blue-400 animate-spin-slow" /> Dhaka Brokerage Macro Indices
            </h3>
            <p className="text-[10px] text-[#94A3B8] font-sans mt-0.5">Real-time benchmark indices retrieved directly from Dhaka Stock Exchange (DSE)</p>
          </div>
          
          <button 
            onClick={() => {
              setLoading(true);
              fetchIndexQuotes();
              fetchIndexHistory(selectedIndex);
            }}
            className="p-1 px-2.5 border border-[rgba(255,255,255,0.08)] hover:border-indigo-500/30 rounded-xl bg-[#1A2235]/40 hover:bg-[#1A2235]/65 flex items-center gap-1.5 text-[10px] font-mono text-indigo-300 font-extrabold cursor-pointer transition-all"
            title="Force refresh index quotes"
          >
            <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh Tickers</span>
          </button>
        </div>

        {loading && !indexData ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map(n => (
              <div key={n} className="bg-[#111827] border border-[rgba(255,255,255,0.08)] rounded-3xl p-5 shadow-sm animate-pulse h-28 flex flex-col justify-between">
                <div className="h-4 bg-[#1F2937] rounded w-1/3"></div>
                <div className="h-8 bg-[#1F2937] rounded w-2/3 mt-2"></div>
                <div className="h-3 bg-[#1F2937] rounded w-1/2"></div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="p-4 bg-rose-950/20 border border-rose-800/30 rounded-2xl text-rose-400 text-xs text-center font-mono">
            {error || "Indices are temporarily unavailable. Attempting offline synthesis fallback..."}
          </div>
        ) : indexData ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            {/* DSEX Card */}
            <div 
              onClick={() => setSelectedIndex("DSEX")}
              className={`p-5 rounded-3xl border transition-all duration-200 cursor-pointer relative overflow-hidden group ${
                selectedIndex === "DSEX" 
                  ? "bg-blue-600/10 border-blue-500/40 shadow-md ring-1 ring-blue-500/10" 
                  : "bg-[#111827] border-[rgba(255,255,255,0.08)] hover:bg-[#1A2235]/40 hover:border-[#64748B] shadow-sm"
              }`}
            >
              <div className="absolute right-0 top-0 w-20 h-20 bg-blue-500/5 rounded-full blur-2xl pointer-events-none group-hover:scale-125 transition-transform"></div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-display font-black text-white tracking-tight">DSEX INDEX</span>
                <span className="text-[9px] font-mono font-bold text-[#94A3B8] bg-[#1A2235] border border-[rgba(255,255,255,0.08)] px-1.5 py-0.5 rounded-md font-sans">MAIN</span>
              </div>
              <div className="text-xl font-mono font-black text-white">{indexData.DSEX.value.toLocaleString()}</div>
              
              <div className="flex items-center justify-between mt-3 pt-2 border-t border-[rgba(255,255,255,0.05)]">
                <span className={`text-[11px] font-mono font-black flex items-center gap-0.5 ${
                  indexData.DSEX.change >= 0 ? "text-emerald-400" : "text-rose-400"
                }`}>
                  {indexData.DSEX.change >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                  {indexData.DSEX.change >= 0 ? "+" : ""}{indexData.DSEX.changePercent}%
                </span>
                <span className="text-[10px] font-mono text-[#64748B] font-medium">
                  Change: {indexData.DSEX.change >= 0 ? "+" : ""}{indexData.DSEX.change}
                </span>
              </div>
            </div>

            {/* DSES Card */}
            <div 
              onClick={() => setSelectedIndex("DSES")}
              className={`p-5 rounded-3xl border transition-all duration-200 cursor-pointer relative overflow-hidden group ${
                selectedIndex === "DSES" 
                  ? "bg-emerald-600/10 border-emerald-500/40 shadow-md ring-1 ring-emerald-500/5" 
                  : "bg-[#111827] border-[rgba(255,255,255,0.08)] hover:bg-[#1A2235]/40 hover:border-[#64748B] shadow-sm"
              }`}
            >
              <div className="absolute right-0 top-0 w-20 h-20 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none group-hover:scale-125 transition-transform"></div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-display font-black text-white tracking-tight">DSES INDEX</span>
                <span className="text-[9px] font-mono font-bold text-[#94A3B8] bg-[#1A2235] border border-[rgba(255,255,255,0.08)] px-1.5 py-0.5 rounded-md font-sans">SHARIAH</span>
              </div>
              <div className="text-xl font-mono font-black text-white">{indexData.DSES.value.toLocaleString()}</div>
              
              <div className="flex items-center justify-between mt-3 pt-2 border-t border-[rgba(255,255,255,0.05)]">
                <span className={`text-[11px] font-mono font-black flex items-center gap-0.5 ${
                  indexData.DSES.change >= 0 ? "text-emerald-400" : "text-rose-400"
                }`}>
                  {indexData.DSES.change >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                  {indexData.DSES.change >= 0 ? "+" : ""}{indexData.DSES.changePercent}%
                </span>
                <span className="text-[10px] font-mono text-[#64748B] font-medium">
                  Change: {indexData.DSES.change >= 0 ? "+" : ""}{indexData.DSES.change}
                </span>
              </div>
            </div>

            {/* DS30 Card */}
            <div 
              onClick={() => setSelectedIndex("DS30")}
              className={`p-5 rounded-3xl border transition-all duration-200 cursor-pointer relative overflow-hidden group ${
                selectedIndex === "DS30" 
                  ? "bg-indigo-600/10 border-indigo-500/40 shadow-md ring-1 ring-indigo-500/10" 
                  : "bg-[#111827] border-[rgba(255,255,255,0.08)] hover:bg-[#1A2235]/40 hover:border-[#64748B] shadow-sm"
              }`}
            >
              <div className="absolute right-0 top-0 w-20 h-20 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none group-hover:scale-125 transition-transform"></div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-display font-black text-white tracking-tight">DS30 INDEX</span>
                <span className="text-[9px] font-mono font-bold text-[#94A3B8] bg-[#1A2235] border border-[rgba(255,255,255,0.08)] px-1.5 py-0.5 rounded-md font-sans">BLUE-CHIP</span>
              </div>
              <div className="text-xl font-mono font-black text-white">{indexData.DS30.value.toLocaleString()}</div>
              
              <div className="flex items-center justify-between mt-3 pt-2 border-t border-[rgba(255,255,255,0.05)]">
                <span className={`text-[11px] font-mono font-black flex items-center gap-0.5 ${
                  indexData.DS30.change >= 0 ? "text-emerald-400" : "text-rose-400"
                }`}>
                  {indexData.DS30.change >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                  {indexData.DS30.change >= 0 ? "+" : ""}{indexData.DS30.changePercent}%
                </span>
                <span className="text-[10px] font-mono text-[#64748B] font-medium">
                  Change: {indexData.DS30.change >= 0 ? "+" : ""}{indexData.DS30.change}
                </span>
              </div>
            </div>

          </div>
        ) : null}
      </div>

      {/* 2. Interactive Comparative Charts */}
      <div className="bg-[#111827] border border-[rgba(255,255,255,0.08)] rounded-3xl p-6 shadow-sm flex flex-col justify-between">
        
        <div className="flex flex-wrap gap-4 justify-between items-center mb-5 pb-3 border-b border-[rgba(255,255,255,0.06)]">
          <div>
            <h4 className="text-sm font-display font-extrabold text-white uppercase tracking-widest flex items-center gap-1.5">
              <Activity className="h-4 w-4 text-indigo-400 animate-pulse" /> {selectedIndex} vs {selectedSymbol} Comparative Analysis
            </h4>
            <span className="text-[10px] font-mono text-[#94A3B8]">Normalized Return trends overlaying individual beta correlation</span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Index Coverage Warning Chip */}
            <a
              href="/checklist.html"
              target="_blank"
              rel="noopener noreferrer"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-mono font-extrabold tracking-wider border uppercase transition-all duration-200 cursor-pointer shadow-sm hover:scale-[1.02] ${
                historicalIndex.length >= 1200
                  ? "bg-[#10B981]/10 text-emerald-400 border-emerald-500/20"
                  : "bg-amber-500/10 text-amber-400 border-amber-500/20 animate-pulse"
              }`}
              title="Click to view the manual historical download status and Checklist"
            >
              <div className={`w-1.5 h-1.5 rounded-full ${historicalIndex.length >= 1200 ? "bg-emerald-400" : "bg-amber-400"}`} />
              <span>
                {selectedIndex}: {historicalIndex.length} Days ({historicalIndex.length >= 1200 ? "5+ Yrs Full" : `${parseFloat((historicalIndex.length / 260).toFixed(1))} Yrs Incomplete`}) ↗
              </span>
            </a>

            {/* View Mode selection */}
            <div className="flex bg-[#1A2235] p-0.5 rounded-xl border border-[rgba(255,255,255,0.08)] min-h-8">
              <button
                onClick={() => setViewMode("normalized")}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-[9px] font-mono font-black tracking-wider transition-all cursor-pointer ${
                  viewMode === "normalized"
                    ? "bg-indigo-600 text-white shadow"
                    : "text-[#94A3B8] hover:text-white hover:bg-[#1A2235]/60"
                }`}
                title="Normalize starting points to 0% growth to evaluate exact alpha return"
              >
                <Percent className="h-3 w-3" />
                <span>NORMALIZED (%)</span>
              </button>
              <button
                onClick={() => setViewMode("dual")}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-[9px] font-mono font-black tracking-wider transition-all cursor-pointer ${
                  viewMode === "dual"
                    ? "bg-indigo-600 text-white shadow"
                    : "text-[#94A3B8] hover:text-white hover:bg-[#1A2235]/60"
                }`}
                title="Compare absolute prices side-by-side using dual co-aligned Y-axes"
              >
                <Scale className="h-3 w-3" />
                <span>DUAL Y-AXIS (RAW)</span>
              </button>
            </div>
          </div>
        </div>

        {/* Explain tooltip */}
        <div className="mb-4 bg-[#1A2235]/40 border border-[rgba(255,255,255,0.05)] rounded-2xl p-4 flex gap-3 items-start">
          <HelpCircle className="h-4 w-4 text-blue-400 mt-0.5 shrink-0" />
          <div className="text-[10.5px] leading-relaxed text-[#CBD5E1] space-y-1">
            {viewMode === "normalized" ? (
              <p>
                <strong>Normalized mode:</strong> Both {selectedSymbol} (individual) and {selectedIndex} (macro) series are baseline adjusted to <strong>0%</strong> at the start of the 24-month visual envelope. This isolates excess return (<strong>Alpha</strong>) and highlights general market trend conformity (<strong>Beta</strong>).
              </p>
            ) : (
              <p>
                <strong>Dual Y-Axis mode:</strong> Compares raw valuations side-by-side. Individual share prices are mapped to the <strong>Left Y-Axis</strong> (BDT) while the index coordinates are mapped to the <strong>Right Y-Axis</strong> (Points). Good for visual symmetry identification.
              </p>
            )}
          </div>
        </div>

        {(() => {
          if (!historicalIndex.length || !activeStockData || !activeStockData.length) return null;

          const indexSpanDays = Math.round(
            (new Date(historicalIndex[historicalIndex.length - 1].date).getTime() -
             new Date(historicalIndex[0].date).getTime()) / 86400000
          );
          const stockSpanDays = Math.round(
            (new Date(activeStockData[activeStockData.length - 1].date).getTime() -
             new Date(activeStockData[0].date).getTime()) / 86400000
          );

          if (stockSpanDays > indexSpanDays + 30) {
            const indexYears = (indexSpanDays / 365).toFixed(1);
            const stockYears = (stockSpanDays / 365).toFixed(1);
            return (
              <div className="mb-2 px-3 py-1.5 rounded-xl bg-[#F59E0B]/8 border border-[#F59E0B]/20 text-[10px] font-mono text-[#F59E0B]">
                ⚠️ {selectedSymbol} has {stockYears} years of price history,
                but {selectedIndex} only has {indexYears} years. Comparative
                analysis is limited to the {benchmarkStats?.alignedDays ?? "—"} overlapping days. Extend {selectedIndex} history via
                Data Console for a full comparison.
              </div>
            );
          }
          return null;
        })()}

        <div className="h-80 w-full relative">
          {(historyLoading || stockHistoryLoading) ? (
            <div className="flex h-full items-center justify-center font-mono text-xs text-blue-600 animate-pulse">
              Correlating macro historical curves...
            </div>
          ) : (!activeStockData || activeStockData.length === 0) ? (
            <div className="flex h-full flex-col items-center justify-center font-mono text-xs text-slate-400 text-center p-4">
              <span>{selectedSymbol} has no historical data yet. Upload via Data Console.</span>
            </div>
          ) : (!historicalIndex || historicalIndex.length === 0) ? (
            <div className="flex h-full flex-col items-center justify-center font-mono text-xs text-slate-400 text-center p-4">
              <span>{selectedIndex} unavailable. Check Data Console connection.</span>
            </div>
          ) : (alignedPairs.length < 2) ? (
            <div className="flex h-full flex-col items-center justify-center font-mono text-xs text-slate-400 text-center p-4">
              <span>No overlapping dates. {selectedSymbol}: {activeStockData[0]?.date ? normalizeDateKey(activeStockData[0].date) : "N/A"}–{activeStockData[activeStockData.length - 1]?.date ? normalizeDateKey(activeStockData[activeStockData.length - 1].date) : "N/A"} vs {selectedIndex}: {historicalIndex[0]?.date ? normalizeDateKey(historicalIndex[0].date) : "N/A"}–{historicalIndex[historicalIndex.length - 1]?.date ? normalizeDateKey(historicalIndex[historicalIndex.length - 1].date) : "N/A"}.</span>
            </div>
          ) : combinedChartData.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center font-mono text-xs text-[#94A3B8] text-center space-y-2 p-4">
              No chart data to display.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={combinedChartData} margin={{ top: 10, right: -5, left: -22, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis 
                  dataKey="date" 
                  stroke="#94a3b8" 
                  fontSize={10} 
                  fontFamily="monospace" 
                  tickLine={false}
                />
                
                {/* Condition Y Axes based on View Mode */}
                {viewMode === "normalized" ? (
                  <>
                    <YAxis 
                      stroke="#94a3b8" 
                      fontSize={10} 
                      fontFamily="monospace" 
                      tickLine={false} 
                      label={{ value: "Return (%)", angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fontSize: 10, fill: '#64748b' }, dx: -2 }}
                    />
                    <Tooltip 
                      contentStyle={{ background: "#0b1329", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "16px", outline: "none" }}
                      labelStyle={{ color: "#94a3b8", fontFamily: "monospace", fontSize: 11, fontWeight: "bold" }}
                      itemStyle={{ fontFamily: "monospace", fontSize: 11 }}
                      formatter={(val: any, name: any) => {
                        const parsedName = name.replace("_return", " % Growth");
                        const color = name.includes(selectedSymbol) ? "#10b981" : "#3b82f6";
                        return [`${val >= 0 ? "+" : ""}${val}%`, parsedName, { color }];
                      }}
                    />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: 9, fontFamily: 'monospace', fontWeight: "bold" }} />
                    <Line 
                      name={`${selectedSymbol}_return`}
                      type="monotone" 
                      dataKey="stockReturn" 
                      stroke="#10b981" 
                      strokeWidth={2.5} 
                      dot={false}
                      activeDot={{ r: 5 }}
                    />
                    <Line 
                      name={`${selectedIndex}_return`}
                      type="monotone" 
                      dataKey="indexReturn" 
                      stroke="#3b82f6" 
                      strokeWidth={2} 
                      strokeDasharray="4 4"
                      dot={false}
                      activeDot={{ r: 4 }}
                    />
                  </>
                ) : (
                  <>
                    <YAxis 
                      yAxisId="left"
                      stroke="#10b981" 
                      fontSize={10} 
                      fontFamily="monospace" 
                      tickLine={false} 
                      label={{ value: `${selectedSymbol} Price (BDT)`, angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fontSize: 9, fill: '#10b981' }, dx: -2 }}
                    />
                    <YAxis 
                      yAxisId="right"
                      orientation="right"
                      stroke="#3b82f6" 
                      fontSize={10} 
                      fontFamily="monospace" 
                      tickLine={false} 
                      label={{ value: `${selectedIndex} Points`, angle: 90, position: 'insideRight', style: { textAnchor: 'middle', fontSize: 9, fill: '#3b82f6' }, dy: -2 }}
                    />
                    <Tooltip 
                      contentStyle={{ background: "#0b1329", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "16px", outline: "none" }}
                      labelStyle={{ color: "#94a3b8", fontFamily: "monospace", fontSize: 11, fontWeight: "bold" }}
                      itemStyle={{ fontFamily: "monospace", fontSize: 11 }}
                      formatter={(val: any, name: any) => {
                        const parsedName = name.replace("_raw", "");
                        const isStock = name.includes(selectedSymbol);
                        const labelValue = isStock ? `BDT ${val.toFixed(2)}` : `${val.toFixed(2)} pts`;
                        const color = isStock ? "#10b981" : "#3b82f6";
                        return [labelValue, parsedName, { color }];
                      }}
                    />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: 9, fontFamily: 'monospace', fontWeight: "bold" }} />
                    <Line 
                      yAxisId="left"
                      name={`${selectedSymbol}_raw`}
                      type="monotone" 
                      dataKey="stockRaw" 
                      stroke="#10b981" 
                      strokeWidth={2.5} 
                      dot={false}
                      activeDot={{ r: 5 }}
                    />
                    <Line 
                      yAxisId="right"
                      name={`${selectedIndex}_raw`}
                      type="monotone" 
                      dataKey="indexRaw" 
                      stroke="#3b82f6" 
                      strokeWidth={2} 
                      strokeDasharray="4 4"
                      dot={false}
                      activeDot={{ r: 4 }}
                    />
                  </>
                )}
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
        <div className="mt-3 space-y-2">
          <p className="text-[10px] text-slate-400 font-mono">
            * Comparison uses matched trading dates when available; otherwise aligned by sequence.
          </p>
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="text-[10px] font-sans font-semibold text-slate-400">Index Source:</span>
            {(!historicalSource || historicalSource === "NoHistoricalData" || historicalSource === "NoHistoricalIndexData") ? (
              <span className="font-sans font-bold text-[#94A3B8] bg-[#1A2235] border border-[rgba(255,255,255,0.08)] px-2 py-0.5 rounded text-[9px] uppercase">
                Missing Data
              </span>
            ) : (historicalSource === "DemoSimulation" || historicalSource === "Simulation" || historicalSource === "GeneratedDemoIndexHistory" || historicalSource === "GeneratedIndexHistory") ? (
              <span className="font-sans font-bold text-amber-400 bg-amber-500/15 border border-amber-500/20 px-2 py-0.5 rounded text-[9px] uppercase">
                Simulation Fallback
              </span>
            ) : (
              <span className="font-sans font-bold text-emerald-400 bg-emerald-500/15 border border-emerald-500/20 px-2 py-0.5 rounded text-[9px] uppercase">
                Historical ({historicalSource})
              </span>
            )}
          </div>
        </div>

        {/* Dynamic Correlation Summary */}
        {activeIndexDetails && (
          <div className="mt-5 pt-4 border-t border-[rgba(255,255,255,0.06)] flex flex-wrap justify-between items-center text-xs text-slate-400">
            <span className="flex items-center gap-1">
              <span>Primary Benchmark:</span>
              <strong className="text-white font-bold">{activeIndexDetails.name}</strong>
              <span className={`font-bold px-1.5 py-0.5 rounded ${
                activeIndexDetails.change >= 0 ? "text-emerald-400 bg-emerald-500/10" : "text-rose-400 bg-rose-500/10"
              }`}>
                {activeIndexDetails.change >= 0 ? "▲" : "▼"} {activeIndexDetails.changePercent}%
              </span>
            </span>
            
            <span className="text-[10px] text-[#94A3B8] font-mono">
              Last DSE Sync: {indexData?.timestamp ? new Date(indexData.timestamp).toLocaleTimeString() : "Pending"}
            </span>
          </div>
        )}

      </div>

      {/* 3. Quantitative Benchmark Comparison Report */}
      {benchmarkStats ? (
        <div className="bg-[#111827] border border-[rgba(255,255,255,0.08)] rounded-3xl p-6 shadow-sm space-y-6" id="benchmark-coefficents-bento-card">
          
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div className="flex items-center gap-2">
              <Calculator className="h-5 w-5 text-indigo-400" />
              <div>
                <h4 className="text-sm font-display font-extrabold text-white uppercase tracking-wider">
                  Quantitative {selectedIndex} Benchmark Report
                </h4>
                <p className="text-[10px] text-[#94A3B8] font-sans mt-0.5">
                  Strictly date-aligned mathematical tracking analysis of {selectedSymbol} relative to the market index over {benchmarkStats.alignedDays} trading days
                </p>
              </div>
            </div>
            
            <span className="text-[10px] font-mono font-bold bg-indigo-950/30 text-indigo-400 border border-indigo-500/20 px-2.5 py-0.5 rounded-full uppercase">
              {benchmarkStats.alignedDays}-Day Aligned Match
            </span>
          </div>

          {/* Verdict Banner */}
          <div className={`p-4 rounded-3xl border flex flex-col md:flex-row gap-4 items-start md:items-center justify-between transition-all ${
            benchmarkStats.rating === "OUTPERFORM" 
              ? "bg-emerald-950/20 border-emerald-500/30 text-emerald-400" 
              : benchmarkStats.rating === "UNDERPERFORM" 
                ? "bg-rose-950/20 border-rose-500/30 text-rose-400" 
                : "bg-amber-950/20 border-amber-500/30 text-amber-400"
          }`}>
            <div className="space-y-1">
              <span className="text-[9px] font-mono uppercase font-black tracking-widest text-[#94A3B8] block">
                BENCHMARK CORRESPONDENCE VERDICT
              </span>
              <div className="flex items-center gap-2">
                <span className="text-base font-display font-black tracking-tight flex items-center gap-1.5 text-white">
                  <Sparkles className="h-4 w-4 animate-spin-slow text-amber-400" />
                  {benchmarkStats.rating}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded-md font-mono font-bold border ${benchmarkStats.ratingBadge}`}>
                  Alpha Return: {benchmarkStats.excessReturn >= 0 ? "+" : ""}{benchmarkStats.excessReturn.toFixed(2)}%
                </span>
              </div>
              <p className="text-[11px] leading-relaxed text-[#94A3B8]">{benchmarkStats.ratingDescription}</p>
            </div>
            
            <div className="text-left md:text-right shrink-0 bg-[#1A2235]/40 p-3 rounded-2xl border border-[rgba(255,255,255,0.08)] min-w-[125px]">
              <span className="text-[9px] font-mono text-[#94A3B8] block uppercase font-bold tracking-wider">Relative Strength</span>
              <span className="text-lg font-mono font-black text-white block mt-0.5">
                {benchmarkStats.relativeStrengthRatio.toFixed(3)}x
              </span>
              <span className="text-[8px] font-sans text-[#64748B] font-semibold uppercase block mt-0.5 animate-pulse">
                {benchmarkStats.relativeStrengthRatio > 1 ? "Outperforming Ratio" : "Underperforming Ratio"}
              </span>
            </div>
          </div>

          {/* Key Quantitative Coefficients Grid */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pb-4 border-b border-[rgba(255,255,255,0.05)]">
            
            {/* Beta Panel */}
            <div className="bg-[#1A2235]/40 border border-[rgba(255,255,255,0.05)] p-4 rounded-2xl space-y-1.5 relative overflow-hidden group hover:bg-[#1A2235]/60 transition-all">
              <span className="text-[9px] font-mono text-[#94A3B8] font-extrabold uppercase tracking-wide block">Systematic Risk (Beta)</span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-lg font-mono font-black text-white">{benchmarkStats.beta.toFixed(3)}</span>
                <span className="text-[9px] font-sans text-indigo-400 font-bold uppercase">
                  {benchmarkStats.beta > 1 ? "Aggressive" : benchmarkStats.beta === 1 ? "Neutral" : "Defensive"}
                </span>
              </div>
              <p className="text-[9px] text-[#94A3B8] font-sans leading-normal">
                Measure of relative volatility. A beta of <strong>{benchmarkStats.beta.toFixed(2)}</strong> indicates the stock exhibits {benchmarkStats.beta > 1 ? "higher" : "lower"} movement amplitude and tracking leverage than the benchmark.
              </p>
            </div>

            {/* Correlation Panel */}
            <div className="bg-[#1A2235]/40 border border-[rgba(255,255,255,0.05)] p-4 rounded-2xl space-y-1.5 relative overflow-hidden group hover:bg-[#1A2235]/60 transition-all">
              <span className="text-[9px] font-mono text-[#94A3B8] font-extrabold uppercase tracking-wide block">Co-movement Correlation</span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-lg font-mono font-black text-white">{(benchmarkStats.correlation).toFixed(3)}</span>
                <span className="text-[9px] font-sans text-indigo-400 font-bold uppercase">
                  {Math.abs(benchmarkStats.correlation) > 0.75 ? "Strong" : Math.abs(benchmarkStats.correlation) > 0.4 ? "Moderate" : "Weak"}
                </span>
              </div>
              <p className="text-[9px] text-[#94A3B8] font-sans leading-normal">
                Pearson coefficient (r = <strong>{benchmarkStats.correlation.toFixed(2)}</strong>) measures general tracking lockstep. A positive score denotes high index-aligned tracking trends.
              </p>
            </div>

            {/* Volatility Difference Panel */}
            <div className="bg-[#1A2235]/40 border border-[rgba(255,255,255,0.05)] p-4 rounded-2xl space-y-1.5 relative overflow-hidden group hover:bg-[#1A2235]/60 transition-all">
              <span className="text-[9px] font-mono text-[#94A3B8] font-extrabold uppercase tracking-wide block">Volatility Difference</span>
              <div className="flex items-baseline gap-1.5">
                <span className={`text-lg font-mono font-black ${benchmarkStats.volDiff >= 0 ? "text-amber-400" : "text-emerald-400"}`}>
                  {benchmarkStats.volDiff >= 0 ? "+" : ""}{benchmarkStats.volDiff.toFixed(2)}%
                </span>
                <span className="text-[9px] font-sans text-[#94A3B8] font-bold uppercase">Annualized</span>
              </div>
              <p className="text-[9px] text-[#94A3B8] font-sans leading-normal">
                Spread of annualized daily returns standard deviation. {selectedSymbol} volatility (<strong>{benchmarkStats.volStockAnnual.toFixed(1)}%</strong>) relative to index volatility (<strong>{benchmarkStats.volIndexAnnual.toFixed(1)}%</strong>).
              </p>
            </div>

            {/* Aligned Ratio Panel */}
            <div className="bg-[#1A2235]/40 border border-[rgba(255,255,255,0.05)] p-4 rounded-2xl space-y-1.5 relative overflow-hidden group hover:bg-[#1A2235]/60 transition-all">
              <span className="text-[9px] font-mono text-[#94A3B8] font-extrabold uppercase tracking-wide block">Relative Gain / Loss Gap</span>
              <div className="flex items-baseline gap-1.5">
                <span className={`text-lg font-mono font-black ${benchmarkStats.excessReturn >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                  {benchmarkStats.excessReturn >= 0 ? "+" : ""}{benchmarkStats.excessReturn.toFixed(1)}%
                </span>
                <span className="text-[9px] font-sans text-[#94A3B8] font-bold uppercase">Net Alpha</span>
              </div>
              <p className="text-[9px] text-[#94A3B8] font-sans leading-normal">
                Direct difference between {selectedSymbol} cumulative return of <strong>{benchmarkStats.stockReturn.toFixed(1)}%</strong> and {selectedIndex} return of <strong>{benchmarkStats.indexReturn.toFixed(1)}%</strong>.
              </p>
            </div>

          </div>

          {/* Maximum Drawdowns Analysis */}
          <div className="bg-[#1A2235]/40 border border-[rgba(255,255,255,0.05)] rounded-2xl p-4 space-y-3">
            <div className="flex items-center gap-1.5 pb-2 border-b border-[rgba(255,255,255,0.05)]">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span>
              <span className="text-[10px] font-mono text-indigo-300 font-extrabold uppercase tracking-wider">Drawdown Risk Comparison</span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-1">
              
              {/* Stock Drawdown */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-[10px] font-mono">
                  <span className="text-[#94A3B8] uppercase font-semibold">{selectedSymbol} Peak-Trough Drop</span>
                  <span className="font-bold text-rose-400">-{benchmarkStats.maxDrawdownStock.toFixed(2)}%</span>
                </div>
                <div className="w-full bg-[rgba(255,255,255,0.05)] h-2 rounded-full overflow-hidden">
                  <div 
                    className="bg-rose-500 h-full rounded-full transition-all duration-500" 
                    style={{ width: `${Math.min(100, Math.max(2, benchmarkStats.maxDrawdownStock))}%` }}
                  ></div>
                </div>
              </div>

              {/* Index Drawdown */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-[10px] font-mono">
                  <span className="text-[#94A3B8] uppercase font-semibold">{selectedIndex} Benchmark Peak-Trough Drop</span>
                  <span className="font-bold text-slate-300">-{benchmarkStats.maxDrawdownIndex.toFixed(2)}%</span>
                </div>
                <div className="w-full bg-[rgba(255,255,255,0.05)] h-2 rounded-full overflow-hidden">
                  <div 
                    className="bg-indigo-650 h-full rounded-full transition-all duration-500" 
                    style={{ width: `${Math.min(100, Math.max(2, benchmarkStats.maxDrawdownIndex))}%` }}
                  ></div>
                </div>
              </div>

            </div>
            <p className="text-[8.5px] leading-relaxed text-[#94A3B8] font-sans mt-1">
              * Maximum Drawdown (MDD) calculates the worst absolute paper loss sequence experienced by an investor holding each asset continuously within this aligned period.
            </p>
          </div>

          {/* Timeframe returns comparison table */}
          <div className="border border-[rgba(255,255,255,0.08)] rounded-2xl overflow-hidden shadow-sm bg-[#111827]">
            <div className="bg-[#1A2235] px-4 py-3 border-b border-[rgba(255,255,255,0.08)] flex justify-between items-center">
              <span className="text-[10px] font-mono text-white font-extrabold uppercase tracking-wider">
                Multi-Timeframe Return Performance Matrix
              </span>
              <span className="text-[9px] font-sans text-[#94A3B8]">Date Aligned Series</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left font-sans text-[11px] leading-relaxed">
                <thead>
                  <tr className="bg-[#1A2235]/40 text-[9px] uppercase font-mono text-[#94A3B8] border-b border-[rgba(255,255,255,0.08)]">
                    <th className="p-3.5 font-extrabold">Observation Timeframe</th>
                    <th className="p-3.5 font-extrabold text-right">{selectedSymbol} Return</th>
                    <th className="p-3.5 font-extrabold text-right">{selectedIndex} Return</th>
                    <th className="p-3.5 font-extrabold text-right">Bench Alpha Return</th>
                    <th className="p-3.5 font-extrabold text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[rgba(255,255,255,0.05)] font-mono">
                  
                  {/* Row 1: 5-Day */}
                  {benchmarkStats.timeframe5D.exist && (
                    <tr className="hover:bg-[#1A2235]/30">
                      <td className="p-3.5 font-sans font-semibold text-[#CBD5E1]">5 Trading Days (Short Term)</td>
                      <td className={`p-3.5 text-right font-bold ${benchmarkStats.timeframe5D.stock >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                        {benchmarkStats.timeframe5D.stock >= 0 ? "+" : ""}{benchmarkStats.timeframe5D.stock.toFixed(2)}%
                      </td>
                      <td className={`p-3.5 text-right ${benchmarkStats.timeframe5D.index >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                        {benchmarkStats.timeframe5D.index >= 0 ? "+" : ""}{benchmarkStats.timeframe5D.index.toFixed(2)}%
                      </td>
                      <td className={`p-3.5 text-right font-black ${
                        (benchmarkStats.timeframe5D.stock - benchmarkStats.timeframe5D.index) >= 0 ? "text-emerald-400 bg-emerald-950/20" : "text-rose-400 bg-rose-950/20"
                      }`}>
                        {(benchmarkStats.timeframe5D.stock - benchmarkStats.timeframe5D.index) >= 0 ? "+" : ""}{(benchmarkStats.timeframe5D.stock - benchmarkStats.timeframe5D.index).toFixed(2)}%
                      </td>
                      <td className="p-3.5 text-center">
                        <span className={`text-[9px] font-sans font-bold px-2 py-0.5 rounded ${
                          (benchmarkStats.timeframe5D.stock - benchmarkStats.timeframe5D.index) >= 0
                            ? "bg-emerald-950 text-emerald-400 border border-emerald-800/20"
                            : "bg-rose-950 text-rose-400 border border-rose-800/20"
                        }`}>
                          {(benchmarkStats.timeframe5D.stock - benchmarkStats.timeframe5D.index) >= 0 ? "Outperform" : "Underperform"}
                        </span>
                      </td>
                    </tr>
                  )}

                  {/* Row 2: 20-Day */}
                  {benchmarkStats.timeframe20D.exist && (
                    <tr className="hover:bg-[#1A2235]/30">
                      <td className="p-3.5 font-sans font-semibold text-[#CBD5E1]">20 Trading Days (Medium Term)</td>
                      <td className={`p-3.5 text-right font-bold ${benchmarkStats.timeframe20D.stock >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                        {benchmarkStats.timeframe20D.stock >= 0 ? "+" : ""}{benchmarkStats.timeframe20D.stock.toFixed(2)}%
                      </td>
                      <td className={`p-3.5 text-right ${benchmarkStats.timeframe20D.index >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                        {benchmarkStats.timeframe20D.index >= 0 ? "+" : ""}{benchmarkStats.timeframe20D.index.toFixed(2)}%
                      </td>
                      <td className={`p-3.5 text-right font-black ${
                        (benchmarkStats.timeframe20D.stock - benchmarkStats.timeframe20D.index) >= 0 ? "text-emerald-400 bg-emerald-950/20" : "text-rose-400 bg-rose-950/20"
                      }`}>
                        {(benchmarkStats.timeframe20D.stock - benchmarkStats.timeframe20D.index) >= 0 ? "+" : ""}{(benchmarkStats.timeframe20D.stock - benchmarkStats.timeframe20D.index).toFixed(2)}%
                      </td>
                      <td className="p-3.5 text-center">
                        <span className={`text-[9px] font-sans font-bold px-2 py-0.5 rounded ${
                          (benchmarkStats.timeframe20D.stock - benchmarkStats.timeframe20D.index) >= 0
                            ? "bg-emerald-950 text-emerald-400 border border-emerald-800/20"
                            : "bg-rose-950 text-rose-400 border border-rose-800/20"
                        }`}>
                          {(benchmarkStats.timeframe20D.stock - benchmarkStats.timeframe20D.index) >= 0 ? "Outperform" : "Underperform"}
                        </span>
                      </td>
                    </tr>
                  )}

                  {/* Row 3: Full Period */}
                  <tr className="hover:bg-[#1A2235]/30 bg-indigo-950/10 font-bold">
                    <td className="p-3.5 font-sans font-extrabold text-[#CBD5E1]">Full Period ({benchmarkStats.alignedDays} Days Aligned)</td>
                    <td className={`p-3.5 text-right font-black ${benchmarkStats.stockReturn >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                      {benchmarkStats.stockReturn >= 0 ? "+" : ""}{benchmarkStats.stockReturn.toFixed(2)}%
                    </td>
                    <td className={`p-3.5 text-right ${benchmarkStats.indexReturn >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                      {benchmarkStats.indexReturn >= 0 ? "+" : ""}{benchmarkStats.indexReturn.toFixed(2)}%
                    </td>
                    <td className={`p-3.5 text-right font-black ${
                      benchmarkStats.excessReturn >= 0 ? "text-emerald-400 bg-emerald-950/30" : "text-rose-400 bg-rose-950/30"
                    }`}>
                      {benchmarkStats.excessReturn >= 0 ? "+" : ""}{benchmarkStats.excessReturn.toFixed(2)}%
                    </td>
                    <td className="p-3.5 text-center">
                      <span className={`text-[9px] font-sans font-bold px-2 py-0.5 rounded ${
                        benchmarkStats.excessReturn >= 0
                          ? "bg-emerald-950 text-emerald-400 border border-emerald-800/30 animate-pulse"
                          : "bg-rose-950 text-rose-400 border border-rose-800/30"
                      }`}>
                        {benchmarkStats.excessReturn >= 0 ? "Outperform" : "Underperform"}
                      </span>
                    </td>
                  </tr>

                </tbody>
              </table>
            </div>
          </div>

        </div>
      ) : (
        <div className="bg-[#111827] border border-[rgba(255,255,255,0.08)] rounded-3xl p-6 shadow-sm flex items-center justify-center min-h-[120px] text-xs text-[#94A3B8] font-mono">
          <AlertCircle className="h-5 w-5 text-amber-500 mr-2 shrink-0" />
          <span>Benchmark report requires &gt;= 2 overlapping trading days between {selectedSymbol} and {selectedIndex}. Currently: {alignedPairs.length} day(s).</span>
        </div>
      )}

    </div>
  );
}
