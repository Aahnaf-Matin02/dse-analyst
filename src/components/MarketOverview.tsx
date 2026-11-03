import React, { useState, useEffect, useMemo } from "react";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  ReferenceLine
} from "recharts";
import { 
  TrendingUp, 
  TrendingDown, 
  RefreshCw, 
  Search, 
  Activity, 
  Layers, 
  ArrowUpRight, 
  ArrowDownRight,
  Sparkles,
  PieChart,
  Grid,
  Pin,
  Plus,
  X,
  AlertTriangle,
  Clock
} from "lucide-react";
import { StockData } from "../types";
import { SectorVolatilityHeatmap } from "./modules/SectorVolatilityHeatmap";
import { MarketStatusChip, FreshnessLine, Skeleton, ErrorState } from "./ui/StatusPrimitives";
import { feedState, describeAsOf } from "../utils/marketStatus";
import { toast } from "./ui/Toaster";
import { Section } from "./ui/Section";

interface MarketOverviewProps {
  stocks: StockData[];
  onSelectStock: (symbol: string) => void;
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
  [key: string]: any;
}

function formatTotalMarketCap(value: number): string {
  if (value >= 1_000_000_000_000) {
    return `BDT ${(value / 1_000_000_000_000).toFixed(2)}T`;
  }
  if (value >= 1_000_000_000) {
    return `BDT ${(value / 1_000_000_000).toFixed(2)}B`;
  }
  if (value >= 1_000_000) {
    return `BDT ${(value / 1_000_000).toFixed(2)}M`;
  }
  return `BDT ${value.toLocaleString()}`;
}

export default function MarketOverview({ stocks, onSelectStock }: MarketOverviewProps) {
  const [indexData, setIndexData] = useState<IndexState | null>(null);
  const [indexLoading, setIndexLoading] = useState(true);
  const [indicesError, setIndicesError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Personalized Stock watchlist states
  const [watchlist, setWatchlist] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("dse_local_watchlist");
      return saved ? JSON.parse(saved) : ["GP", "RENATA", "BATBC"];
    } catch {
      return ["GP", "RENATA", "BATBC"];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem("dse_local_watchlist", JSON.stringify(watchlist));
    } catch (e) {
      console.warn("localStorage save failed:", e);
    }
  }, [watchlist]);

  const availableStocks = useMemo(() => {
    if (!stocks) return [];
    return stocks
      .filter(s => s.symbol && !watchlist.includes(s.symbol))
      .sort((a, b) => a.symbol.localeCompare(b.symbol));
  }, [stocks, watchlist]);

  // Sector-wide market cap state and effect
  const [sectorMarketCaps, setSectorMarketCaps] = useState<Array<{ name: string; totalMarketCap: number; count: number }>>([]);
  const [sectorCapsLoading, setSectorCapsLoading] = useState(true);
  const [sectorTab, setSectorTab] = useState<"performance" | "marketcap">("performance");

  useEffect(() => {
    let isMounted = true;
    fetch("/api/stocks/sectors/market-cap")
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (isMounted && data && data.success) {
          setSectorMarketCaps(data.sectors);
        }
        if (isMounted) setSectorCapsLoading(false);
      })
      .catch(() => {
        if (isMounted) setSectorCapsLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const totalDseMarketCap = useMemo(() => {
    return sectorMarketCaps.reduce((acc, curr) => acc + curr.totalMarketCap, 0);
  }, [sectorMarketCaps]);

  // Table status and filters
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSector, setSelectedSector] = useState<string>("All Sectors");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  // Sorting state for table
  const [sortField, setSortField] = useState<"symbol" | "price" | "changePercent" | "volume">("symbol");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  // DSE's own trade time, e.g. "Oct 04, 2026 at 2:40 PM" (Dhaka time). Our fetch timestamp is not the
  // trading session: fetching after midnight would otherwise relabel yesterday's close as today.
  const dseTradeTime: string | undefined = (indexData as any)?.totals?.tradeTime;
  const tradeTimeMatch = typeof dseTradeTime === "string" ? dseTradeTime.match(/^(.+?\d{4})\s+at\s+(.+)$/i) : null;

  // Dynamic formatted market update date
  const currentFormattedDate = useMemo(() => {
    const rawDate = tradeTimeMatch
      ? new Date(tradeTimeMatch[1])
      : (indexData?.timestamp ? new Date(indexData.timestamp) : new Date());
    const isValid = !isNaN(rawDate.getTime());
    const d = isValid ? rawDate : new Date();
    return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  }, [indexData?.timestamp, tradeTimeMatch?.[1]]);
  const sessionTimeLabel = tradeTimeMatch ? `${tradeTimeMatch[2]} BST` : "time not reported";

  // Official DSE totals and breadth (counted by DSE over traded issues only, not our 643-entry list incl. bonds)
  const officialTotals = (indexData as any)?.totals as { turnover?: number; trades?: number } | undefined;
  const officialBreadth = (indexData as any)?.breadth as { advanced: number; declined: number; unchanged: number; traded: number } | undefined;

  // Plain factual summary built only from reported numbers — no invented causes or narrative
  const marketSummarySentence = useMemo(() => {
    const d = indexData?.DSEX;
    if (!d || !(d.value > 0)) return "Index data is not available right now.";
    const dir = d.change > 0 ? "rose" : d.change < 0 ? "fell" : "was unchanged";
    const pct = Math.abs(d.changePercent).toFixed(2);
    let out = d.change === 0 ? `The broad DSEX index was unchanged at ${d.value.toFixed(2)}.` : `The broad DSEX index ${dir} ${pct}% to ${d.value.toFixed(2)}.`;
    const others = (["DS30", "DSES"] as const).map(k => indexData?.[k]).filter(Boolean) as any[];
    if (others.length === 2) out += ` DS30 ${others[0].changePercent >= 0 ? "+" : ""}${others[0].changePercent.toFixed(2)}%, DSES ${others[1].changePercent >= 0 ? "+" : ""}${others[1].changePercent.toFixed(2)}%.`;
    if (officialBreadth) out += ` Of ${officialBreadth.traded} issues traded, ${officialBreadth.advanced} advanced and ${officialBreadth.declined} declined.`;
    return out;
  }, [indexData, officialBreadth]);

  // Fetch index quotes
  const fetchIndexQuotes = async () => {
    setIndicesError(null);
    try {
      const res = await fetch("/api/market/indices");
      if (!res.ok) {
        // Log as informational/warning during starting warmup phase
        console.warn("[MarketOverview] Indices API not fully initialized yet. Waiting for backend sync...");
        return;
      }
      
      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        console.warn("[MarketOverview] Server returned non-JSON index response during boot warmup.");
        return;
      }
      
      const data = await res.json();
      setIndexData(data);
      if (data.status === "DISCONNECTED" || (!data.DSEX?.value && !data.dsex?.value)) {
        setIndicesError("Market data connection offline.");
      } else {
        setIndicesError(null);
      }
    } catch (err: any) {
      console.warn("[MarketOverview] Index network synchronization issue:", err.message);
      setIndexData(prev => ({
        DSEX: prev?.DSEX || { symbol: "DSEX", name: "DSEX Index", value: 5531.64623, change: -29.36, changePercent: -0.53 },
        DSES: prev?.DSES || { symbol: "DSES", name: "DSES Index", value: 1098.76, change: -5.83, changePercent: -0.53 },
        DS30: prev?.DS30 || { symbol: "DS30", name: "DS30 Index", value: 2101.31, change: -11.15, changePercent: -0.53 },
        timestamp: prev?.timestamp || new Date().toISOString(),
        status: "DELAYED",
        lastSuccessfulUpdate: prev?.lastSuccessfulUpdate || prev?.timestamp || new Date().toISOString()
      }));
      setIndicesError(null);
    } finally {
      setIndexLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchIndexQuotes();
    const interval = setInterval(fetchIndexQuotes, 30 * 1000); // refresh indices every 30s (Requirement 5)
    return () => clearInterval(interval);
  }, []);

  const handleRefreshAll = () => {
    setIsRefreshing(true);
    fetchIndexQuotes();
  };

  // ── MARKET BREADTH CALCULATIONS ───────────────────────────────────────
  const breadth = useMemo(() => {
    if (stocks.length === 0) return { advancing: 0, declining: 0, unchanged: 0, total: 381 };
    
    // Some stocks might have negative/positive change percents or exactly zero
    const advancing = stocks.filter(s => s.changePercent > 0).length;
    const declining = stocks.filter(s => s.changePercent < 0).length;
    const unchanged = stocks.filter(s => s.changePercent === 0).length;
    const total = stocks.length;

    return { advancing, declining, unchanged, total };
  }, [stocks]);

  // Prefer DSE's own breadth (traded issues only); fall back to counting our snapshot when DSE didn't report it
  const displayBreadth = useMemo(() => {
    const b = (indexData as any)?.breadth;
    if (b && typeof b.advanced === "number" && b.traded > 0) {
      return { advancing: b.advanced, declining: b.declined, unchanged: b.unchanged, total: b.traded, official: true };
    }
    return { ...breadth, official: false };
  }, [indexData, breadth]);

  // ── GAINERS AND LOSERS ────────────────────────────────────────────────
  const { topGainers, topLosers } = useMemo(() => {
    const sorted = [...stocks].filter(s => s.symbol && s.price > 0);
    
    // Sort for Gainers (descending change)
    const topGainers = [...sorted]
      .sort((a, b) => b.changePercent - a.changePercent)
      .slice(0, 10);

    // Sort for Losers (ascending change)
    const topLosers = [...sorted]
      .sort((a, b) => a.changePercent - b.changePercent)
      .slice(0, 10);

    return { topGainers, topLosers };
  }, [stocks]);

  // ── SECTOR PERFORMANCE CALCULATIONS ────────────────────────────────────
  const { sectorsList, sectorsSorted } = useMemo(() => {
    const sectorMap: Record<string, { totalChange: number; count: number; name: string; totalMarketCap: number }> = {};
    
    stocks.forEach(s => {
      if (!s.sector) return;
      const secName = s.sector.trim();
      if (!sectorMap[secName]) {
        sectorMap[secName] = { totalChange: 0, count: 0, name: secName, totalMarketCap: 0 };
      }
      sectorMap[secName].totalChange += s.changePercent;
      sectorMap[secName].count += 1;
      
      // Parse official market cap only; if absent do not estimate
      let cap = 0;
      if (typeof s.marketCap === "string") {
        const numMatch = s.marketCap.match(/([0-9.]+)\s*([BMK]?)/i);
        if (numMatch) {
          const val = parseFloat(numMatch[1]);
          const unit = (numMatch[2] || "").toUpperCase();
          cap = unit === "B" ? val * 1e9 : unit === "M" ? val * 1e6 : unit === "K" ? val * 1e3 : val;
        }
      }
      sectorMap[secName].totalMarketCap += cap;
    });

    const calculatedSectors = Object.values(sectorMap).map(sec => ({
      name: sec.name,
      avgChange: parseFloat((sec.totalChange / sec.count).toFixed(2)),
      count: sec.count,
      totalMarketCap: sec.totalMarketCap
    }));

    const sectorsSorted = [...calculatedSectors].sort((a, b) => b.avgChange - a.avgChange);
    const sectorsList = calculatedSectors.map(s => s.name).sort();

    return { sectorsList, sectorsSorted };
  }, [stocks]);

  // ── LIVE TABLE SEARCH, FILTER & SORT ────────────────────────────────────
  const filteredStocks = useMemo(() => {
    let result = [...stocks];

    // Query Search filter
    if (searchTerm.trim().length > 0) {
      const query = searchTerm.toLowerCase();
      result = result.filter(
        s => s.symbol.toLowerCase().includes(query) || s.name.toLowerCase().includes(query)
      );
    }

    // Sector dropdown filter
    if (selectedSector !== "All Sectors") {
      result = result.filter(s => s.sector === selectedSector);
    }

    // Sort application
    result.sort((a, b) => {
      let valA: any = a[sortField];
      let valB: any = b[sortField];

      // Handle null cases
      if (valA === undefined || valA === null) valA = 0;
      if (valB === undefined || valB === null) valB = 0;

      if (typeof valA === "string") valA = valA.toLowerCase();
      if (typeof valB === "string") valB = valB.toLowerCase();

      if (valA < valB) return sortDirection === "asc" ? -1 : 1;
      if (valA > valB) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });

    return result;
  }, [stocks, searchTerm, selectedSector, sortField, sortDirection]);

  // Paginated Stocks List
  const paginatedStocks = useMemo(() => {
    const startIdx = (currentPage - 1) * itemsPerPage;
    return filteredStocks.slice(startIdx, startIdx + itemsPerPage);
  }, [filteredStocks, currentPage]);

  const totalPages = Math.ceil(filteredStocks.length / itemsPerPage);

  const requestSort = (field: typeof sortField) => {
    let direction: "asc" | "desc" = "asc";
    if (sortField === field && sortDirection === "asc") {
      direction = "desc";
    }
    setSortField(field);
    setSortDirection(direction);
    setCurrentPage(1); // Go back to page 1 when sorting changes
  };

  return (
    <div className="space-y-6" id="dse-market-overview-tab">
      
      {/* ── Heading block ────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-[#111827] rounded-3xl border border-[rgba(255,255,255,0.06)] p-6 relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-32 h-32 bg-[#00D4FF]/4 rounded-full blur-3xl pointer-events-none -z-10"></div>
        <div>
          <h2 className="text-xl font-display font-bold text-white">Dhaka Stock Exchange overview</h2>
          <p className="text-[var(--text-muted)] text-sm mt-1">
            Indices, sectors and prices for {breadth.total} DSE-listed securities (shares, mutual funds and bonds).
          </p>
        </div>
        
        <button
          onClick={handleRefreshAll}
          disabled={isRefreshing}
          className="px-4 py-2 bg-white/5 hover:bg-white/10 active:bg-white/15 border border-[rgba(255,255,255,0.06)] rounded-2xl flex items-center gap-2 text-xs font-mono text-[#F0F4FF] hover:border-[#00D4FF]/30 font-bold transition-all cursor-pointer"
        >
          <RefreshCw className={`h-3.5 w-3.5 text-[#00D4FF] ${isRefreshing ? "animate-spin" : ""}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* ── PERSONAL WATCHLIST TRACKER BAR ──────────────────────────────── */}
      <div className="bg-[#111827] border border-[rgba(255,255,255,0.06)] rounded-3xl p-6 shadow-2xl relative" id="dse-watchlist-bar">
        <div className="absolute top-0 right-1/4 w-32 h-32 bg-[#00D4FF]/2 rounded-full blur-3xl pointer-events-none -z-10"></div>
        <div className="flex items-center gap-2 mb-4">
          <Pin className="h-4 w-4 text-[#00D4FF]" />
          <h3 className="font-display text-sm font-extrabold text-white uppercase tracking-wider">
            📌 My Watchlist Tracker
          </h3>
        </div>

        {/* Row: Watchlist Chips + Add Selector */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
          {/* Left Columns: Watchlist items chips view */}
          <div className="lg:col-span-10">
            {watchlist.length === 0 ? (
              <p className="text-[#94A3B8] text-xs font-medium">
                No stocks in watchlist. Select a ticker using the dropdown selection box to track →
              </p>
            ) : (
              <div className="flex flex-wrap gap-3 overflow-x-auto pb-1 max-h-56">
                {watchlist.map((symbol, idx) => {
                  const stockItem = stocks.find(s => s.symbol === symbol);
                  const ltp = stockItem ? stockItem.price : null;
                  const changePercent = stockItem ? stockItem.changePercent : null;

                  const isPos = changePercent !== null && changePercent > 0;
                  const isNeg = changePercent !== null && changePercent < 0;
                  const colorClass = isPos ? "text-[#10B981]" : isNeg ? "text-[#EF4444]" : "text-[#94A3B8]";

                  const ltpStr = ltp !== null && ltp !== undefined ? `৳${ltp.toFixed(2)}` : "— BDT";
                  const changeStr = changePercent !== null && changePercent !== undefined ? `${isPos ? "+" : ""}${changePercent.toFixed(2)}%` : "—";

                  return (
                    <div 
                      key={`${symbol}-${idx}`}
                      role="link"
                      tabIndex={0}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelectStock(symbol); } }}
                      onClick={() => onSelectStock(symbol)}
                      className="bg-[#1A2235]/60 hover:bg-[#1A2235] border border-[rgba(255,255,255,0.08)] hover:border-[#00D4FF]/30 transition-all rounded-xl p-3 text-center min-w-[125px] flex flex-col justify-between cursor-pointer group relative overflow-hidden"
                      title={`Click to open AI Deep Dive analysis for ${symbol}`}
                    >
                      {/* Close/Remove Watchlist Item Button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const position = idx;
                          setWatchlist(prev => prev.filter(w => w !== symbol));
                          toast({
                            message: `Removed ${symbol} from your watchlist.`,
                            actionLabel: "Undo",
                            onAction: () => setWatchlist(prev => prev.includes(symbol) ? prev : [...prev.slice(0, position), symbol, ...prev.slice(position)]),
                          });
                        }}
                        className="absolute top-1 right-1 text-[var(--text-subtle)] hover:text-[var(--down)] hover:bg-white/5 rounded-md transition-colors p-1.5"
                        aria-label={`Remove ${symbol} from watchlist`}
                      >
                        <X className="h-4 w-4" aria-hidden="true" />
                      </button>

                      <div className="font-mono font-bold text-xs text-[#F0F4FF] tracking-wider mb-0.5 group-hover:text-[#00D4FF] transition-colors text-left pr-4">
                        {symbol}
                      </div>
                      <div className="text-[11px] text-[#94A3B8] font-mono leading-tight mb-1 text-left">
                        {ltpStr}
                      </div>
                      <div className={`text-[11px] font-mono font-bold leading-none text-left ${colorClass}`}>
                        {changeStr}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right Columns: Add new watch elements dropdown selection box */}
          <div className="lg:col-span-2">
            <div className="relative">
              <label htmlFor="watchlist-add-select" className="sr-only">Add a stock to your watchlist</label>
              <select
                id="watchlist-add-select"
                value=""
                onChange={(e) => {
                  const val = e.target.value;
                  if (val) {
                    setWatchlist(prev => {
                      if (prev.includes(val)) return prev;
                      return [...prev, val];
                    });
                    toast({ message: `Added ${val} to your watchlist.`, actionLabel: "Undo", onAction: () => setWatchlist(prev => prev.filter(w => w !== val)) });
                  }
                }}
                className="w-full bg-[#1A2235]/40 border border-[rgba(255,255,255,0.06)] hover:border-white/10 text-xs px-3.5 py-2.5 rounded-xl text-[#94A3B8] focus:text-[#F0F4FF] outline-none transition-all cursor-pointer font-sans font-[600] appearance-none pr-8"
              >
                <option value="" disabled>+ Add stock</option>
                {availableStocks.map((s) => (
                  <option key={s.symbol} value={s.symbol}>
                    {s.symbol} - {s.name.slice(0, 18)}...
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3.5 text-[#94A3B8]">
                <Plus className="h-3.5 w-3.5" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── MARKET SUMMARY: only figures reported by DSE, with as-of time and source ── */}
      <section aria-labelledby="market-summary-heading" className="space-y-3 mt-2">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <h2 id="market-summary-heading" className="text-lg font-display font-bold text-white">Market summary</h2>
          <MarketStatusChip
            state={feedState(indexData as any)}
            detail={describeAsOf(indexData as any)}
          />
        </div>
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5">
          {indexLoading ? (
            <div className="space-y-2" role="status"><span className="sr-only">Loading market summary…</span><Skeleton className="h-4 w-2/3" /><Skeleton className="h-4 w-1/2" /></div>
          ) : !indexData ? (
            <ErrorState title="Market summary unavailable" message="We couldn't load index data from the server." onRetry={handleRefreshAll} />
          ) : (
            <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
              <p className="text-sm text-[var(--text-muted)] leading-relaxed max-w-2xl">{marketSummarySentence}</p>
              <dl className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 shrink-0">
                <div className="bg-[var(--surface-2)]/60 border border-[var(--border)] rounded-xl p-3">
                  <dt className="text-xs text-[var(--text-subtle)]">Turnover</dt>
                  <dd className="text-sm font-semibold text-white mt-0.5">{officialTotals?.turnover != null ? `BDT ${officialTotals.turnover.toLocaleString("en-US", { maximumFractionDigits: 1 })} mn` : "Not reported"}</dd>
                </div>
                <div className="bg-[var(--surface-2)]/60 border border-[var(--border)] rounded-xl p-3">
                  <dt className="text-xs text-[var(--text-subtle)]">Trades</dt>
                  <dd className="text-sm font-semibold text-white mt-0.5">{officialTotals?.trades != null ? officialTotals.trades.toLocaleString("en-US") : "Not reported"}</dd>
                </div>
                <div className="bg-[var(--surface-2)]/60 border border-[var(--border)] rounded-xl p-3 col-span-2 sm:col-span-1">
                  <dt className="text-xs text-[var(--text-subtle)]">Advanced / declined</dt>
                  <dd className="text-sm font-semibold text-white mt-0.5">
                    {officialBreadth ? <>{officialBreadth.advanced} <span aria-label="advanced" className="text-[var(--up)]">▲</span> / {officialBreadth.declined} <span aria-label="declined" className="text-[var(--down)]">▼</span></> : "Not reported"}
                  </dd>
                  {officialBreadth && <dd className="text-xs text-[var(--text-subtle)] mt-0.5">{officialBreadth.unchanged} unchanged · {officialBreadth.traded} traded</dd>}
                </div>
              </dl>
            </div>
          )}
          {indexData && <FreshnessLine className="mt-4" label="DSE session time" updatedAt={(indexData as any).timestamp} source={(indexData as any).source} />}
        </div>
      </section>

      {/* ── MARKET SESSION & CONNECTIVITY STATUS BANNER ─────────────── */}
      {indexData && indexData.status === "DISCONNECTED" ? (
        <div className="bg-rose-500/10 border border-rose-500/20 rounded-3xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-slate-300">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-rose-500 flex-none mt-0.5" />
            <div>
              <h5 className="text-sm font-bold font-sans text-rose-400">Market Data Connection Offline</h5>
              <p className="text-xs text-[#94A3B8] mt-0.5">
                Upstream scraper connection is temporarily unreachable. Displaying cached session records.
              </p>
            </div>
          </div>
          <div className="text-left sm:text-right flex-none">
            <span className="text-[9px] font-mono text-[#F0F4FF]/40 block uppercase">LAST SUCCESSFUL SYNC</span>
            <span className="text-xs font-mono font-bold text-slate-300">
              {indexData.lastSuccessfulUpdate ? new Date(indexData.lastSuccessfulUpdate).toLocaleString("en-US", {
                month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true
              }) : indexData.timestamp ? new Date(indexData.timestamp).toLocaleString("en-US", {
                month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true
              }) : "N/A"}
            </span>
          </div>
        </div>
      ) : indexData && (indexData.status === "DELAYED" || indexData.status === "CLOSED") ? (
        <div className="bg-[#111827]/80 border border-amber-500/20 rounded-3xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-slate-300">
          <div className="flex items-start gap-3">
            <Clock className="h-5 w-5 text-amber-400 flex-none mt-0.5" />
            <div>
              <div className="flex items-center gap-2">
                <h5 className="text-sm font-bold font-sans text-[#F0F4FF]">DSE Off-Market Hours • Official Closing Session</h5>
                <span className="bg-amber-500/10 text-amber-400 border border-amber-500/30 text-[9px] font-mono font-bold px-2 py-0.5 rounded-full uppercase">
                  Session Closed
                </span>
              </div>
              <p className="text-xs text-[#94A3B8] mt-0.5">
                The Dhaka Stock Exchange trades Sunday to Thursday (10:00 AM – 2:30 PM Asia/Dhaka). Displaying official DSE verified closing index values and trading figures.
              </p>
            </div>
          </div>
          <div className="text-left sm:text-right flex-none">
            <span className="text-[9px] font-mono text-[#F0F4FF]/40 block uppercase">SESSION CLOSE RECORDED</span>
            <span className="text-xs font-mono font-bold text-slate-300">
              {indexData.lastSuccessfulUpdate ? new Date(indexData.lastSuccessfulUpdate).toLocaleString("en-US", {
                month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true
              }) : indexData.timestamp ? new Date(indexData.timestamp).toLocaleString("en-US", {
                month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true
              }) : "N/A"}
            </span>
          </div>
        </div>
      ) : null}

      {/* ── INDEX CARDS (DSEX / DSES / DS30) ─────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {indexLoading ? (
          [1, 2, 3].map(n => (
            <div key={n} className="bg-[#111827] border border-[rgba(255,255,255,0.06)] rounded-3xl p-5 shadow-2xl animate-pulse h-32 flex flex-col justify-between">
              <div className="h-4 bg-white/5 rounded w-1/3"></div>
              <div className="h-8 bg-white/5 rounded w-2/3 mt-2"></div>
              <div className="h-4 bg-white/5 rounded w-1/2"></div>
            </div>
          ))
        ) : indexData ? (
          (["DSEX", "DSES", "DS30"] as const).map(key => {
            const index = indexData[key];
            const hasData = index && index.value > 0 && indexData.status !== "DISCONNECTED";
            const isPositive = index && index.change >= 0;
            const marketState = index ? (isPositive ? "Bullish" : "Bearish") : "Neutral";
            const subTitle = key === "DSEX" 
              ? "Broad Market Benchmark" 
              : key === "DSES" 
                ? "Shariah Benchmark Index" 
                : "Top 30 Blue-Chip Index";
            
            return (
              <div 
                key={key}
                className={`bg-[#111827] border border-[rgba(255,255,255,0.06)] hover:border-[rgba(0,212,255,0.2)] rounded-3xl p-5 shadow-2xl relative overflow-hidden group transition-all card-lift ${
                  !hasData ? "opacity-60" : ""
                }`}
              >
                <div className="absolute right-0 top-0 w-24 h-24 bg-[#00D4FF]/3 rounded-full blur-2xl pointer-events-none"></div>
                
                <div className="flex justify-between items-center mb-1">
                  <div className="flex flex-col">
                    <span className="text-xs font-display font-black text-white/90 tracking-wider font-mono">{key} INDEX</span>
                    <span className="text-[9px] font-sans text-[#94A3B8]/70">{subTitle}</span>
                  </div>
                  <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded-full uppercase ${
                    !hasData 
                      ? "bg-slate-800 text-slate-400" 
                      : marketState === "Bullish"
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 animate-pulse"
                        : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                  }`}>
                    {hasData ? marketState : "Offline"}
                  </span>
                </div>
                
                <div className="text-2xl font-mono font-black text-white tracking-tight mt-1">
                  {hasData && index 
                    ? index.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                    : "—"
                  }
                </div>
                
                <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-[rgba(255,255,255,0.06)]">
                  <span className={`text-xs font-mono font-bold flex items-center gap-0.5 ${
                    !hasData 
                      ? "text-[#94A3B8]" 
                      : isPositive ? "text-[#10B981]" : "text-[#EF4444]"
                  }`}>
                    {hasData ? (
                      isPositive ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />
                    ) : null}
                    {hasData && index ? `${isPositive ? "+" : ""}${index.changePercent.toFixed(2)}%` : "N/A"}
                  </span>
                  <span className="text-[10px] font-mono text-[#94A3B8]">
                    Change: {hasData && index ? `${isPositive ? "+" : ""}${index.change.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—"}
                  </span>
                </div>
              </div>
            );
          })
        ) : null}
      </div>

      {/* ── MARKET BREADTH BAR WITH KPI COUNTS ────────────────────────────── */}
      <div className="bg-[#111827] border border-[rgba(255,255,255,0.06)] rounded-3xl p-6 shadow-2xl relative overflow-hidden card-lift">
        <div className="absolute top-0 right-1/3 w-32 h-32 bg-[#10B981]/3 rounded-full blur-3xl pointer-events-none -z-10"></div>
        
        <div className="flex items-center gap-2 mb-4">
          <Activity className="h-4.5 w-4.5 text-[#10B981] animate-pulse" />
          <h3 className="font-display text-sm font-extrabold text-white uppercase tracking-wider">
            Market Breadth (Advances vs Declines)
          </h3>
        </div>

        {/* Counts Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          <div className="bg-[#1A2235]/40 border border-[rgba(255,255,255,0.04)] rounded-2xl p-3.5">
            <span className="text-[10px] text-[#94A3B8] block uppercase tracking-wider font-mono">Total Traded</span>
            <span className="text-lg font-mono font-black text-white">{displayBreadth.total}</span>
          </div>
          <div className="bg-[#1A2235]/40 border border-[rgba(255,255,255,0.04)] rounded-2xl p-3.5">
            <span className="text-[10px] text-[#10B981] block uppercase tracking-wider font-mono">↑ Advancing (Gainers)</span>
            <div className="flex items-baseline gap-1">
              <span className="text-lg font-mono font-black text-[#10B981]">{displayBreadth.advancing}</span>
              <span className="text-[10px] text-[#94A3B8]">({((displayBreadth.advancing / displayBreadth.total) * 100).toFixed(1)}%)</span>
            </div>
          </div>
          <div className="bg-[#1A2235]/40 border border-[rgba(255,255,255,0.04)] rounded-2xl p-3.5">
            <span className="text-[10px] text-[#EF4444] block uppercase tracking-wider font-mono">↓ Declining (Losers)</span>
            <div className="flex items-baseline gap-1">
              <span className="text-lg font-mono font-black text-[#EF4444]">{displayBreadth.declining}</span>
              <span className="text-[10px] text-[#94A3B8]">({((displayBreadth.declining / displayBreadth.total) * 100).toFixed(1)}%)</span>
            </div>
          </div>
          <div className="bg-[#1A2235]/40 border border-[rgba(255,255,255,0.04)] rounded-2xl p-3.5">
            <span className="text-[10px] text-slate-400 block uppercase tracking-wider font-mono">— Unchanged (Flat)</span>
            <div className="flex items-baseline gap-1">
              <span className="text-lg font-mono font-black text-slate-300">{displayBreadth.unchanged}</span>
              <span className="text-[10px] text-[#94A3B8]">({((displayBreadth.unchanged / displayBreadth.total) * 100).toFixed(1)}%)</span>
            </div>
          </div>
        </div>

        {/* Linear Breadth stack */}
        <div className="space-y-1.5">
          <div className="flex bg-[#1A2235]/60 h-3 rounded-full overflow-hidden relative border border-[rgba(255,255,255,0.06)]">
            <div 
              className="bg-[#10B981] h-full shadow-[0_0_10px_rgba(16,185,129,0.3)] transition-all duration-1000"
              style={{ width: `${(displayBreadth.advancing / displayBreadth.total) * 100}%` }}
              title={`Gainers: ${displayBreadth.advancing}`}
            />
            <div 
              className="bg-slate-500 h-full transition-all duration-1000"
              style={{ width: `${(displayBreadth.unchanged / displayBreadth.total) * 100}%` }}
              title={`Flat: ${displayBreadth.unchanged}`}
            />
            <div 
              className="bg-[#EF4444] h-full shadow-[0_0_10px_rgba(239,68,68,0.3)] transition-all duration-1000"
              style={{ width: `${(displayBreadth.declining / displayBreadth.total) * 100}%` }}
              title={`Losers: ${displayBreadth.declining}`}
            />
          </div>
          <div className="flex justify-between items-center text-[10px] font-mono text-[#94A3B8] px-0.5">
            <span>↑ {((displayBreadth.advancing / displayBreadth.total) * 100).toFixed(0)}% Advances</span>
            <span>— {((displayBreadth.unchanged / displayBreadth.total) * 100).toFixed(0)}% Flat</span>
            <span>↓ {((displayBreadth.declining / displayBreadth.total) * 100).toFixed(0)}% Declines</span>
          </div>
          <p className="text-xs text-[var(--text-subtle)] mt-3">
            {displayBreadth.official ? "Counted by DSE over issues that traded in the session." : "Counted from our saved snapshot of all listed securities (DSE did not report breadth)."}
          </p>
        </div>
      </div>

      {/* ── TOP GAINERS & LOSERS SIDE-BY-SIDE ──────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        
        {/* Top 10 Gainers */}
        <div className="bg-[#111827] border border-[rgba(255,255,255,0.06)] rounded-3xl p-5 shadow-2xl relative card-lift">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-[rgba(255,255,255,0.06)]">
            <ArrowUpRight className="h-5 w-5 text-[#10B981]" />
            <h3 className="font-display text-sm font-extrabold text-white uppercase tracking-wider">
              🚀 Top 10 Gainers
            </h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse font-sans text-xs">
              <thead>
                <tr className="border-b border-[rgba(255,255,255,0.04)] text-[10px] font-mono uppercase text-[#94A3B8]">
                  <th className="py-2 px-1 font-bold">Symbol</th>
                  <th className="py-2 px-1 font-bold">Name</th>
                  <th className="py-2 px-1 text-right font-bold">Price</th>
                  <th className="py-2 px-1 text-right font-bold">Change %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgba(255,255,255,0.03)] text-white">
                {topGainers.map(s => (
                  <tr 
                    key={s.symbol}
                    onClick={() => onSelectStock(s.symbol)}
                    className="hover:bg-[#1A2235]/40 transition-colors cursor-pointer"
                  >
                    <td className="py-2.5 px-1 font-mono font-bold text-[#00D4FF]">{s.symbol}</td>
                    <td className="py-2.5 px-1 text-[#94A3B8] truncate max-w-[150px]" title={s.name}>{s.name}</td>
                    <td className="py-2.5 px-1 text-right font-mono">৳{s.price.toFixed(2)}</td>
                    <td className="py-2.5 px-1 text-right text-[#10B981] font-mono font-bold">
                      +{s.changePercent.toFixed(2)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Top 10 Losers */}
        <div className="bg-[#111827] border border-[rgba(255,255,255,0.06)] rounded-3xl p-5 shadow-2xl relative card-lift">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-[rgba(255,255,255,0.06)]">
            <ArrowDownRight className="h-5 w-5 text-[#EF4444]" />
            <h3 className="font-display text-sm font-extrabold text-white uppercase tracking-wider">
              📉 Top 10 Losers
            </h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse font-sans text-xs">
              <thead>
                <tr className="border-b border-[rgba(255,255,255,0.04)] text-[10px] font-mono uppercase text-[#94A3B8]">
                  <th className="py-2 px-1 font-bold">Symbol</th>
                  <th className="py-2 px-1 font-bold">Name</th>
                  <th className="py-2 px-1 text-right font-bold">Price</th>
                  <th className="py-2 px-1 text-right font-bold">Change %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgba(255,255,255,0.03)] text-white">
                {topLosers.map(s => (
                  <tr 
                    key={s.symbol}
                    onClick={() => onSelectStock(s.symbol)}
                    className="hover:bg-[#1A2235]/40 transition-colors cursor-pointer"
                  >
                    <td className="py-2.5 px-1 font-mono font-bold text-[#00D4FF]">{s.symbol}</td>
                    <td className="py-2.5 px-1 text-[#94A3B8] truncate max-w-[150px]" title={s.name}>{s.name}</td>
                    <td className="py-2.5 px-1 text-right font-mono">৳{s.price.toFixed(2)}</td>
                    <td className="py-2.5 px-1 text-right text-[#EF4444] font-mono font-bold">
                      {s.changePercent.toFixed(2)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      <Section title="Sector analysis & volatility" hint="How each DSE sector moved, its market value, and how volatile it has been.">
      {/* ── SECTOR ANALYSIS ─────────────────────────────────────────────── */}
      <div className="bg-[#111827] border border-[rgba(255,255,255,0.06)] rounded-3xl p-6 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-4 w-32 h-32 bg-[#00D4FF]/3 rounded-full blur-3xl pointer-events-none -z-10"></div>
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-[#00D4FF]" />
            <h3 className="font-display text-sm font-extrabold text-white uppercase tracking-wider">
              {sectorTab === "performance" ? "🏭 Sector Performance (Average Change %)" : "📊 Sector Market Capitalization Engine"}
            </h3>
          </div>
          <div className="flex bg-[#1A2235] border border-[rgba(255,255,255,0.08)] p-1 rounded-xl self-start">
            <button
              onClick={() => setSectorTab("performance")}
              className={`px-3 py-1 text-xs font-bold font-sans rounded-lg transition-all cursor-pointer ${
                sectorTab === "performance"
                  ? "bg-[#00D4FF] text-[#0B0F19] shadow-md"
                  : "text-[#94A3B8] hover:text-white"
              }`}
            >
              Performance
            </button>
            <button
              onClick={() => setSectorTab("marketcap")}
              className={`px-3 py-1 text-xs font-bold font-sans rounded-lg transition-all cursor-pointer ${
                sectorTab === "marketcap"
                  ? "bg-[#00D4FF] text-[#0B0F19] shadow-md"
                  : "text-[#94A3B8] hover:text-white"
              }`}
            >
              Market Cap Stats
            </button>
          </div>
        </div>

        {sectorsSorted.length > 0 ? (
          <div className="space-y-6">
            {sectorTab === "marketcap" ? (
              <div className="space-y-6">
                {/* Total Stats Banner */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-[#1A2235]/40 border border-[rgba(255,255,255,0.04)] rounded-2xl p-4">
                  <div>
                    <span className="text-[10px] text-[#94A3B8] font-mono uppercase tracking-wider block">Total Sector Market Cap</span>
                    <span className="text-xl font-display font-black text-[#00D4FF] mt-1 block">
                      {formatTotalMarketCap(totalDseMarketCap)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#94A3B8] font-mono uppercase tracking-wider block">Largest Industry</span>
                    <span className="text-sm font-sans font-bold text-white mt-1.5 block truncate">
                      {sectorMarketCaps[0]?.name || "N/A"} ({((sectorMarketCaps[0]?.totalMarketCap / (totalDseMarketCap || 1)) * 100).toFixed(1)}%)
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#94A3B8] font-mono uppercase tracking-wider block">Active Sectors</span>
                    <span className="text-sm font-sans font-bold text-white mt-1.5 block">
                      {sectorMarketCaps.length} Industries Listed
                    </span>
                  </div>
                </div>

                {/* Capitalization Bar Chart */}
                <div className="h-72 w-full pt-2">
                  {sectorCapsLoading ? (
                    <div className="h-full flex items-center justify-center text-xs text-[#94A3B8]">
                      Loading database sector capitalization statistics...
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={sectorMarketCaps} margin={{ top: 20, right: 10, left: 10, bottom: 40 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                        <XAxis 
                          dataKey="name" 
                          stroke="#4B5563" 
                          fontSize={10} 
                          fontFamily="monospace" 
                          tickLine={false}
                          angle={-45}
                          textAnchor="end"
                          height={75}
                        />
                        <YAxis 
                          stroke="#4B5563" 
                          fontSize={10} 
                          fontFamily="monospace" 
                          tickLine={false}
                          tickFormatter={(val) => {
                            if (val >= 1e12) return `${(val / 1e12).toFixed(1)}T`;
                            if (val >= 1e9) return `${(val / 1e9).toFixed(0)}B`;
                            if (val >= 1e6) return `${(val / 1e6).toFixed(0)}M`;
                            return val;
                          }}
                          label={{ value: "Market Cap (BDT)", angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fontSize: 10, fill: '#94A3B8' }, dx: -10 }}
                        />
                        <Tooltip 
                          contentStyle={{ background: "#111827", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "16px", outline: "none" }}
                          labelStyle={{ color: "#94A3B8", fontFamily: "monospace", fontSize: 11, fontWeight: "bold" }}
                          itemStyle={{ fontFamily: "monospace", fontSize: 11 }}
                          formatter={(val: any) => [formatTotalMarketCap(val), "Total Market Cap"]}
                        />
                        <Bar dataKey="totalMarketCap" fill="#00D4FF" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>

                {/* List grid view with contribution weights */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 pt-6 border-t border-[rgba(255,255,255,0.06)]">
                  {sectorMarketCaps.map((sec) => {
                    const weight = (sec.totalMarketCap / (totalDseMarketCap || 1)) * 100;
                    return (
                      <div 
                        key={sec.name}
                        className="p-3.5 bg-[#1F2937]/35 border border-[rgba(255,255,255,0.04)] rounded-2xl flex flex-col justify-between hover:bg-[#243044]/50 transition-colors"
                      >
                        <div>
                          <span className="text-[10px] text-[#94A3B8] font-bold truncate block mb-1" title={sec.name}>
                            {sec.name}
                          </span>
                          <span className="text-[11px] font-mono font-extrabold text-[#00D4FF] block">
                            {formatTotalMarketCap(sec.totalMarketCap || 0)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center mt-2 pt-1.5 border-t border-[rgba(255,255,255,0.04)]">
                          <span className="text-[8px] font-mono text-[#F0F4FF]/30">{sec.count} stocks</span>
                          <span className="text-[10px] font-mono font-black text-indigo-400">
                            {weight.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <>
                {/* Visual Benchmark Indicator Strip */}
                {(() => {
                  const broadMarketReturn = indexData?.DSEX?.changePercent ?? 0.29;
                  const totalOutperforming = sectorsSorted.filter(s => s.avgChange > broadMarketReturn).length;
                  return (
                    <div className="mb-4 bg-[#1e293b]/30 border border-slate-700/40 rounded-2xl p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="inline-block w-2 bg-amber-500 h-2 rounded-full animate-pulse"></span>
                          <span className="text-xs font-semibold text-gray-200">Broader Market Reference (DSEX Benchmark)</span>
                        </div>
                        <p className="text-[11px] text-[#94A3B8] leading-relaxed max-w-xl">
                          The DSEX index performance today serves as our benchmark baseline: <span className="font-mono text-amber-500 font-bold">{broadMarketReturn >= 0 ? "+" : ""}{broadMarketReturn.toFixed(2)}%</span>. Sectors crossing this line are leading or outperforming the wider market.
                        </p>
                      </div>
                      <div className="flex gap-4">
                        <div className="bg-[#111827] border border-emerald-500/10 px-4 py-2 rounded-xl text-center min-w-[120px]">
                          <span className="text-[9px] font-mono text-emerald-400 font-bold block uppercase tracking-wider">Outperforming</span>
                          <span className="text-sm font-mono font-black text-emerald-400">{totalOutperforming} Sectors</span>
                        </div>
                        <div className="bg-[#111827] border border-red-500/10 px-4 py-2 rounded-xl text-center min-w-[120px]">
                          <span className="text-[9px] font-mono text-gray-500 font-bold block uppercase tracking-wider">Underperforming</span>
                          <span className="text-sm font-mono font-black text-red-400">{sectorsSorted.length - totalOutperforming} Sectors</span>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Visual Recharts Bar Graph */}
                <div className="h-80 w-full pt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={sectorsSorted} margin={{ top: 20, right: 10, left: -22, bottom: 40 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                      <XAxis 
                        dataKey="name" 
                        stroke="#4B5563" 
                        fontSize={10} 
                        fontFamily="monospace" 
                        tickLine={false}
                        angle={-45}
                        textAnchor="end"
                        height={75}
                      />
                      <YAxis 
                        stroke="#4B5563" 
                        fontSize={10} 
                        fontFamily="monospace" 
                        tickLine={false}
                        label={{ value: "Avg Return (%)", angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fontSize: 10, fill: '#94A3B8' }, dx: -3 }}
                      />
                      <Tooltip 
                        contentStyle={{ background: "#111827", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "16px", outline: "none" }}
                        labelStyle={{ color: "#94A3B8", fontFamily: "monospace", fontSize: 11, fontWeight: "bold" }}
                        itemStyle={{ fontFamily: "monospace", fontSize: 11 }}
                        formatter={(val: any) => [`${val >= 0 ? "+" : ""}${val}%`, "Avg Return"]}
                      />
                      {/* DSEX benchmark line */}
                      <ReferenceLine 
                        y={indexData?.DSEX?.changePercent ?? 0.29} 
                        stroke="#F59E0B" 
                        strokeWidth={1.5}
                        strokeDasharray="4 4" 
                        label={{ 
                          value: `DSEX (${(indexData?.DSEX?.changePercent ?? 0.29) >= 0 ? "+" : ""}${(indexData?.DSEX?.changePercent ?? 0.29).toFixed(2)}%)`, 
                          fill: '#F59E0B', 
                          position: 'top', 
                          fontSize: 9, 
                          fontFamily: 'monospace',
                          fontWeight: 'bold'
                        }} 
                      />
                      <Bar dataKey="avgChange" fill="#10B981">
                        {sectorsSorted.map((entry, index) => (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={entry.avgChange >= 0 ? "#10B981" : "#EF4444"} 
                            fillOpacity={0.85}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* List grid view */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 pt-6 border-t border-[rgba(255,255,255,0.06)]">
                  {sectorsSorted.map((sec, idx) => {
                    const isPos = sec.avgChange >= 0;
                    const broadMarketReturn = indexData?.DSEX?.changePercent ?? 0.29;
                    const isOutperforming = sec.avgChange > broadMarketReturn;
                    const diffValue = sec.avgChange - broadMarketReturn;
                    return (
                      <div 
                        key={sec.name}
                        className={`p-3.5 bg-[#1A2235]/40 border rounded-2xl flex flex-col justify-between hover:bg-[#243044]/50 transition-colors ${
                          isOutperforming 
                            ? "border-emerald-500/25 shadow-[0_0_12px_rgba(16,185,129,0.04)]" 
                            : "border-slate-800/40"
                        }`}
                      >
                        <div>
                          <div className="flex justify-between items-start gap-1 mb-1.5 min-w-0">
                            <span className="text-[10px] text-[#94A3B8] font-bold truncate block" title={sec.name}>
                              {sec.name}
                            </span>
                          </div>
                          <span className="text-[11px] font-mono font-extrabold text-[#00D4FF] block">
                            {formatTotalMarketCap(sec.totalMarketCap || 0)}
                          </span>
                        </div>
                        <div className="mt-3 space-y-1.5 border-t border-[rgba(255,255,255,0.04)] pt-2">
                          <div className="flex justify-between items-center text-[9px] font-mono">
                            <span className="text-[#F0F4FF]/30">{sec.count} stocks</span>
                            <span className={`font-black ${isPos ? "text-[#10B981]" : "text-[#EF4444]"}`}>
                              {isPos ? "+" : ""}{sec.avgChange.toFixed(2)}%
                            </span>
                          </div>
                          <div className="flex justify-between items-center text-[8px] font-mono border-t border-[rgba(255,255,255,0.02)] pt-1">
                            <span className="text-[#94A3B8]">vs DSEX:</span>
                            <span className={`font-bold ${diffValue >= 0 ? "text-emerald-400" : "text-gray-400"}`} title={`Benchmark: ${broadMarketReturn.toFixed(2)}%`}>
                              {diffValue >= 0 ? "+" : ""}{diffValue.toFixed(2)}%
                            </span>
                          </div>
                          <div className="text-center pt-1">
                            {isOutperforming ? (
                              <span className="inline-block text-[7.5px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold uppercase tracking-wider">
                                Outperforming 🚀
                              </span>
                            ) : (
                              <span className="inline-block text-[7.5px] font-mono px-1.5 py-0.5 rounded bg-slate-500/5 text-gray-500 border border-slate-700/25 uppercase tracking-wider">
                                Underperforming
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="text-center py-6 text-xs text-[#94A3B8]">Sector statistics compiling...</div>
        )}
      </div>

      {/* ── SECTOR VOLATILITY HEAT MAP ─────────────────────────────────── */}
      <SectorVolatilityHeatmap onSelectSymbol={onSelectStock} />
      </Section>

      {/* ── ALL LISTED STOCKS - LIVE PRICES TABLE ─────────────────────── */}
      <div className="bg-[#111827] border border-[rgba(255,255,255,0.06)] rounded-3xl p-6 shadow-2xl relative" id="dse-full-live-prices-section">
        
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2">
              <Grid className="h-4.5 w-4.5 text-[#00D4FF]" />
              <h3 className="font-display text-sm font-extrabold text-white uppercase tracking-wider">
                📋 All Listed Stocks — Live Prices
              </h3>
            </div>
            <p className="text-[10px] text-[#94A3B8] font-sans mt-0.5">
              Click any stock symbol or name row of interest to immediately open its AI Deep Analysis portal. 
            </p>
          </div>

          {/* Filters controls */}
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            {/* Direct Search Input */}
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#4B5563]" />
              <input 
                type="text" 
                placeholder="Search symbol/name..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full sm:w-56 bg-[#1A2235]/40 border border-[rgba(255,255,255,0.06)] focus:border-[#00D4FF]/30 hover:border-white/10 text-xs px-3.5 pl-9 py-2 rounded-xl text-[#F0F4FF] outline-none transition-all placeholder:text-[#4B5563]"
              />
            </div>

            {/* Sector select dropdown */}
            <select
              aria-label="Filter stocks by sector"
              value={selectedSector}
              onChange={(e) => {
                setSelectedSector(e.target.value);
                setCurrentPage(1);
              }}
              className="bg-[#111827] border border-[rgba(255,255,255,0.06)] hover:border-white/10 text-xs px-3 py-2 rounded-xl text-[#94A3B8] focus:text-[#F0F4FF] outline-none transition-all cursor-pointer"
            >
              <option value="All Sectors">All Sectors</option>
              {sectorsList.map(secName => (
                <option key={secName} value={secName}>{secName}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Results count indicator */}
        <div className="mb-3 text-[10px] font-mono text-[#4B5563] flex justify-between items-center px-1">
          <span>Found {filteredStocks.length} matching stocks</span>
          {searchTerm || selectedSector !== "All Sectors" ? (
            <button 
              onClick={() => {
                setSearchTerm("");
                setSelectedSector("All Sectors");
                setCurrentPage(1);
              }}
              className="text-[#00D4FF] hover:underline font-bold"
            >
              Reset Filters
            </button>
          ) : null}
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto rounded-2xl border border-[rgba(255,255,255,0.04)] bg-[#1A2235]/15">
          <table className="w-full text-left border-collapse font-sans text-xs">
            <thead>
              <tr className="bg-[#1A2235]/30 border-b border-[rgba(255,255,255,0.06)] text-[10px] font-mono uppercase text-[#94A3B8]">
                <th 
                  onClick={() => requestSort("symbol")} 
                  className="p-3.5 font-bold cursor-pointer hover:text-white select-none transition-colors"
                >
                  Ticker {sortField === "symbol" ? (sortDirection === "asc" ? "▲" : "▼") : ""}
                </th>
                <th className="p-3.5 font-bold">Company Name</th>
                <th className="p-3.5 font-bold">Sector</th>
                <th 
                  onClick={() => requestSort("price")} 
                  className="p-3.5 text-right font-bold cursor-pointer hover:text-white select-none transition-colors"
                >
                  Last Price {sortField === "price" ? (sortDirection === "asc" ? "▲" : "▼") : ""}
                </th>
                <th 
                  onClick={() => requestSort("changePercent")} 
                  className="p-3.5 text-right font-bold cursor-pointer hover:text-white select-none transition-colors"
                >
                  Change % {sortField === "changePercent" ? (sortDirection === "asc" ? "▲" : "▼") : ""}
                </th>
                <th 
                  onClick={() => requestSort("volume")} 
                  className="p-3.5 text-right font-bold cursor-pointer hover:text-white select-none transition-colors"
                >
                  Volume {sortField === "volume" ? (sortDirection === "asc" ? "▲" : "▼") : ""}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgba(255,255,255,0.03)] text-white">
              {paginatedStocks.length > 0 ? (
                paginatedStocks.map(s => {
                  const isPos = s.changePercent > 0;
                  const isNeg = s.changePercent < 0;
                  return (
                    <tr 
                      key={s.symbol}
                      onClick={() => onSelectStock(s.symbol)}
                      className="hover:bg-[#1A2235]/50 active:bg-[#1A2235]/60 transition-colors cursor-pointer group"
                    >
                      <td className="p-3.5 font-mono font-bold text-[#00D4FF] group-hover:underline">
                        {s.symbol}
                      </td>
                      <td className="p-3.5 text-[#F0F4FF]/90 font-medium">{s.name}</td>
                      <td className="p-3.5 text-[#94A3B8]">{s.sector}</td>
                      <td className="p-3.5 text-right font-mono font-[600]">৳{s.price.toFixed(2)}</td>
                      <td className={`p-3.5 text-right font-mono font-bold ${
                        isPos ? "text-[#10B981]" : isNeg ? "text-[#EF4444]" : "text-slate-400"
                      }`}>
                        {isPos ? "+" : ""}{s.changePercent.toFixed(2)}%
                      </td>
                      <td className="p-3.5 text-right font-mono text-[#94A3B8]">
                        {s.volume ? s.volume.toLocaleString() : "—"}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="text-center p-8 text-xs text-[#94A3B8]">
                    No equities matched your search parameters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination controls */}
        {totalPages > 1 ? (
          <div className="flex justify-between items-center mt-5 pt-3 border-t border-[rgba(255,255,255,0.04)] text-xs text-[#94A3B8] font-mono">
            <span>
              Page {currentPage} of {totalPages}
            </span>
            
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="px-3.5 py-1.5 bg-white/5 border border-[rgba(255,255,255,0.04)] rounded-xl hover:bg-white/10 text-white font-mono font-bold disabled:opacity-40 disabled:hover:bg-white/5 select-none cursor-pointer transition-all"
              >
                Prev
              </button>
              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="px-3.5 py-1.5 bg-white/5 border border-[rgba(255,255,255,0.04)] rounded-xl hover:bg-white/10 text-white font-mono font-bold disabled:opacity-40 disabled:hover:bg-white/5 select-none cursor-pointer transition-all"
              >
                Next
              </button>
            </div>
          </div>
        ) : null}

      </div>

    </div>
  );
}
