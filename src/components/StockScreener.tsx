import React, { useState, useMemo } from "react";
import { StockData } from "../types";
import { Search, ArrowUpDown, Filter, TrendingUp, TrendingDown, Star } from "lucide-react";
import { formatVolume } from "../utils/formatters";

interface StockScreenerProps {
  stocks: StockData[];
  onSelectStock: (symbol: string) => void;
  selectedSymbol: string;
  watchlist: StockData[];
  onToggleWatchlist: (symbol: string) => void;
}

type SortField = 'symbol' | 'price' | 'changePercent' | 'peRatio' | 'eps' | 'nav' | 'volume' | 'divYield';
type SortDirection = 'asc' | 'desc';

export default function StockScreener({
  stocks,
  onSelectStock,
  selectedSymbol,
  watchlist,
  onToggleWatchlist
}: StockScreenerProps) {
  const [search, setSearch] = useState("");
  const [selectedSector, setSelectedSector] = useState("All Sectors");
  const [sortField, setSortField] = useState<SortField>('changePercent');
  const [sortDir, setSortDir] = useState<SortDirection>('desc');

  // Dynamically extract unique sectors
  const sectors = useMemo(() => {
    const list = new Set<string>();
    stocks.forEach(s => {
      if (s.sector) list.add(s.sector);
    });
    return ["All Sectors", ...Array.from(list)];
  }, [stocks]);

  // Handle click on column header for sorting
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  // Screen & filter stock listing
  const screenedStocks = useMemo(() => {
    return stocks
      .filter(s => {
        const matchesSearch = 
          s.symbol.toLowerCase().includes(search.toLowerCase()) ||
          s.name.toLowerCase().includes(search.toLowerCase()) ||
          (s.sector && s.sector.toLowerCase().includes(search.toLowerCase()));
          
        const matchesSector = 
          selectedSector === "All Sectors" || 
          s.sector === selectedSector;
          
        return matchesSearch && matchesSector;
      })
      .sort((a, b) => {
        let valA: any = a[sortField];
        let valB: any = b[sortField];

        // Safely handle null / undefined values
        if (valA === null || valA === undefined) valA = sortDir === 'asc' ? Infinity : -Infinity;
        if (valB === null || valB === undefined) valB = sortDir === 'asc' ? Infinity : -Infinity;

        if (typeof valA === 'string' && typeof valB === 'string') {
          return sortDir === 'asc' 
            ? valA.localeCompare(valB) 
            : valB.localeCompare(valA);
        }

        return sortDir === 'asc'
          ? (valA as number) - (valB as number)
          : (valB as number) - (valA as number);
      });
  }, [stocks, search, selectedSector, sortField, sortDir]);

  return (
    <div className="bg-[#111827] border border-[rgba(255,255,255,0.08)] rounded-3xl p-6 shadow-sm space-y-6" id="stock-screener-block">
      {/* Block Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-[rgba(255,255,255,0.05)] pb-4">
        <div>
          <h3 className="font-display text-sm font-extrabold text-white tracking-wider uppercase flex items-center gap-2">
            📊 Bangladesh Ticker Screener
          </h3>
          <p className="text-[11px] text-[#94A3B8] font-sans mt-1">
            Sort and filter through DSE blue-chips by multi-factor financial indices to discover values.
          </p>
        </div>

        {/* Live Filter count badge */}
        <div className="px-3 py-1 bg-blue-500/10 border border-blue-500/20 text-blue-400 font-mono text-[10px] font-bold rounded-full">
          Showing {screenedStocks.length} of {stocks.length} listings
        </div>
      </div>

      {/* Screen Controls Toolbar */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
        {/* Search Input Filter */}
        <div className="md:col-span-6 relative">
          <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-[#64748B]">
            <Search className="h-4 w-4" />
          </div>
          <input
            type="text"
            placeholder="Search by Symbol, Company Name, or Sector class..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#1A2235] border border-[rgba(255,255,255,0.08)] rounded-xl pl-9 pr-4 py-2.5 text-xs text-white font-medium outline-none focus:bg-[#1A2235]/70 focus:border-indigo-500 transition-all font-sans placeholder:text-[#64748B]"
          />
        </div>

        {/* Sector Class Select Filter */}
        <div className="md:col-span-6 relative flex gap-2">
          <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-[#64748B]">
            <Filter className="h-4 w-4" />
          </div>
          <select
            value={selectedSector}
            onChange={(e) => setSelectedSector(e.target.value)}
            className="w-full bg-[#1A2235] border border-[rgba(255,255,255,0.08)] rounded-xl pl-9 pr-4 py-2.5 text-xs text-[#CBD5E1] font-bold outline-none cursor-pointer focus:bg-[#1A2235]/70 focus:border-indigo-500 transition-all font-sans appearance-none"
          >
            {sectors.map((sec, i) => (
              <option key={i} value={sec} className="bg-[#111827] text-white">{sec}</option>
            ))}
          </select>
          {/* Custom chevron to bypass styling blocks */}
          <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-slate-400 pr-1 text-[8px]">
            ▼
          </div>
        </div>
      </div>

      {/* Main Screener Datatable */}
      <div className="overflow-x-auto border border-[rgba(255,255,255,0.08)] rounded-2xl shadow-inner scrollbar-thin">
        <table className="w-full text-left border-collapse font-mono text-xs">
          <thead>
            <tr className="bg-[#1A2235]/40 border-b border-[rgba(255,255,255,0.08)] text-[#94A3B8] font-bold tracking-tight text-[10px] uppercase select-none">
              <th className="py-3 px-4 text-center w-12">Watch</th>
              <th className="py-3 px-3 cursor-pointer hover:bg-[#1A2235] active:bg-[#1A2235]/65 transition-colors" onClick={() => handleSort('symbol')}>
                <div className="flex items-center gap-1">
                  Ticker {sortField === 'symbol' && (sortDir === 'asc' ? '▲' : '▼')}
                  {sortField !== 'symbol' && <ArrowUpDown className="h-3 w-3 opacity-30" />}
                </div>
              </th>
              <th className="py-3 px-3 cursor-pointer hover:bg-[#1A2235] active:bg-[#1A2235]/65 transition-colors" onClick={() => handleSort('price')}>
                <div className="flex items-center gap-1">
                  Price {sortField === 'price' && (sortDir === 'asc' ? '▲' : '▼')}
                  {sortField !== 'price' && <ArrowUpDown className="h-3 w-3 opacity-30" />}
                </div>
              </th>
              <th className="py-3 px-3 cursor-pointer hover:bg-[#1A2235] active:bg-[#1A2235]/65 transition-colors" onClick={() => handleSort('changePercent')}>
                <div className="flex items-center gap-1">
                  Change {sortField === 'changePercent' && (sortDir === 'asc' ? '▲' : '▼')}
                  {sortField !== 'changePercent' && <ArrowUpDown className="h-3 w-3 opacity-30" />}
                </div>
              </th>
              <th className="py-3 px-3 cursor-pointer hover:bg-[#1A2235] active:bg-[#1A2235]/65 transition-colors" onClick={() => handleSort('peRatio')}>
                <div className="flex items-center gap-1">
                  P/E {sortField === 'peRatio' && (sortDir === 'asc' ? '▲' : '▼')}
                  {sortField !== 'peRatio' && <ArrowUpDown className="h-3 w-3 opacity-30" />}
                </div>
              </th>
              <th className="py-3 px-3 cursor-pointer hover:bg-[#1A2235] active:bg-[#1A2235]/65 transition-colors" onClick={() => handleSort('eps')}>
                <div className="flex items-center gap-1">
                  EPS {sortField === 'eps' && (sortDir === 'asc' ? '▲' : '▼')}
                  {sortField !== 'eps' && <ArrowUpDown className="h-3 w-3 opacity-30" />}
                </div>
              </th>
              <th className="py-3 px-3 cursor-pointer hover:bg-[#1A2235] active:bg-[#1A2235]/65 transition-colors" onClick={() => handleSort('nav')}>
                <div className="flex items-center gap-1">
                  NAV {sortField === 'nav' && (sortDir === 'asc' ? '▲' : '▼')}
                  {sortField !== 'nav' && <ArrowUpDown className="h-3 w-3 opacity-30" />}
                </div>
              </th>
              <th className="py-3 px-3 cursor-pointer hover:bg-[#1A2235] active:bg-[#1A2235]/65 transition-colors" onClick={() => handleSort('divYield')}>
                <div className="flex items-center gap-1">
                  Yield {sortField === 'divYield' && (sortDir === 'asc' ? '▲' : '▼')}
                  {sortField !== 'divYield' && <ArrowUpDown className="h-3 w-3 opacity-30" />}
                </div>
              </th>
              <th className="py-3 px-3 cursor-pointer hover:bg-[#1A2235] active:bg-[#1A2235]/65 transition-colors text-right pr-4" onClick={() => handleSort('volume')}>
                <div className="flex items-center justify-end gap-1">
                  Volume {sortField === 'volume' && (sortDir === 'asc' ? '▲' : '▼')}
                  {sortField !== 'volume' && <ArrowUpDown className="h-3 w-3 opacity-30" />}
                </div>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[rgba(255,255,255,0.05)]">
            {screenedStocks.map((item) => {
              const isActive = selectedSymbol === item.symbol;
              const isUp = item.changePercent >= 0;
              const isFavorited = watchlist.some(w => w.symbol === item.symbol);

              return (
                <tr
                  key={item.symbol}
                  className={`hover:bg-[#1A2235]/30 transition-colors cursor-pointer group ${
                    isActive ? "bg-indigo-600/10 font-bold border-l-2 border-l-indigo-500" : ""
                  }`}
                  onClick={() => onSelectStock(item.symbol)}
                >
                  {/* Favorite watch button */}
                  <td className="py-2.5 px-4 text-center" onClick={(e) => { e.stopPropagation(); onToggleWatchlist(item.symbol); }}>
                    <button className="text-[#64748B] hover:text-amber-400 hover:scale-115 transition-all p-1 cursor-pointer">
                      <Star className={`h-3.5 w-3.5 ${isFavorited ? "fill-amber-400 text-amber-400" : ""}`} />
                    </button>
                  </td>

                  {/* Symbol with subname */}
                  <td className="py-2.5 px-3">
                    <div className="flex items-center gap-1">
                      <span className="text-white font-extrabold font-display text-[12px] group-hover:text-amber-400 transition-colors">
                        {item.symbol}
                      </span>
                      <span className="text-[9px] text-[#94A3B8] font-sans font-medium truncate max-w-[130px] hidden lg:inline">
                        {item.name}
                      </span>
                    </div>
                  </td>

                  {/* Price */}
                  <td className="py-2.5 px-3 font-semibold text-white">
                    BDT {item.price.toFixed(2)}
                  </td>

                  {/* Change Percent with indicator colors */}
                  <td className={`py-2.5 px-3 font-bold ${isUp ? "text-emerald-450" : "text-rose-400"}`}>
                    <div className="flex items-center gap-0.5">
                      {isUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                      {isUp ? "+" : ""}{item.changePercent.toFixed(2)}%
                    </div>
                  </td>

                  {/* P/E Ratio */}
                  <td className="py-2.5 px-3 font-semibold text-[#CBD5E1]">
                    {item.peRatio !== null ? `${item.peRatio}x` : "N/A"}
                  </td>

                  {/* EPS */}
                  <td className="py-2.5 px-3 font-semibold text-[#CBD5E1]">
                    {item.eps !== null ? item.eps.toFixed(2) : "N/A"}
                  </td>

                  {/* NAV */}
                  <td className="py-2.5 px-3 font-semibold text-[#CBD5E1]">
                    {item.nav !== null ? `BDT ${item.nav}` : "N/A"}
                  </td>

                  {/* Yield */}
                  <td className="py-2.5 px-3 font-bold text-emerald-400">
                    {item.divYield !== null ? `${item.divYield}%` : "N/A"}
                  </td>

                  {/* Volume (short formatted) */}
                  <td className="py-2.5 px-3 text-right pr-4 text-[#CBD5E1]">
                    {formatVolume(item.volume)}
                  </td>
                </tr>
              );
            })}

            {screenedStocks.length === 0 && (
              <tr>
                <td colSpan={9} className="py-8 text-center text-xs text-[#94A3B8] font-sans italic">
                  No stock symbol matches search criteria. Try a different sector query.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="p-3.5 bg-[#1A2235]/40 border border-[rgba(255,255,255,0.05)] rounded-2xl flex items-center justify-between text-[10px] text-[#94A3B8] leading-none">
        <span>☝️ Click any listing row to instantly query technical indices, forecast pathways, AI health cards, and dividend charts!</span>
        <span className="font-bold text-indigo-400">DSE AI Analyst Panel</span>
      </div>
    </div>
  );
}
