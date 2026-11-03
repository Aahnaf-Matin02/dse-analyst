import React, { useState, useEffect } from "react";
import { SectorExposureResult, Holding } from "../../types";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { PieChart as PieIcon, ShieldAlert, CheckCircle, RefreshCw, AlertTriangle } from "lucide-react";

interface Props {
  holdings: Holding[];
}

const COLORS = ["#0ea5e9", "#10b981", "#8b5cf6", "#f59e0b", "#ec4899", "#3b82f6", "#14b8a6", "#22c55e", "#f43f5e", "#a855f7"];

export const SectorExposureDashboard: React.FC<Props> = ({ holdings }) => {
  const [data, setData] = useState<SectorExposureResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const calculateExposure = async () => {
    try {
      setLoading(true);
      setError(null);

      // Map simple holdings representation for the service body
      const mappedHoldings = holdings.map(h => ({
        symbol: h.symbol,
        quantity: h.quantity,
        buyPrice: h.buyPrice
      }));

      const res = await fetch("/api/portfolio/sector-exposure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ holdings: mappedHoldings })
      });

      if (!res.ok) {
        throw new Error("Failed to compute sector exposure model.");
      }

      const json = await res.json();
      setData(json);
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    calculateExposure();
  }, [holdings]);

  if (loading) {
    return (
      <div className="bg-slate-900 border border-slate-805 p-6 rounded-xl flex flex-col items-center justify-center min-h-[220px]">
        <RefreshCw className="animate-spin text-sky-500 h-8 w-8 mb-2" />
        <span className="text-slate-400 font-mono text-sm">Aggregating sector exposures & DSEX weights...</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-slate-900 border border-slate-805 p-6 rounded-xl text-center">
        <span className="text-red-400 font-mono text-sm">Failed to generate sector exposure profile</span>
      </div>
    );
  }

  // Prep data for Recharts Pie
  const pieData = data.sectors.map(s => ({
    name: s.name,
    value: s.weight
  }));

  // Define grade colors
  const gradeStyles: Record<string, { badge: string; text: string }> = {
    "A": { badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20", text: "text-emerald-400" },
    "B": { badge: "bg-teal-500/10 text-teal-400 border-teal-500/20", text: "text-teal-400" },
    "C": { badge: "bg-amber-500/10 text-amber-400 border-amber-500/20", text: "text-amber-400" },
    "D": { badge: "bg-orange-500/10 text-orange-400 border-orange-500/20", text: "text-orange-400" },
    "F": { badge: "bg-rose-500/10 text-rose-400 border-rose-500/20", text: "text-rose-455" }
  };

  const activeGrade = gradeStyles[data.diversificationGrade] || gradeStyles["C"];

  return (
    <div id="sector-exposure-module" className="bg-slate-900/40 border border-slate-800 p-6 rounded-xl space-y-6">
      
      {/* Title */}
      <div className="flex justify-between items-start">
        <div>
          <h4 className="font-sans font-medium text-slate-100 flex items-center gap-2">
            <PieIcon className="h-4 w-4 text-sky-400" />
            Sector Exposure & Diversification
          </h4>
          <p className="text-xs text-slate-400 mt-1">
            Comparing portfolio weights against official DSEX benchmarks to diagnose overweight concentrations and blind spots
          </p>
        </div>
        <button 
          onClick={calculateExposure}
          className="p-1 hover:bg-slate-800 rounded transition text-slate-400 hover:text-slate-200"
          title="Recalculate allocations"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Aggregate Score Panel */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        
        <div className="p-4 border border-slate-800 rounded-lg bg-slate-950/20 flex flex-col justify-between">
          <span className="text-[10px] font-mono text-slate-500 tracking-wider">DIVERSIFICATION SCORE</span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-3xl font-extrabold font-mono tracking-tight text-slate-100">
              {data.concentrationScore}
            </span>
            <span className="text-xs text-slate-500 font-mono">/ 100</span>
          </div>
          <span className="text-xs text-slate-400 block mt-1 leading-tight">
            Herfindahl-Hirschman (HHI) concentration evaluation.
          </span>
        </div>

        <div className="p-4 border border-slate-800 rounded-lg bg-slate-950/20 flex flex-col justify-between">
          <span className="text-[10px] font-mono text-slate-500 tracking-wider">DIVERSIFICATION GRADE</span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className={`text-4xl font-black font-sans ${activeGrade.text}`}>
              {data.diversificationGrade}
            </span>
          </div>
          <span className="text-xs text-slate-400 block mt-1 leading-tight">
            Comprehensive portfolio spread safety indicator.
          </span>
        </div>

        <div className="p-4 border border-slate-800 rounded-lg bg-slate-950/20 flex flex-col justify-between">
          <span className="text-[10px] font-mono text-slate-500 tracking-wider">TOP CONCENTRATION</span>
          <span className="block text-sm font-semibold text-slate-200 mt-2 truncate">
            {data.topSector}
          </span>
          <span className="text-xs text-slate-400 block mt-1 leading-tight">
            Sector carrying the largest monetary capital exposure.
          </span>
        </div>

      </div>

      {/* Pie Chart and Comparison layout split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center bg-slate-950/15 p-4 rounded-lg border border-slate-800/40">
        
        {/* Recharts Pie */}
        <div className="col-span-1 lg:col-span-4 flex flex-col items-center justify-center min-h-[200px]">
          {pieData.length === 0 ? (
            <span className="text-xs text-slate-500 font-mono">Empty list - No allocation</span>
          ) : (
            <div className="h-[180px] w-full relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={65}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: "#020617", borderColor: "#1e293b", borderRadius: "6px" }}
                    itemStyle={{ color: "#f8fafc", fontSize: "11px", fontFamily: "monospace" }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-[10px] font-mono text-slate-500 tracking-wider">HOLDINGS</span>
                <span className="text-xs font-bold text-slate-350">{pieData.length} Sectors</span>
              </div>
            </div>
          )}
        </div>

        {/* Legend / Color chips */}
        <div className="col-span-1 lg:col-span-8 grid grid-cols-2 gap-3 text-xs">
          {data.sectors.map((s, idx) => (
            <div key={idx} className="flex items-center justify-between p-2 rounded bg-slate-900/30 border border-slate-850">
              <div className="flex items-center gap-2 truncate">
                <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: COLORS[idx % COLORS.length] }}></span>
                <span className="text-slate-300 font-medium truncate">{s.name}</span>
              </div>
              <span className="font-mono font-semibold text-slate-400 text-[10.5px] ml-2 shrink-0">{s.weight.toFixed(1)}%</span>
            </div>
          ))}
        </div>

      </div>

      {/* Comparison table panel */}
      <div className="space-y-3">
        <span className="text-xs text-slate-400 font-mono block">DSEX WEIGHT BENCHMARK COMPARATOR</span>
        <div className="overflow-x-auto border border-slate-800 rounded-lg">
          <table className="w-full text-xs text-left text-slate-300 border-collapse">
            <thead className="text-[10px] font-mono text-slate-500 uppercase bg-slate-950/60 border-b border-slate-800">
              <tr>
                <th className="p-3">Sector Name</th>
                <th className="p-3">Assets Value (BDT)</th>
                <th className="p-3">Weight (%)</th>
                <th className="p-3">DSEX (%)</th>
                <th className="p-3 text-right">Active Exposure</th>
                <th className="p-3 text-center">Alert rating</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/40 bg-slate-950/10">
              {data.sectors.map((s, idx) => {
                const exposureColor = s.activeExposure > 0 ? "text-emerald-400" : s.activeExposure < 0 ? "text-indigo-400" : "text-slate-400";
                const isOverweight = s.activeExposure >= 5;
                const isUnderweight = s.activeExposure <= -5;

                return (
                  <tr key={idx} className="hover:bg-slate-850/10">
                    <td className="p-3 text-slate-200 font-medium">{s.name}</td>
                    <td className="p-3 font-mono">৳{s.value.toLocaleString()}</td>
                    <td className="p-3 font-mono font-medium">{s.weight.toFixed(1)}%</td>
                    <td className="p-3 font-mono text-slate-500">{s.indexWeight.toFixed(1)}%</td>
                    <td className={`p-3 text-right font-mono font-semibold ${exposureColor}`}>
                      {s.activeExposure > 0 ? `+${s.activeExposure.toFixed(1)}%` : `${s.activeExposure.toFixed(1)}%`}
                    </td>
                    <td className="p-3 text-center">
                      <span className={`inline-block text-[9.5px] font-mono px-2 py-0.5 rounded border ${
                        s.risk === "High" ? "bg-rose-500/10 text-rose-455 border-rose-500/20" :
                        s.risk === "Moderate" ? "bg-amber-500/10 text-amber-400 border-amber-500/20" :
                        "bg-emerald-500/10 text-emerald-400 border-emerald-500/10"
                      }`}>
                        {s.risk.toUpperCase()}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Warnings & Exposure summaries */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {/* Overweight Alert List */}
        <div className="p-4 border border-slate-800 rounded-lg bg-slate-950/15 space-y-3">
          <span className="text-xs font-mono text-slate-400 block flex items-center gap-1.5">
            <ShieldAlert className="h-3.5 w-3.5 text-rose-500" />
            MAJOR CONCENTRATION CHECKS
          </span>
          <div className="space-y-2">
            {data.sectors.filter(s => s.risk !== "Acceptable").map((s, i) => (
              <div key={i} className="bg-rose-950/20 border border-rose-500/15 p-3 rounded text-xs flex gap-3 items-start">
                <AlertTriangle className="h-4 w-4 text-orange-400 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <span className="font-semibold text-slate-200">{s.name} Concentration</span>
                  <p className="text-slate-400 leading-normal text-[11px]">
                    Sector represents <span className="font-semibold text-slate-200">{s.weight.toFixed(1)}%</span> of aggregate capital. System suggests scaling profits into underweight index opportunities.
                  </p>
                </div>
              </div>
            ))}
            {data.sectors.filter(s => s.risk !== "Acceptable").length === 0 && (
              <div className="bg-slate-900/10 border border-slate-800/40 p-3 rounded text-xs text-slate-500 font-mono text-center">
                All single-sector weights satisfy protective threshold constraints.
              </div>
            )}
          </div>
        </div>

        {/* Underweight Blind Spots */}
        <div className="p-4 border border-slate-800 rounded-lg bg-slate-950/15 space-y-3">
          <span className="text-xs font-mono text-slate-400 block flex items-center gap-1.5">
            <CheckCircle className="h-3.5 w-3.5 text-teal-500" />
            CONCENTRATION BLIND SPOT DRILLS
          </span>
          <div className="space-y-2">
            {data.underweightSectors.length > 0 ? (
              <div className="bg-slate-950/40 border border-slate-850 p-3 rounded text-xs flex gap-3 items-start">
                <ShieldAlert className="h-4 w-4 text-indigo-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="font-semibold text-slate-200">Index Blind Spots Identified</span>
                  <p className="text-slate-450 leading-normal text-[11px]">
                    Your portfolio holds zero or heavily underweight exposures in these major DSEX sectors (&gt;4% baseline weight):
                  </p>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {data.underweightSectors.map((sect, idx) => (
                      <span key={idx} className="text-[9.5px] font-mono bg-slate-800 text-slate-300 px-2 py-0.5 rounded border border-slate-700/50">
                        {sect}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-slate-900/10 border border-slate-800/40 p-3 rounded text-xs text-slate-500 font-mono text-center">
                High exposure matrix tracking. No institutional blind spots found.
              </div>
            )}
          </div>
        </div>

      </div>

    </div>
  );
};
