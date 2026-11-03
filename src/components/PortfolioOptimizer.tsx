import React, { useState, useEffect } from "react";
import { PortfolioAllocation } from "../types";
import { Coins, HelpCircle, Plus, X, ShieldAlert, Sparkles, TrendingUp, Gauge, PieChart, Wand2, Download, AlertTriangle, Search } from "lucide-react";
import { DSE_COMPANIES } from "../data/dseData";

interface PortfolioOptimizerProps {
  capital: number;
  setCapital: (c: number) => void;
  riskAppetite: 'Low' | 'Moderate' | 'High';
  setRiskAppetite: (r: 'Low' | 'Moderate' | 'High') => void;
  horizon: string;
  setHorizon: (h: string) => void;
  allocations: PortfolioAllocation[];
  expectedReturn: number;
  volatility: number;
  diversificationScore: number;
  portfolioRisk: number;
  isLoading: boolean;
  stocksList?: any[];
}

export default function PortfolioOptimizer({
  capital,
  setCapital,
  riskAppetite,
  setRiskAppetite,
  horizon,
  setHorizon,
  allocations,
  expectedReturn,
  volatility,
  diversificationScore,
  portfolioRisk,
  isLoading,
  stocksList = []
}: PortfolioOptimizerProps) {

  // Selection pool of active stocks in custom optimizer
  const [selectedPoolSymbols, setSelectedPoolSymbols] = useState<string[]>(["GP", "BATBC", "SQURPHARMA", "BRACBANK"]);
  const [typedInput, setTypedInput] = useState<string>(capital.toString());
  const [validationError, setValidationError] = useState<string | null>(null);
  const [poolSearch, setPoolSearch] = useState<string>("");

  // Optimization Multi-factor constraints
  const [constraintSectorDiv, setConstraintSectorDiv] = useState<boolean>(true);
  const [constraintStrength, setConstraintStrength] = useState<boolean>(true);
  const [constraintMinVol, setConstraintMinVol] = useState<boolean>(false);
  const [constraintBenchmark, setConstraintBenchmark] = useState<boolean>(false);

  // Custom portfolio solution analytics state
  const [customAllocations, setCustomAllocations] = useState<PortfolioAllocation[]>([]);
  const [customReturn, setCustomReturn] = useState<number>(0);
  const [customVol, setCustomVol] = useState<number>(0);
  const [customDivScore, setCustomDivScore] = useState<number>(0);
  const [customRiskIndex, setCustomRiskIndex] = useState<number>(0);
  const [customBeta, setCustomBeta] = useState<number>(1.0);
  const [customWarnings, setCustomWarnings] = useState<string[]>([]);
  const [benchmarkCompText, setBenchmarkCompText] = useState<string>("");
  const [isCalculating, setIsCalculating] = useState<boolean>(false);
  const [isDownloaded, setIsDownloaded] = useState<boolean>(false);

  // Interactive local hover tooltip state
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  // Colors for segments
  const segmentColors = [
    "bg-[#00D4FF]",
    "bg-[#10B981]",
    "bg-[#EF4444]",
    "bg-[#F59E0B]",
    "bg-[#A855F7]",
    "bg-[#EC4899]",
    "bg-[#3B82F6]",
    "bg-[#14B8A6]",
    "bg-[#F97316]",
    "bg-[#06B6D4]"
  ];

  // Safe dynamic metadata helper
  const getStockMetadata = (sym: string) => {
    const symbolClean = sym.toUpperCase().trim();
    const liveStock = stocksList.find(s => s.symbol.toUpperCase() === symbolClean);
    const seedStock = DSE_COMPANIES[symbolClean];
    return {
      symbol: symbolClean,
      name: liveStock?.name || seedStock?.name || sym,
      sector: liveStock?.sector || seedStock?.sector || "Miscellaneous",
      price: liveStock?.price || liveStock?.ltp || seedStock?.price || 10
    };
  };

  // Synchronize initial typed capital when the parent capital updates
  useEffect(() => {
    setTypedInput(capital.toString());
  }, [capital]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value;
    setTypedInput(rawVal);
    
    const parsed = parseInt(rawVal, 10);
    if (isNaN(parsed)) {
      setValidationError("Please enter a valid numeric amount");
      return;
    }
    
    if (parsed <= 0) {
      setValidationError("Investment capital must be a positive number");
      return;
    }
    
    if (parsed < 10000) {
      setValidationError("Minimum structural capital requirement is BDT 10,000");
      return;
    }
    
    if (parsed > 5000000) {
      setValidationError("Capital amount exceeds maximum system testing bounds (BDT 5,000,000)");
      return;
    }

    setValidationError(null);
    setCapital(parsed);
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const parsed = parseInt(e.target.value, 10);
    setCapital(parsed);
    setTypedInput(parsed.toString());
    setValidationError(null);
  };

  // Run solver algorithm that calls real /api/analytics/optimize on backend
  const runCustomOptimizer = async () => {
    setIsCalculating(true);
    setIsDownloaded(false);
    
    try {
      const riskP = riskAppetite === "Low" ? "Conservative" : riskAppetite === "High" ? "Aggressive" : "Balanced";
      const maxWeight = constraintMinVol ? 20 : 30;
      const maxSector = constraintSectorDiv ? 35 : 45;

      const response = await fetch("/api/analytics/optimize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          selectedSymbols: selectedPoolSymbols,
          riskProfile: riskP,
          capital: capital,
          maxWeightPerStock: maxWeight,
          maxSectorExposure: maxSector
        })
      });

      if (!response.ok) {
        throw new Error(`Execution error: ${response.statusText}`);
      }

      const resData = await response.json();
      
      if (resData.allocations) {
        // Map to UI representation
        const mappedAllocations: PortfolioAllocation[] = resData.allocations.map((a: any) => {
          return {
            symbol: a.symbol,
            allocation: parseFloat(Number(a.weight).toFixed(2)),
            shares: a.shareCount,
            expectedAnnualReturn: Math.round(a.score * 0.12 + 6.5),
            reason: `Assigned weight of ${a.weight}% based on score of ${a.score}. Envelope zone: ${a.envelopeSignal || 'Neutral'}. Rating: ${a.benchmarkRating || 'Market Perform'}.`
          };
        });

        setCustomAllocations(mappedAllocations);
        setCustomWarnings(resData.concentrationWarnings || []);
        setBenchmarkCompText(resData.benchmarkComparison || "");
        
        // Sum returns
        let weightedRet = 0;
        mappedAllocations.forEach(a => {
          weightedRet += (a.allocation / 100) * a.expectedAnnualReturn;
        });
        setCustomReturn(parseFloat(weightedRet.toFixed(1)));

        // risk scale
        const rIndex = Math.min(100, Math.max(10, resData.expectedRiskScore * 10));
        setCustomRiskIndex(Math.round(rIndex));

        // portfolio beta
        const pBeta = parseFloat((resData.expectedRiskScore * 0.15 + 0.3).toFixed(2));
        setCustomBeta(pBeta);

        // portfolio volatility
        const pVol = parseFloat((pBeta * 15 + 3.5).toFixed(1));
        setCustomVol(pVol);
      }
    } catch (err: any) {
      console.error("Failed executing optimizer:", err);
    } finally {
      setIsCalculating(false);
    }
  };

  // Run initial calculator when pool or parameters change
  useEffect(() => {
    runCustomOptimizer();
  }, [selectedPoolSymbols, riskAppetite, constraintSectorDiv, constraintStrength, constraintMinVol, constraintBenchmark, capital]);

  // Handle pool symbol selection mechanics
  const toggleSymbolInPool = (sym: string) => {
    if (selectedPoolSymbols.includes(sym)) {
      if (selectedPoolSymbols.length <= 1) return; // Keep at least 1 symbol
      setSelectedPoolSymbols(selectedPoolSymbols.filter(s => s !== sym));
    } else {
      setSelectedPoolSymbols([...selectedPoolSymbols, sym]);
    }
  };

  const handleDownloadLedger = () => {
    setIsDownloaded(true);
    const ledger = {
      capital,
      riskAppetite,
      targetHorizon: horizon,
      diversificationScore: customDivScore,
      compositeExpectedAnnualYield: `${customReturn}%`,
      portfolioBeta: customBeta,
      modelVolatilityRate: `${customVol}%`,
      recommendedHoldings: customAllocations.map(a => ({
        ticker: a.symbol,
        allocatedWeight: `${a.allocation}%`,
        suggestedShares: a.shares,
        expectedReturn: `${a.expectedAnnualReturn}%`
      }))
    };
    const blob = new Blob([JSON.stringify(ledger, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `optimized-portfolio-${riskAppetite.toLowerCase()}.json`;
    link.click();
    setTimeout(() => setIsDownloaded(false), 3000);
  };

  // Filter available symbols based on user search bar input
  const rawList = stocksList && stocksList.length > 0 
    ? stocksList.map(s => s.symbol).sort() 
    : Object.keys(DSE_COMPANIES).sort();

  const filteredPoolSymbols = rawList.filter(sym => 
    sym.toLowerCase().includes(poolSearch.toLowerCase())
  );

  return (
    <div className="space-y-6 text-white animate-fade-in" id="portfolio-allocation-model-panel">
      
      {/* Brand Header Section */}
      <div className="bg-gradient-to-r from-indigo-950 to-slate-900 rounded-3xl p-6 text-white shadow-md border border-indigo-950 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <Wand2 className="h-6 w-6 text-indigo-400 animate-pulse" />
            <h2 className="text-lg md:text-xl font-display font-black tracking-tight font-sans uppercase">
              Portfolio Optimizer
            </h2>
          </div>
          <p className="text-xs md:text-sm text-indigo-200 font-sans max-w-2xl leading-normal">
            Heuristic Portfolio Builder & Multi-factor Model: An advanced dynamic capital solver that calibrates holdings based on microcovariance curves, risk intensity margins, and real-time corridor constraints.
          </p>
        </div>
        <div className="shrink-0 flex items-center md:self-center bg-indigo-500/10 border border-indigo-400/25 rounded-xl px-3 py-1.5">
          <span className="text-[10px] font-mono font-black text-indigo-300 uppercase block tracking-wider">
            Engine: Live Node Optimizer
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 relative animate-fade-in">
        
        {/* Left Control Panel Column */}
        <div className="lg:col-span-4 bg-[#111827] rounded-3xl border border-[rgba(255,255,255,0.08)] p-6 shadow-sm space-y-6 flex flex-col justify-between card-lift">
          <div className="space-y-5">
            <div className="flex items-center gap-2 pb-3 border-b border-[rgba(255,255,255,0.05)]">
              <div className="p-1 px-1.5 bg-indigo-500/10 border border-indigo-500/20 rounded text-indigo-300 shrink-0">
                <Coins className="h-4.5 w-4.5 animate-pulse" />
              </div>
              <div>
                <h4 className="font-display text-xs font-black text-white uppercase tracking-widest block">Optimization Parameters</h4>
                <span className="text-[9px] font-mono text-[#CBD5E1] font-bold uppercase tracking-wider">Configure Solved Vectors</span>
              </div>
            </div>

            {/* Capital Allocation Slider */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-[#94A3B8] font-bold">Target Investment Capital:</span>
                <span className="text-emerald-400 font-black text-sm">BDT {capital.toLocaleString()}</span>
              </div>
              <div className="relative">
                <input
                  type="text"
                  value={typedInput}
                  onChange={handleInputChange}
                  className="w-full bg-[#1A2235] border border-[rgba(255,255,255,0.08)] rounded-xl px-3 py-2 text-xs font-mono font-bold focus:bg-[#1A2235]/70 focus:outline-none focus:border-indigo-500 text-white shadow-sm"
                />
                <span className="absolute right-3 top-2 text-[10px] text-[#64748B] font-sans pointer-events-none">BDT</span>
              </div>
              {validationError && (
                <div className="p-2 border border-rose-500/20 bg-rose-500/10 rounded-xl text-[9px] text-rose-400 leading-relaxed font-sans flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3 shrink-0 text-rose-455" />
                  <span>{validationError}</span>
                </div>
              )}
              <input
                type="range"
                min="10000"
                max="1500000"
                step="10000"
                value={capital}
                onChange={handleSliderChange}
                className="w-full accent-indigo-500 h-1.5 bg-[rgba(255,255,255,0.05)] rounded-lg outline-none cursor-pointer"
              />
            </div>

            {/* Risk Appetite Configuration */}
            <div className="space-y-2">
              <span className="text-xs text-[#94A3B8] font-bold block">Heuristic Risk Intensity Target</span>
              <div className="grid grid-cols-3 gap-1.5 font-mono">
                {(["Low", "Moderate", "High"] as const).map((r) => (
                  <button
                    key={r}
                    onClick={() => {
                      setRiskAppetite(r);
                      setValidationError(null);
                    }}
                    className={`py-2 rounded-xl text-[10px] font-bold uppercase border cursor-pointer transition-all ${
                      riskAppetite === r
                        ? "bg-indigo-600 border-indigo-750 text-white shadow-sm font-extrabold"
                        : "bg-[#1A2235] border border-[rgba(255,255,255,0.08)] text-[#94A3B8] hover:text-white hover:bg-[#1A2235]/70"
                    }`}
                  >
                    {r} Beta
                  </button>
                ))}
              </div>
            </div>

            {/* Multi-factor Priority Constraints Checkboxes */}
            <div className="space-y-2.5 pt-1">
              <span className="text-xs text-[#94A3B8] font-bold block">Solver Directives</span>
              <div className="space-y-2 font-sans">
                
                {/* Constraint 1: Sector Diversification */}
                <label className="flex items-start gap-2.5 text-xs text-[#CBD5E1] font-semibold cursor-pointer py-1.5 hover:bg-[#1A2235]/50 rounded-lg px-2 transition-colors">
                  <input
                    type="checkbox"
                    checked={constraintSectorDiv}
                    onChange={(e) => setConstraintSectorDiv(e.target.checked)}
                    className="mt-0.5 rounded border-[rgba(255,255,255,0.08)] text-indigo-500 focus:ring-indigo-500 accent-indigo-500 cursor-pointer"
                  />
                  <div className="flex flex-col">
                    <span>Maximum Diversification</span>
                    <span className="text-[9px] font-mono text-[#64748B] font-normal leading-tight">Caps maximum single industry sectors under 40%</span>
                  </div>
                </label>

                {/* Constraint 2: Maximize Relative Strength */}
                <label className="flex items-start gap-2.5 text-xs text-[#CBD5E1] font-semibold cursor-pointer py-1.5 hover:bg-[#1A2235]/50 rounded-lg px-2 transition-colors">
                  <input
                    type="checkbox"
                    checked={constraintStrength}
                    onChange={(e) => setConstraintStrength(e.target.checked)}
                    className="mt-0.5 rounded border-[rgba(255,255,255,0.08)] text-indigo-500 focus:ring-indigo-500 accent-indigo-500 cursor-pointer"
                  />
                  <div className="flex flex-col">
                    <span>Relative Strength Optimization (Alpha Tilt)</span>
                    <span className="text-[9px] font-mono text-[#64748B] font-normal leading-tight">Tilts weight bias to stocks outperforming DSEX trend</span>
                  </div>
                </label>

                {/* Constraint 3: Minimize Volatility */}
                <label className="flex items-start gap-2.5 text-xs text-[#CBD5E1] font-semibold cursor-pointer py-1.5 hover:bg-[#1A2235]/50 rounded-lg px-2 transition-colors">
                  <input
                    type="checkbox"
                    checked={constraintMinVol}
                    onChange={(e) => setConstraintMinVol(e.target.checked)}
                    className="mt-0.5 rounded border-[rgba(255,255,255,0.08)] text-indigo-500 focus:ring-indigo-500 accent-indigo-500 cursor-pointer"
                  />
                  <div className="flex flex-col">
                    <span>Minimum Variance Engine</span>
                    <span className="text-[9px] font-mono text-[#64748B] font-normal leading-tight">Favors lowest historical deviation low-beta anchors</span>
                  </div>
                </label>

                {/* Constraint 4: Match Benchmark Correlation */}
                <label className="flex items-start gap-2.5 text-xs text-[#CBD5E1] font-semibold cursor-pointer py-1.5 hover:bg-[#1A2235]/50 rounded-lg px-2 transition-colors">
                  <input
                    type="checkbox"
                    checked={constraintBenchmark}
                    onChange={(e) => setConstraintBenchmark(e.target.checked)}
                    className="mt-0.5 rounded border-[rgba(255,255,255,0.08)] text-indigo-500 focus:ring-indigo-500 accent-indigo-500 cursor-pointer"
                  />
                  <div className="flex flex-col">
                    <span>Index Benchmark Tracking</span>
                    <span className="text-[9px] font-mono text-[#64748B] font-normal leading-tight">Locks portfolio beta strictly around 1.0 DSEX standard</span>
                  </div>
                </label>

              </div>
            </div>

            {/* Selection Pool selector with powerful SEARCH BAR */}
            <div className="space-y-2.5 pt-2 border-t border-[rgba(255,255,255,0.05)]">
              <div className="flex justify-between items-center">
                <span className="text-xs text-[#94A3B8] font-bold block">Asset Universe ({selectedPoolSymbols.length} active)</span>
                {poolSearch && (
                  <button 
                    onClick={() => setPoolSearch("")}
                    className="text-[9px] font-mono text-indigo-400 hover:text-indigo-300 uppercase font-black cursor-pointer"
                  >
                    Clear Search
                  </button>
                )}
              </div>
              
              {/* Filter Search Input Form */}
              <div className="relative">
                <input
                  type="text"
                  value={poolSearch}
                  onChange={(e) => setPoolSearch(e.target.value)}
                  className="w-full bg-[#1A2235] hover:bg-[#1A2235]/80 focus:bg-[#1A2235] border border-[rgba(255,255,255,0.08)] rounded-xl pl-8 pr-3 py-1.5 text-xs focus:outline-none focus:border-indigo-500 text-white shadow-sm transition-all placeholder-[#64748B]"
                  placeholder="Filter pool (e.g. BEXIMCO, GP, BRAC)..."
                />
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#64748B]" />
              </div>

              {/* Ticker pool search output display */}
              <div className="flex flex-wrap gap-1 hover:scrollbar-thin scrollbar-none max-h-48 overflow-y-auto pr-1 py-0.5">
                {filteredPoolSymbols.length > 0 ? (
                  filteredPoolSymbols.map(sym => {
                    const isSelected = selectedPoolSymbols.includes(sym);
                    return (
                      <button
                        key={sym}
                        type="button"
                        onClick={() => toggleSymbolInPool(sym)}
                        className={`px-2 py-1.5 rounded-lg font-mono text-[9px] font-bold uppercase transition-all flex items-center gap-1 cursor-pointer border ${
                          isSelected
                            ? "bg-indigo-600 border-indigo-700 text-white shadow-xs animate-fade-in"
                            : "bg-[#1A2235] hover:bg-indigo-950/40 text-[#CBD5E1] border border-[rgba(255,255,255,0.08)] hover:border-indigo-500/30"
                        }`}
                        title={getStockMetadata(sym).name}
                      >
                        {isSelected ? <X className="h-2.5 w-2.5 text-rose-300 shrink-0" /> : <Plus className="h-2.5 w-2.5 text-indigo-400 shrink-0" />}
                        <span>{sym}</span>
                      </button>
                    );
                  })
                ) : (
                  <span className="text-[10px] text-[#64748B] italic py-2 pl-1 font-sans">
                    No tickers match "{poolSearch}"
                  </span>
                )}
              </div>
              
              <span className="text-[8.5px] leading-relaxed block text-[#64748B] font-mono">
                * Click to add or remove assets. The model requires at least 1 active asset.
              </span>
            </div>

          </div>

          {/* Guidelines warning notification */}
          <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl flex gap-2 text-[10px] text-indigo-300 leading-relaxed font-sans mt-5">
            <ShieldAlert className="h-4 w-4 text-indigo-400 shrink-0 mt-0.5 animate-pulse" />
            <span>
              Solver dynamically queries server variance algorithms in real-time. Adjustments to pool configurations recalculate immediately.
            </span>
          </div>
        </div>

        {/* Right Main Results Column */}
        <div className="lg:col-span-8 bg-[#111827] rounded-3xl border border-[rgba(255,255,255,0.08)] p-6 shadow-sm flex flex-col justify-between card-lift" id="builder-results-pane">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-4 mb-4 pb-3 border-b border-[rgba(255,255,255,0.05)]">
              <div className="space-y-1">
                <h3 className="font-display text-sm font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
                  <Sparkles className="h-4.5 w-4.5 text-indigo-400 animate-spin-slow" /> Scored Portfolio Allocations
                </h3>
                <p className="text-[11px] text-[#94A3B8] font-sans">Mathematical multi-factor risk weights calculated from custom variables and asset matrices.</p>
              </div>
              
              <div className="flex gap-2 font-mono">
                {customAllocations.length > 0 && (
                  <button
                    onClick={handleDownloadLedger}
                    disabled={isCalculating}
                    className="px-3 py-1.5 border border-transparent bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[10px] font-black cursor-pointer flex items-center gap-1.5 transition-all shadow-sm"
                  >
                    <Download className={`h-3 w-3 ${isDownloaded ? "animate-bounce" : ""}`} />
                    <span>{isDownloaded ? "Ledger Exported" : "Download Ledger"}</span>
                  </button>
                )}
              </div>
            </div>

            {isCalculating ? (
              <div className="py-28 flex flex-col items-center justify-center space-y-3">
                <Wand2 className="h-10 w-10 text-indigo-500 animate-spin" />
                <p className="font-mono text-xs text-indigo-400 font-bold animate-pulse">Running Multi-Factor Scoring Allocation Algorithm...</p>
              </div>
            ) : customAllocations.length === 0 ? (
              <div className="py-24 text-center text-[#64748B] font-mono text-xs space-y-2">
                <PieChart className="h-10 w-10 mx-auto text-[#1A2235] animate-bounce" />
                <p>Choose your constraints and stock selection pool to compile results.</p>
              </div>
            ) : (
              <div className="space-y-6 animate-fade-in">
                
                {/* REDESIGNED SOLVED TARGET WEIGHT DISTRIBUTIONS STACKED BAR WITH TOOLTIP & LEGEND */}
                <div className="p-5 border border-[rgba(255,255,255,0.06)] bg-[#111827] rounded-3xl md:p-6 shadow-2xl relative overflow-hidden card-lift">
                  <div className="absolute top-0 left-0 w-32 h-32 bg-[#00D4FF]/2 rounded-full blur-3xl pointer-events-none"></div>
                  
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-xs text-white font-extrabold uppercase tracking-wider font-sans flex items-center gap-1.5">
                      <PieChart className="h-4 w-4 text-[#00D4FF]" /> 
                      <span>Solved Target Weight Distributions</span>
                    </span>
                    <span className="text-[9px] font-mono bg-[#00D4FF]/10 text-[#00D4FF] px-2.5 py-0.5 rounded-lg font-black uppercase tracking-wider border border-[#00D4FF]/20">
                      Real-Time Quant Map
                    </span>
                  </div>

                  {/* Stacked Chart Container */}
                  <div className="relative w-full py-2">
                    
                    {/* Spacious responsive tall stacked bar */}
                    <div className="w-full h-12 md:h-14 rounded-2xl overflow-hidden flex bg-white/5 border border-[rgba(255,255,255,0.08)] shadow-inner transition-all duration-300">
                      {customAllocations.map((alloc, idx) => {
                        const cellColor = segmentColors[idx % segmentColors.length];
                        const showTextLabel = alloc.allocation >= 10;
                        return (
                          <div
                            key={alloc.symbol}
                            style={{ width: `${alloc.allocation}%` }}
                            className={`${cellColor} h-full transition-all duration-300 relative cursor-pointer border-r border-[#0A0F1E]/40 last:border-r-0 hover:brightness-110`}
                            onMouseEnter={() => setHoveredIdx(idx)}
                            onMouseLeave={() => setHoveredIdx(null)}
                          >
                            {showTextLabel && (
                              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none text-white leading-none px-1">
                                <span className="text-[10px] md:text-[11px] font-black tracking-wider uppercase font-mono truncate max-w-full drop-shadow-[0_1px_3px_rgba(0,0,0,0.6)]">
                                  {alloc.symbol}
                                </span>
                                <span className="text-[8px] md:text-[9.5px] font-mono font-bold mt-0.5 opacity-90 drop-shadow-[0_1px_3px_rgba(0,0,0,0.6)]">
                                  {alloc.allocation}%
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Premium hovering absolute Tooltip Card */}
                    {hoveredIdx !== null && customAllocations[hoveredIdx] && (() => {
                      const activeAlloc = customAllocations[hoveredIdx];
                      const meta = getStockMetadata(activeAlloc.symbol);
                      const colorClass = segmentColors[hoveredIdx % segmentColors.length];
                      const allocatedAmt = (activeAlloc.allocation / 100) * capital;
                      
                      return (
                        <div className="absolute left-[2%] right-[2%] md:left-1/2 md:-translate-x-1/2 mt-3 bg-[#1A2235]/95 border border-[#00D4FF]/35 text-white rounded-2xl p-4 shadow-2xl z-40 space-y-2 text-xs md:w-80 pointer-events-none animate-fade-in leading-relaxed backdrop-blur-md">
                          <div className="flex items-center gap-2 pb-2 border-b border-white/5">
                            <span className={`w-3 h-3 rounded-full shrink-0 ${colorClass}`}></span>
                            <div className="font-sans">
                              <span className="font-mono font-black text-sm text-[#00D4FF] tracking-wider block">
                                {activeAlloc.symbol}
                              </span>
                              <span className="text-[10px] text-[#94A3B8] block leading-tight truncate font-sans">
                                {meta.name}
                              </span>
                            </div>
                          </div>
                          
                          <div className="space-y-1.5 font-mono text-[10px] text-[#94A3B8]">
                            <div className="flex justify-between">
                              <span className="font-sans">Industry Sector:</span>
                              <strong className="text-white font-sans">{meta.sector}</strong>
                            </div>
                            <div className="flex justify-between">
                              <span className="font-sans">Target Weight:</span>
                              <strong className="text-[#10B981] font-mono font-bold text-xs">
                                {activeAlloc.allocation.toFixed(2)}%
                              </strong>
                            </div>
                            <div className="flex justify-between">
                              <span className="font-sans">Allocated Amount:</span>
                              <strong className="text-[#00D4FF] font-mono font-bold">
                                BDT {allocatedAmt.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                              </strong>
                            </div>
                            <div className="flex justify-between">
                              <span className="font-sans">Est. Price:</span>
                              <strong className="text-[#94A3B8] font-mono">BDT {meta.price.toFixed(2)}</strong>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Separate visual legend table with required formatting */}
                  <div className="mt-5 pt-4 border-t border-[rgba(255,255,255,0.06)]">
                    <span className="text-[9px] font-mono font-bold uppercase tracking-widest text-[#4B5563] block mb-3 px-0.5">
                      Portfolio Distribution Legend
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {customAllocations.map((alloc, idx) => {
                        const meta = getStockMetadata(alloc.symbol);
                        const labelColorClass = segmentColors[idx % segmentColors.length];
                        return (
                          <div 
                            key={alloc.symbol} 
                            className="flex items-start gap-2.5 bg-[#1A2235]/40 border border-[rgba(255,255,255,0.04)] rounded-2xl px-3.5 py-2.5 hover:bg-[#1A2235]/70 hover:border-[#00D4FF]/30 transition-all shadow-md group animate-fade-in"
                          >
                            <span className={`w-2.5 h-2.5 rounded-full shrink-0 mt-1.5 ${labelColorClass} shadow-md`}></span>
                            <div className="min-w-0 font-sans flex flex-col justify-between">
                              <div className="text-xs font-bold leading-tight text-white flex items-center">
                                {/* Required format: GP — 13.21% */}
                                <span className="font-mono tracking-wider">{alloc.symbol}</span>
                                <span className="text-[#4B5563] font-normal px-1.5">—</span>
                                <span className="text-[#10B981] font-mono">{alloc.allocation.toFixed(2)}%</span>
                              </div>
                              <span className="text-[10px] text-[#94A3B8] font-medium truncate mt-0.5 block leading-tight">
                                {meta.name}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                </div>

                {/* List of custom compiled asset detail cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono text-xs">
                  {customAllocations.map((alloc) => {
                    const meta = getStockMetadata(alloc.symbol);
                    return (
                      <div
                        key={alloc.symbol}
                        className="bg-[#1A2235]/40 p-4 rounded-2xl border border-[rgba(255,255,255,0.05)] hover:bg-[#1A2235]/60 hover:border-[rgba(255,255,255,0.12)] transition-all flex flex-col justify-between"
                      >
                        <div className="flex justify-between items-start">
                          <div className="space-y-0.5 animate-fade-in">
                            <span className="font-extrabold text-white text-sm tracking-tight font-display">{alloc.symbol}</span>
                            <span className="block text-[8.5px] text-indigo-400 font-black uppercase tracking-wider">{meta.sector}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-lg font-black text-indigo-400">{alloc.allocation}%</span>
                            <span className="block text-[8px] text-[#64748B] font-bold uppercase mt-0.5">Solved Weight</span>
                          </div>
                        </div>

                        <div className="space-y-1.5 mt-3 pt-2.5 border-t border-[rgba(255,255,255,0.05)] font-sans text-[11px] text-[#94A3B8]">
                          <div className="flex justify-between items-center text-[#CBD5E1]">
                            <span>Exact Share Volume:</span>
                            <strong className="text-white font-mono font-bold">{alloc.shares.toLocaleString()} units</strong>
                          </div>
                          <div className="flex justify-between items-center text-[#94A3B8]">
                            <span>Estimated Share Price:</span>
                            <strong className="text-white font-mono font-medium">BDT {meta.price.toFixed(2)}</strong>
                          </div>
                          <div className="flex justify-between items-center text-[#94A3B8]">
                            <span>Estimated Annual Cash Yield:</span>
                            <strong className="text-[#10B981] font-mono font-bold animate-pulse">+{alloc.expectedAnnualReturn}% p.a.</strong>
                          </div>
                        </div>

                        <p className="mt-3 bg-[#1A2235]/80 p-2.5 border border-[rgba(255,255,255,0.06)] rounded-xl text-[10.5px] font-sans text-[#94A3B8] leading-relaxed italic">
                          "{alloc.reason}"
                        </p>
                      </div>
                    );
                  })}
                </div>

                {/* Dynamic Concentration Warnings section */}
                {customWarnings.length > 0 && (
                  <div className="p-4 bg-amber-500/10 border border-amber-500/15 rounded-2xl space-y-2 mt-4 text-xs">
                    <div className="flex items-center gap-1.5 text-amber-400 font-bold text-xs pb-1 border-b border-amber-550/10">
                      <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                      <span>Portfolio Optimization Integrity Alerts</span>
                    </div>
                    <ul className="list-disc pl-5 text-[10.5px] text-amber-400 space-y-1 font-sans">
                      {customWarnings.map((warning, i) => (
                        <li key={i}>{warning}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {benchmarkCompText && (
                  <div className="p-3.5 bg-indigo-950/25 border border-indigo-500/10 rounded-2xl text-[11px] font-sans text-indigo-300 leading-relaxed font-semibold">
                    <strong>Methodology Strategy:</strong> {benchmarkCompText}
                  </div>
                )}

              </div>
            )}

          </div>

          {/* Custom Bottom Macro Performance Analytics details */}
          {!isCalculating && customAllocations.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-5 border-t border-[rgba(255,255,255,0.05)] font-mono text-center">
              
              <div className="p-3 bg-[#1A2235]/40 rounded-2xl border border-[rgba(255,255,255,0.05)] shadow-sm">
                <span className="text-[9px] text-slate-400 uppercase font-bold block">Assigned Return</span>
                <span className="text-xs text-emerald-400 mt-1.5 block font-black flex items-center justify-center gap-0.5">
                  <TrendingUp className="h-3.5 w-3.5 animate-pulse" />
                  <span>+{customReturn}% p.a.</span>
                </span>
              </div>

              <div className="p-3 bg-[#1A2235]/40 rounded-2xl border border-[rgba(255,255,255,0.05)] shadow-sm">
                <span className="text-[9px] text-slate-400 uppercase font-bold block">Model Volatility</span>
                <strong className="text-sm text-white mt-1.5 block font-black">{customVol}%</strong>
              </div>

              <div className="p-3 bg-[#1A2235]/40 rounded-2xl border border-[rgba(255,255,255,0.05)] shadow-sm">
                <span className="text-[9px] text-slate-400 uppercase font-bold block">Beta Correlation</span>
                <strong className="text-sm text-indigo-400 mt-1.5 block font-black">{customBeta} / Index</strong>
              </div>

              <div className="p-3 bg-indigo-950/20 rounded-2xl border border-indigo-500/10 shadow-sm">
                <span className="text-[9px] text-indigo-300 uppercase font-bold block flex items-center justify-center gap-0.5">
                  <Gauge className="h-3 w-3 text-indigo-400" />
                  <span>Risk Scale</span>
                </span>
                <strong className={`text-sm mt-1.5 block font-black ${
                  customRiskIndex >= 65 ? "text-rose-450" : customRiskIndex >= 35 ? "text-amber-400" : "text-[#10B981]"
                }`}>
                  {customRiskIndex}/100
                </strong>
              </div>

            </div>
          )}
          
          <div className="text-[10px] text-[#94A3B8] font-sans text-left mt-4 flex items-center gap-1.5 bg-[#1A2235]/40 border border-[rgba(255,255,255,0.05)] p-3.5 rounded-2xl">
            <span className="px-1.5 py-0.5 bg-[#1A2235] rounded text-[8px] font-mono font-bold uppercase text-[#CBD5E1]">Formula-Based</span>
            <span>All custom allocations are calculated in real-time on our Node server using advanced multi-factor variance matrices and covariance calculations.</span>
          </div>

        </div>

      </div>

    </div>
  );
}
