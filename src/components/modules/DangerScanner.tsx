import React, { useState, useEffect } from "react";
import { DangerResult } from "../../types";
import { Search, AlertTriangle, RefreshCw } from "lucide-react";

export const DangerScanner: React.FC = () => {
  const [list, setList] = useState<DangerResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters state
  const [selectedSector, setSelectedSector] = useState<string>("");
  const [minScore, setMinScore] = useState<number>(10);
  const [searchQuery, setSearchQuery] = useState("");

  const sectorsList = [
    "Bank", "Pharmaceuticals & Chemicals", "Telecommunication", "Fuel & Power",
    "Engineering", "Food & Allied", "Cement", "Insurance", "Textile",
    "Financial Institutions", "Tannery Industries", "Miscellaneous",
    "Information Technology", "Ceramics Sector", "Paper & Printing", "Travel & Leisure"
  ];

  const fetchDangers = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (selectedSector) params.append("sector", selectedSector);
      params.append("minScore", minScore.toString());
      params.append("limit", "45");

      const res = await fetch(`/api/scanner/dangers?${params.toString()}`);
      if (!res.ok) {
        throw new Error("Failed to scan distributive dangers.");
      }

      const json = await res.json();
      setList(json);
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDangers();
  }, [selectedSector, minScore]);

  const searchedList = list.filter(item => 
    item.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div id="danger-scanner-module" className="bg-slate-900/40 border border-slate-805 p-6 rounded-xl space-y-6">
      
      {/* Title */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h4 className="font-sans font-medium text-slate-100 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-orange-400" />
            Systemic Danger & Bubble Scanners
          </h4>
          <p className="text-xs text-slate-400 mt-1">
            Detecting technical overextensions, heavy institutional distributions, and balance sheet solvency breakdown signals
          </p>
        </div>
        <button 
          onClick={fetchDangers}
          className="p-1 px-3 py-1 bg-slate-800 hover:bg-slate-700/80 rounded transition text-xs font-mono font-medium flex items-center gap-2 text-slate-200 border border-slate-700"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Re-Scan Market
        </button>
      </div>

      {/* Filter widgets */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 bg-slate-950/20 p-4 border border-slate-800 rounded-lg text-xs font-mono">
        
        {/* Ticker Search */}
        <div className="md:col-span-4 space-y-1.5">
          <span className="text-[10px] text-slate-500 uppercase tracking-wide font-semibold">SEARCH SYMBOLS</span>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-500" />
            <input 
              type="text" 
              placeholder="Search symbols/name..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded p-2 pl-9 outline-none text-slate-200 focus:border-orange-500/50 text-xs font-mono transition"
            />
          </div>
        </div>

        {/* Sector Selection */}
        <div className="md:col-span-4 space-y-1.5">
          <span className="text-[10px] text-slate-500 uppercase tracking-wide font-semibold">SECTOR MATRIX FILTER</span>
          <select 
            value={selectedSector}
            onChange={(e) => setSelectedSector(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded p-2 outline-none text-slate-300 focus:border-orange-500/50 text-xs font-mono transition"
          >
            <option value="">-- ALL DSE SECTORS --</option>
            {sectorsList.map((sect, i) => (
              <option key={i} value={sect}>{sect.toUpperCase()}</option>
            ))}
          </select>
        </div>

        {/* Threshold Selection */}
        <div className="md:col-span-4 space-y-1.5">
          <span className="text-[10px] text-slate-500 uppercase tracking-wide font-semibold">MIN SEVERITY SCORE</span>
          <select 
            value={minScore.toString()}
            onChange={(e) => setMinScore(Number(e.target.value))}
            className="w-full bg-slate-900 border border-slate-800 rounded p-2 outline-none text-slate-300 focus:border-orange-500/50 text-xs font-mono transition"
          >
            <option value="6">Low Risk Threshold (6+ Elevatings)</option>
            <option value="10">Standard Risk Threshold (10+ Bearish indicators)</option>
            <option value="17">Critical Bubble/Crash Threshold (17+ Extreme Distribution)</option>
          </select>
        </div>

      </div>

      {/* Grid listing */}
      {loading ? (
        <div className="flex flex-col items-center justify-center p-12 bg-slate-950/10 border border-slate-850 rounded-lg min-h-[300px]">
          <RefreshCw className="animate-spin text-orange-500 h-8 w-8 mb-2" />
          <span className="text-sm font-mono text-slate-400">Sweeping asset warnings & cash exits...</span>
        </div>
      ) : searchedList.length === 0 ? (
        <div className="p-12 text-center bg-slate-950/10 border border-slate-850 rounded-lg text-slate-500 font-mono text-sm leading-normal">
          No assets holding active risk distributions above the selected risk rating ({minScore}+). Fully optimized asset structures!
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {searchedList.map((item, idx) => {
            const riskColors = 
              item.dangerScore >= 18 ? "bg-red-950 text-red-300 border-red-500/30 font-black animate-pulse shadow-sm shadow-red-500/10" :
              item.dangerScore >= 12 ? "bg-orange-950 text-orange-300 border-orange-500/20 font-bold" :
              "bg-amber-950/50 text-amber-300 border-amber-500/20";

            return (
              <div 
                key={idx} 
                className="bg-slate-950/20 border border-slate-800/80 rounded-lg p-4 hover:border-slate-700 hover:bg-slate-900/10 transition flex flex-col justify-between space-y-4"
              >
                {/* Header block */}
                <div className="space-y-1">
                  <div className="flex justify-between items-start gap-2">
                    <span className="text-sm font-bold text-slate-100 font-mono tracking-tight">{item.symbol}</span>
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${riskColors}`}>
                      RISK {item.dangerScore}
                    </span>
                  </div>
                  <span className="text-xs text-slate-400 block truncate font-sans">{item.name}</span>
                  <span className="text-[10px] text-slate-500 block truncate font-mono uppercase">{item.sector}</span>
                </div>

                {/* Analytical breakdown */}
                <div className="grid grid-cols-2 gap-2 text-[10.5px] font-mono bg-slate-950/40 p-2.5 rounded border border-slate-850/60">
                  <div className="space-y-0.5">
                    <span className="text-slate-500 block">30D Price Drift:</span>
                    <span className={`font-semibold ${item.priceChange30D < 0 ? "text-rose-400" : "text-emerald-400"}`}>
                      {item.priceChange30D > 0 ? `+${item.priceChange30D}%` : `${item.priceChange30D}%`}
                    </span>
                  </div>
                  <div className="space-y-0.5 text-right">
                    <span className="text-slate-500 block">Solvency (FHR):</span>
                    <span className={`font-semibold ${item.fundamentalScore < 45 ? "text-rose-400" : "text-slate-350"}`}>
                      {item.fundamentalScore}
                    </span>
                  </div>
                </div>

                {/* Warnings check-list */}
                <div className="space-y-1.5 flex-1 select-none">
                  <span className="text-[9px] font-mono text-slate-500 uppercase tracking-widest block font-bold">RISK WARNING TRIGGERS</span>
                  <div className="flex flex-wrap gap-1">
                    {item.warnings.slice(0, 3).map((warn, wIdx) => {
                      const warnClean = warn.split(" at ")[0].split(" is ")[0].split(" has ")[0].split(" (")[0];
                      return (
                        <span key={wIdx} className="text-[9.5px] font-mono bg-slate-800/40 text-rose-400/80 border border-slate-750 rounded px-1.5 py-0.5 leading-none">
                          ⚠ {warnClean}
                        </span>
                      );
                    })}
                    {item.warnings.length > 3 && (
                      <span className="text-[9px] font-mono text-slate-550 px-1 py-0.5">
                        +{item.warnings.length - 3} more
                      </span>
                    )}
                  </div>
                </div>

                {/* Footer block */}
                <div className="pt-2.5 border-t border-slate-850/65 flex justify-between items-center text-xs">
                  <div className="font-mono">
                    <span className="text-slate-550 text-[9.5px] block">LATEST PRICE</span>
                    <span className="font-bold text-slate-200">৳{item.currentPrice.toFixed(2)}</span>
                  </div>
                  <span className={`text-[10.5px] font-mono font-bold px-2 py-0.5 rounded ${
                    item.tradingSignal?.includes("NEGATIVE") ? "text-red-400 bg-red-950/20" : "text-orange-400 bg-orange-950/20"
                  }`}>
                    {item.tradingSignal}
                  </span>
                </div>

              </div>
            );
          })}
        </div>
      )}

    </div>
  );
};
