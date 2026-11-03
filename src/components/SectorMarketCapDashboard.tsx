import React, { useState, useEffect, useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell
} from "recharts";
import { Layers, Database } from "lucide-react";
import { formatMarketCap } from "../utils/formatters";

export default function SectorMarketCapDashboard() {
  const [data, setData] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    fetch("/api/stocks/sectors/dse-market-cap")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch custom DSE sector market cap stats.");
        return res.json();
      })
      .then((json) => {
        if (isMounted) {
          setData(json);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err.message || "Failed to load sector capitalization.");
          setLoading(false);
        }
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const chartData = useMemo(() => {
    return Object.entries(data)
      .map(([sector, cap]) => ({
        name: sector,
        value: Number(cap),
      }))
      .sort((a, b) => b.value - a.value);
  }, [data]);

  const totalCap = useMemo(() => {
    return chartData.reduce((acc, curr) => acc + curr.value, 0);
  }, [chartData]);

  if (loading) {
    return (
      <div className="bg-[#111827] border border-[rgba(255,255,255,0.06)] rounded-3xl p-6 shadow-2xl relative overflow-hidden flex flex-col items-center justify-center min-h-[350px]">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-[#00D4FF] border-r-2" />
        <p className="text-xs text-[#94A3B8] font-mono mt-4">Analyzing corporate capitalization matrices...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-[#111827] border border-[rgba(255,255,255,0.06)] rounded-3xl p-6 shadow-2xl relative overflow-hidden flex flex-col items-center justify-center min-h-[350px]">
        <Database className="h-8 w-8 text-[#EF4444] mb-2" />
        <p className="text-xs text-[#EF4444] font-mono">{error}</p>
      </div>
    );
  }

  return (
    <div className="bg-[#111827] border border-[rgba(255,255,255,0.06)] rounded-3xl p-8 shadow-2xl relative overflow-hidden flex flex-col gap-6" id="sector-market-cap-dashboard">
      {/* Dynamic Glowing Accents */}
      <div className="absolute top-0 right-6 w-48 h-48 bg-[#00D4FF]/5 rounded-full blur-3xl pointer-events-none -z-10"></div>
      <div className="absolute bottom-0 left-6 w-48 h-48 bg-indigo-500/3 rounded-full blur-3xl pointer-events-none -z-10"></div>
      
      {/* Enhanced Header with descriptive distribution explanation */}
      <div className="border-b border-[rgba(255,255,255,0.06)] pb-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="space-y-1.5 max-w-2xl">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-[#00D4FF]/10 rounded-xl border border-[#00D4FF]/20">
                <Layers className="h-5 w-5 text-[#00D4FF]" />
              </div>
              <div>
                <span className="text-[10px] font-mono text-[#00D4FF] tracking-widest uppercase font-bold">Market Intelligence</span>
                <h3 className="font-display text-base font-extrabold text-white uppercase tracking-wider mt-0.5">
                  💼 Sectoral Market Capitalization Weights
                </h3>
              </div>
            </div>
            <p className="text-xs text-[#94A3B8] leading-relaxed font-sans pt-1">
              Analyzing the cumulative market valuation distribution across key industries listed on the Dhaka Stock Exchange (DSE). This structural map highlights the dominant growth drivers, sectorial concentration risks, and financial weights helping analysts detect macro level liquidity pools.
            </p>
          </div>
          
          <div className="flex-shrink-0 bg-[#1A2235]/65 border border-[rgba(255,255,255,0.05)] px-5 py-3 rounded-2xl shadow-inner flex flex-col justify-center min-w-[200px]">
            <span className="text-[9px] font-mono text-[#94A3B8] uppercase block tracking-wider mb-1 font-bold">Aggregated System Capitalization</span>
            <span className="text-lg font-mono font-black text-[#00D4FF] leading-none">{formatMarketCap(totalCap)}</span>
          </div>
        </div>
      </div>

      {chartData.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Horizontal Bar Chart */}
          <div className="lg:col-span-8 h-[480px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                layout="vertical"
                margin={{ top: 10, right: 30, left: 10, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                <XAxis
                  type="number"
                  stroke="#4B5563"
                  fontSize={10}
                  fontFamily="monospace"
                  tickLine={false}
                  tickFormatter={(val) => {
                    if (val >= 1e12) return `${(val / 1e12).toFixed(1)}T`;
                    if (val >= 1e9) return `${(val / 1e9).toFixed(0)}B`;
                    if (val >= 1e6) return `${(val / 1e6).toFixed(0)}M`;
                    return val.toLocaleString();
                  }}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  stroke="#94A3B8"
                  fontSize={9.5}
                  fontFamily="sans-serif"
                  tickLine={false}
                  width={150}
                />
                <Tooltip
                  contentStyle={{
                    background: "#111827",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: "16px",
                    outline: "none"
                  }}
                  labelStyle={{ color: "#94A3B8", fontFamily: "monospace", fontSize: 11, fontWeight: "bold" }}
                  itemStyle={{ fontFamily: "monospace", fontSize: 11 }}
                  formatter={(val: any) => [formatMarketCap(val), "Market Cap"]}
                />
                <Bar dataKey="value" fill="#00D4FF" radius={[0, 4, 4, 0]}>
                  {chartData.map((entry, index) => {
                    const opacities = [0.95, 0.85, 0.75, 0.65, 0.55];
                    const opacity = opacities[index % opacities.length];
                    return (
                      <Cell
                        key={`cell-${index}`}
                        fill="#00D4FF"
                        fillOpacity={opacity}
                      />
                    );
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Quick Metrics Breakdown list */}
          <div className="lg:col-span-4 flex flex-col gap-3 max-h-[480px] overflow-y-auto pr-2 custom-scrollbar">
            <span className="text-[10px] font-mono text-[#94A3B8] uppercase tracking-wider px-1">Top Sectors by Asset Weight</span>
            {chartData.map((sec, idx) => {
              const pct = totalCap > 0 ? (sec.value / totalCap) * 100 : 0;
              return (
                <div key={sec.name} className="flex justify-between items-center bg-[#1A2235]/40 border border-[rgba(255,255,255,0.03)] rounded-xl px-3 py-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[10px] font-mono text-indigo-400 font-bold">#{idx + 1}</span>
                    <span className="text-xs font-sans text-white/90 truncate font-medium" title={sec.name}>{sec.name}</span>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span className="text-xs font-mono font-bold block text-white">{pct.toFixed(1)}%</span>
                    <span className="text-[9px] font-mono text-[#94A3B8] block">{formatMarketCap(sec.value)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="text-center py-6 text-xs text-[#94A3B8]">No corporate models mapped.</div>
      )}
    </div>
  );
}
