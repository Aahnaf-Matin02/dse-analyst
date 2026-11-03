import React, { useEffect, useMemo, useState } from "react";
import { StockData } from "../types";
import {
  Activity, ArrowDownRight, ArrowUpRight, BarChart3, Database, Gauge, Info, Layers, LineChart as LineIcon,
  Scale, ShieldCheck, TrendingDown, TrendingUp, Waves,
} from "lucide-react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine, BarChart, Bar, Cell } from "recharts";
import { Term } from "./ui/Term";
import { SkeletonCard, ErrorState } from "./ui/StatusPrimitives";

/** Shape of GET /api/stocks/:symbol/analytics (server/services/history/stockAnalytics.ts). */
interface Analytics {
  symbol: string;
  asOf: string | null;
  history: { source: string; firstDate: string; lastDate: string; sessions: number } | null;
  lastClose: number | null;
  returns: { key: string; label: string; from: string; to: string; pct: number; dsexPct: number | null }[];
  relative: { date: string; stock: number; dsex: number | null }[];
  range52w: { high: number; highDate: string; low: number; lowDate: string; positionPct: number; fromHighPct: number; fromLowPct: number } | null;
  risk: { volatilityPct: number | null; volatilityPercentile: number | null; maxDrawdownPct: number | null; drawdownPeak: string | null; drawdownTrough: string | null; beta: number | null; correlation: number | null; window: string | null };
  trend: { sma50: number | null; sma200: number | null; vsSma50Pct: number | null; vsSma200Pct: number | null };
  liquidity: { avgVolume20: number | null; avgValue20Bdt: number | null; tradedSessionsPct: number | null; tradedSessions: number | null; marketSessions: number | null; liquidityPercentile: number | null };
  marketRank: { return1yPercentile: number | null; universe: number };
  valuation: { official: boolean; ratioDate: string | null; sourceUrl: string | null; eps: number | null; nav: number | null; pe: number | null; pb: number | null; earningsYieldPct: number | null; dividendYieldPct: number | null };
  sector: { name: string | null; peers: number; peersWithOfficialRatios: number; medianPe: number | null; medianPb: number | null; medianDividendYield: number | null; medianReturn1y: number | null; pePercentile: number | null; return1yPercentile: number | null };
  earnings: { fiscalYear: number; eps: number | null; netProfit: number | null }[];
  flaggedMoves: { from: string; to: string; changePct: number }[];
  notes: string[];
}

// ── formatting ────────────────────────────────────────────────────────────────────────────────────
const fmtDate = (d: string | null | undefined) => {
  if (!d) return "—";
  const [y, m, day] = d.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, day)).toLocaleDateString("en-GB", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" });
};
const pct = (v: number | null | undefined, digits = 1) => (v === null || v === undefined ? "—" : `${v > 0 ? "+" : ""}${v.toFixed(digits)}%`);
const num = (v: number | null | undefined, digits = 2) => (v === null || v === undefined ? "—" : v.toLocaleString("en-US", { maximumFractionDigits: digits, minimumFractionDigits: digits }));
const compactBdt = (v: number | null | undefined) => {
  if (v === null || v === undefined) return "—";
  if (v >= 1e7) return `BDT ${(v / 1e7).toFixed(2)} cr`;
  if (v >= 1e5) return `BDT ${(v / 1e5).toFixed(2)} lakh`;
  return `BDT ${Math.round(v).toLocaleString("en-US")}`;
};
const ordinal = (n: number) => { const t = n % 100, u = n % 10; return `${n}${t >= 11 && t <= 13 ? "th" : u === 1 ? "st" : u === 2 ? "nd" : u === 3 ? "rd" : "th"}`; };
const tone = (v: number | null | undefined) => (v === null || v === undefined ? "text-[var(--text-subtle)]" : v > 0 ? "text-[var(--up)]" : v < 0 ? "text-[var(--down)]" : "text-[var(--text)]");

// ── small building blocks ─────────────────────────────────────────────────────────────────────────
function Card({ title, icon: Icon, children, className = "", aside }: { title: string; icon: React.ComponentType<any>; children: React.ReactNode; className?: string; aside?: React.ReactNode }) {
  return (
    <section className={`relative overflow-hidden rounded-3xl border border-[var(--border)] bg-gradient-to-b from-[#121b2e] to-[var(--surface)] p-5 shadow-xl card-lift ${className}`}>
      <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-[var(--accent)]/[0.06] blur-3xl" aria-hidden="true" />
      <header className="mb-4 flex items-start justify-between gap-3">
        <h3 className="flex items-center gap-2 text-sm font-bold tracking-wide text-[var(--text)]">
          <span className="grid h-7 w-7 place-items-center rounded-xl bg-[var(--accent)]/10 text-[var(--accent)]"><Icon className="h-4 w-4" aria-hidden="true" /></span>
          {title}
        </h3>
        {aside}
      </header>
      {children}
    </section>
  );
}

function Stat({ label, value, sub, valueClass = "text-[var(--text)]" }: { label: React.ReactNode; value: React.ReactNode; sub?: React.ReactNode; valueClass?: string }) {
  return (
    <div className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-3">
      <div className="text-[11px] font-medium text-[var(--text-subtle)]">{label}</div>
      <div className={`mt-1 font-mono text-lg font-bold tabular-nums ${valueClass}`}>{value}</div>
      {sub && <div className="mt-0.5 text-[11px] leading-snug text-[var(--text-subtle)]">{sub}</div>}
    </div>
  );
}

/** 0–100 meter with an animated fill. */
function Meter({ value, colorClass, label }: { value: number | null; colorClass: string; label: string }) {
  const [w, setW] = useState(0);
  useEffect(() => { const t = requestAnimationFrame(() => setW(value ?? 0)); return () => cancelAnimationFrame(t); }, [value]);
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-white/[0.06]" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={value ?? undefined} aria-label={label}>
      <div className={`h-full rounded-full ${colorClass} transition-[width] duration-700 ease-out`} style={{ width: `${Math.max(0, Math.min(100, w))}%` }} />
    </div>
  );
}

function SourceLine({ children }: { children: React.ReactNode }) {
  return <p className="mt-4 flex items-start gap-1.5 text-[11px] leading-snug text-[var(--text-subtle)]"><Database className="mt-[1px] h-3 w-3 shrink-0" aria-hidden="true" /><span>{children}</span></p>;
}

function Unavailable({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl border border-dashed border-white/10 px-4 py-6 text-center text-xs leading-relaxed text-[var(--text-subtle)]">{children}</div>;
}

// ── main component ────────────────────────────────────────────────────────────────────────────────
export default function StockOverview({ stock }: { stock: StockData }) {
  const [data, setData] = useState<Analytics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [period, setPeriod] = useState("1Y");

  useEffect(() => {
    let cancelled = false;
    setData(null); setError(null);
    fetch(`/api/stocks/${encodeURIComponent(stock.symbol)}/analytics`)
      .then(r => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then(d => { if (!cancelled) setData(d); })
      .catch(e => { if (!cancelled) setError(e.message || "Request failed"); });
    return () => { cancelled = true; };
  }, [stock.symbol, reload]);

  const selected = data?.returns.find(r => r.key === period) ?? data?.returns.find(r => r.key === "1Y") ?? data?.returns[data.returns.length - 1];
  const chartData = useMemo(() => {
    if (!data?.relative.length) return [];
    if (!selected) return data.relative;
    // Rebase the window that matches the selected period (the series covers at most one year)
    const win = data.relative.filter(p => p.date >= selected.from);
    const base = win[0];
    if (!base) return data.relative;
    return win.map(p => ({
      date: p.date,
      stock: Math.round((p.stock / base.stock) * 10000) / 100,
      dsex: p.dsex !== null && base.dsex !== null ? Math.round((p.dsex / base.dsex) * 10000) / 100 : null,
    }));
  }, [data, selected]);

  if (error) return <ErrorState title="Analytics could not be loaded" message={error} onRetry={() => setReload(n => n + 1)} />;
  if (!data) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3" aria-busy="true">
        <SkeletonCard lines={4} label="Loading performance" className="lg:col-span-2" />
        <SkeletonCard lines={4} label="Loading range" />
        <SkeletonCard lines={3} label="Loading risk" />
        <SkeletonCard lines={3} label="Loading valuation" />
        <SkeletonCard lines={3} label="Loading liquidity" />
      </div>
    );
  }

  if (!data.history) {
    return (
      <Unavailable>
        DSE's official day-end archive has no trades for {stock.symbol} in the stored history, so returns, risk and trend cannot be calculated.
        {data.liquidity.marketSessions ? ` It did not trade in any of the last ${data.liquidity.marketSessions} DSE sessions.` : ""}
      </Unavailable>
    );
  }

  const r1y = data.returns.find(r => r.key === "1Y");
  const v = data.valuation, s = data.sector, rk = data.risk, lq = data.liquidity, tr = data.trend, rg = data.range52w;
  const outperf = selected && selected.dsexPct !== null ? Math.round((selected.pct - selected.dsexPct) * 10) / 10 : null;
  const maxAbsReturn = Math.max(1, ...data.returns.flatMap(r => [Math.abs(r.pct), Math.abs(r.dsexPct ?? 0)]));

  return (
    <div className="space-y-4 animate-tab-in text-[var(--text)]">
      {/* ── Snapshot strip ─────────────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 text-[11px] text-[var(--text-subtle)]">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--accent)]/25 bg-[var(--accent)]/10 px-2.5 py-1 font-semibold text-[var(--accent)]">
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" /> DSE official day-end data
        </span>
        <span>Close of {fmtDate(data.asOf)} · {data.history.sessions} sessions since {fmtDate(data.history.firstDate)} · prices not adjusted for dividends or bonus issues</span>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-3xl border border-[var(--border)] bg-gradient-to-br from-[#0f2a3a] to-[var(--surface)] p-4 card-lift">
          <div className="text-[11px] font-medium text-[var(--text-subtle)]">1-year return</div>
          <div className={`mt-1 flex items-center gap-1 font-mono text-2xl font-black tabular-nums ${tone(r1y?.pct)}`}>
            {r1y && (r1y.pct >= 0 ? <ArrowUpRight className="h-5 w-5" aria-hidden="true" /> : <ArrowDownRight className="h-5 w-5" aria-hidden="true" />)}
            {pct(r1y?.pct)}
          </div>
          <div className="mt-1 text-[11px] text-[var(--text-subtle)]">DSEX {pct(r1y?.dsexPct)}{data.marketRank.return1yPercentile !== null && <> · beat {data.marketRank.return1yPercentile}% of DSE stocks</>}</div>
        </div>
        <div className="rounded-3xl border border-[var(--border)] bg-gradient-to-br from-[#1d1838] to-[var(--surface)] p-4 card-lift">
          <div className="text-[11px] font-medium text-[var(--text-subtle)]"><Term term="Volatility" definition="How much the price swings day to day, scaled to a year (standard deviation of daily returns × √240). Higher means bumpier.">Volatility</Term> (1Y)</div>
          <div className="mt-1 font-mono text-2xl font-black tabular-nums">{rk.volatilityPct !== null ? `${rk.volatilityPct.toFixed(1)}%` : "—"}</div>
          <div className="mt-1 text-[11px] text-[var(--text-subtle)]">{rk.volatilityPercentile !== null ? `Calmer than ${100 - rk.volatilityPercentile}% of DSE stocks` : "Not enough sessions"}</div>
        </div>
        <div className="rounded-3xl border border-[var(--border)] bg-gradient-to-br from-[#10291f] to-[var(--surface)] p-4 card-lift">
          <div className="text-[11px] font-medium text-[var(--text-subtle)]"><Term term="P/E">P/E</Term> at last close</div>
          <div className="mt-1 font-mono text-2xl font-black tabular-nums">{v.pe !== null ? `${v.pe.toFixed(1)}×` : "—"}</div>
          <div className="mt-1 text-[11px] text-[var(--text-subtle)]">{v.pe === null ? (v.official ? "EPS not reported" : "Awaiting DSE EPS") : s.medianPe !== null ? `Sector median ${s.medianPe.toFixed(1)}×` : "No sector median (too few peers)"}</div>
        </div>
        <div className="rounded-3xl border border-[var(--border)] bg-gradient-to-br from-[#2a2010] to-[var(--surface)] p-4 card-lift">
          <div className="text-[11px] font-medium text-[var(--text-subtle)]">Within 52-week range</div>
          <div className="mt-1 font-mono text-2xl font-black tabular-nums">{rg ? `${Math.round(rg.positionPct)}%` : "—"}</div>
          <div className="mt-1 text-[11px] text-[var(--text-subtle)]">{rg ? `${pct(rg.fromHighPct)} from high` : "Less than a year of data"}</div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* ── Performance vs DSEX ──────────────────────────────────────────────────────────── */}
        <Card title="Performance vs DSEX" icon={LineIcon} className="lg:col-span-2"
          aside={
            <div className="flex flex-wrap justify-end gap-1" role="tablist" aria-label="Return period">
              {data.returns.filter(r => r.key !== "MAX").map(r => (
                <button key={r.key} type="button" role="tab" aria-selected={period === r.key} onClick={() => setPeriod(r.key)}
                  className={`rounded-lg px-2.5 py-1 font-mono text-[11px] font-bold transition-colors cursor-pointer ${period === r.key ? "bg-[var(--accent)] text-[#04131c]" : "bg-white/[0.04] text-[var(--text-subtle)] hover:bg-white/[0.08] hover:text-[var(--text)]"}`}>
                  {r.key}
                </button>
              ))}
            </div>
          }>
          {selected && (
            <p className="mb-3 text-sm leading-relaxed text-[var(--text-muted)]">
              {stock.symbol} <strong className={tone(selected.pct)}>{pct(selected.pct)}</strong> over {selected.label.toLowerCase()} ({fmtDate(selected.from)} – {fmtDate(selected.to)})
              {selected.dsexPct !== null && <> vs DSEX <strong className={tone(selected.dsexPct)}>{pct(selected.dsexPct)}</strong>: {outperf !== null && outperf >= 0 ? "ahead of" : "behind"} the market by <strong className="text-[var(--text)]">{Math.abs(outperf ?? 0).toFixed(1)} points</strong>.</>}
            </p>
          )}
          {chartData.length > 1 ? (
            <div className="h-56 w-full" aria-label={`${stock.symbol} and DSEX rebased to 100`} role="img">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
                  <defs>
                    <linearGradient id="perfStock" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#00D4FF" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#00D4FF" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
                  <XAxis dataKey="date" tickFormatter={d => fmtDate(d).replace(/ \d{4}$/, "")} stroke="#64748B" fontSize={10} tickLine={false} axisLine={false} minTickGap={40} />
                  <YAxis stroke="#64748B" fontSize={10} tickLine={false} axisLine={false} domain={["auto", "auto"]} width={44} />
                  <ReferenceLine y={100} stroke="rgba(255,255,255,0.18)" strokeDasharray="4 4" />
                  <Tooltip
                    contentStyle={{ background: "#0f1729", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, fontSize: 12 }}
                    labelFormatter={d => fmtDate(String(d))}
                    formatter={(val: any, name: any) => [`${Number(val).toFixed(1)}`, name === "stock" ? stock.symbol : "DSEX"]}
                  />
                  <Area type="monotone" dataKey="dsex" stroke="#A78BFA" strokeWidth={1.6} fill="none" dot={false} connectNulls isAnimationActive animationDuration={700} />
                  <Area type="monotone" dataKey="stock" stroke="#00D4FF" strokeWidth={2.2} fill="url(#perfStock)" dot={false} isAnimationActive animationDuration={700} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : <Unavailable>Not enough sessions to chart this period.</Unavailable>}
          <div className="mt-2 flex items-center gap-4 text-[11px] text-[var(--text-subtle)]">
            <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-4 rounded bg-[#00D4FF]" />{stock.symbol}</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-4 rounded bg-[#A78BFA]" />DSEX</span>
            <span>Both start at 100</span>
          </div>

          {/* Return ladder */}
          <div className="mt-5 space-y-2">
            {data.returns.map(r => (
              <div key={r.key} className="grid grid-cols-[3rem_1fr_4.25rem_4.75rem] items-center gap-3 text-xs">
                <span className="font-mono font-bold text-[var(--text-subtle)]">{r.key}</span>
                <div className="space-y-1">
                  <div className="h-2 rounded-full bg-white/[0.04]"><div className={`h-2 rounded-full ${r.pct >= 0 ? "bg-gradient-to-r from-emerald-500/60 to-emerald-400" : "bg-gradient-to-r from-rose-500/60 to-rose-400"} transition-[width] duration-700`} style={{ width: `${(Math.abs(r.pct) / maxAbsReturn) * 100}%` }} /></div>
                  {r.dsexPct !== null && <div className="h-1 rounded-full bg-white/[0.03]"><div className="h-1 rounded-full bg-violet-400/60" style={{ width: `${(Math.abs(r.dsexPct) / maxAbsReturn) * 100}%` }} /></div>}
                </div>
                <span className={`text-right font-mono font-bold tabular-nums ${tone(r.pct)}`}>{pct(r.pct)}</span>
                <span className="text-right font-mono tabular-nums text-violet-300/80" title="DSEX over the same dates">{r.dsexPct !== null ? `DSEX ${pct(r.dsexPct)}` : ""}</span>
              </div>
            ))}
          </div>
          <SourceLine>Close-to-close returns from DSE's day-end archive; DSEX from DSE's market summary. MAX = since {fmtDate(data.history.firstDate)}, the start of the stored archive.</SourceLine>
        </Card>

        {/* ── 52-week range & trend ────────────────────────────────────────────────────────── */}
        <Card title="52-week range & trend" icon={Activity}>
          {rg && data.lastClose !== null ? (
            <>
              <div className="flex items-end justify-between text-xs">
                <div><div className="text-[var(--text-subtle)]">Low</div><div className="font-mono text-base font-bold">{num(rg.low)}</div><div className="text-[10px] text-[var(--text-subtle)]">{fmtDate(rg.lowDate)}</div></div>
                <div className="text-right"><div className="text-[var(--text-subtle)]">High</div><div className="font-mono text-base font-bold">{num(rg.high)}</div><div className="text-[10px] text-[var(--text-subtle)]">{fmtDate(rg.highDate)}</div></div>
              </div>
              <div className="relative mt-3 h-3 rounded-full bg-gradient-to-r from-rose-500/50 via-amber-400/50 to-emerald-400/60">
                <div className="absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-[var(--accent)] shadow-[0_0_14px_rgba(0,212,255,0.7)] transition-[left] duration-700"
                  style={{ left: `${Math.max(0, Math.min(100, rg.positionPct))}%` }} aria-label={`Last close ${num(data.lastClose)} at ${Math.round(rg.positionPct)}% of the 52-week range`} role="img" />
              </div>
              <p className="mt-3 text-center text-xs text-[var(--text-muted)]">Last close <strong className="font-mono text-[var(--text)]">{num(data.lastClose)}</strong> · {pct(rg.fromLowPct)} above low · {pct(rg.fromHighPct)} from high</p>
            </>
          ) : <Unavailable>Less than a year of trades, so no 52-week range.</Unavailable>}

          <div className="mt-5 grid grid-cols-2 gap-2">
            {[{ label: "50-day average", sma: tr.sma50, diff: tr.vsSma50Pct }, { label: "200-day average", sma: tr.sma200, diff: tr.vsSma200Pct }].map(t => (
              <div key={t.label} className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-3">
                <div className="text-[11px] text-[var(--text-subtle)]"><Term term="Moving average">{t.label}</Term></div>
                <div className="mt-1 font-mono text-sm font-bold">{num(t.sma)}</div>
                {t.diff !== null ? (
                  <span className={`mt-1.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${t.diff >= 0 ? "bg-emerald-500/10 text-[var(--up)]" : "bg-rose-500/10 text-[var(--down)]"}`}>
                    {t.diff >= 0 ? <TrendingUp className="h-3 w-3" aria-hidden="true" /> : <TrendingDown className="h-3 w-3" aria-hidden="true" />}
                    {t.diff >= 0 ? "Above" : "Below"} by {Math.abs(t.diff).toFixed(1)}%
                  </span>
                ) : <span className="mt-1.5 block text-[10px] text-[var(--text-subtle)]">Needs more sessions</span>}
              </div>
            ))}
          </div>
          <SourceLine>Range uses daily highs and lows over the last 365 days. Averages use the last 50 and 200 trading sessions.</SourceLine>
        </Card>

        {/* ── Risk ─────────────────────────────────────────────────────────────────────────── */}
        <Card title="Risk profile" icon={Waves}>
          <div className="space-y-4">
            <div>
              <div className="flex items-baseline justify-between text-xs">
                <span className="text-[var(--text-subtle)]">Volatility (annualised)</span>
                <span className="font-mono text-base font-bold">{rk.volatilityPct !== null ? `${rk.volatilityPct.toFixed(1)}%` : "—"}</span>
              </div>
              <div className="mt-2"><Meter value={rk.volatilityPercentile} colorClass="bg-gradient-to-r from-emerald-400 via-amber-400 to-rose-500" label="Volatility percentile among DSE stocks" /></div>
              <div className="mt-1 flex justify-between text-[10px] text-[var(--text-subtle)]"><span>Calmest</span><span>{rk.volatilityPercentile !== null ? `${ordinal(rk.volatilityPercentile)} percentile of ${data.marketRank.universe}` : ""}</span><span>Most volatile</span></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Stat label={<Term term="Max drawdown" definition="The largest fall from a peak to a later low within the period. Shows how bad a losing stretch has been.">Max drawdown (1Y)</Term>} value={pct(rk.maxDrawdownPct)} valueClass={tone(rk.maxDrawdownPct)} sub={rk.drawdownPeak ? `${fmtDate(rk.drawdownPeak)} → ${fmtDate(rk.drawdownTrough)}` : undefined} />
              <Stat label={<Term term="Beta" definition="How much the stock tends to move when DSEX moves 1%. 1 = like the market, below 1 = steadier, above 1 = amplified.">Beta vs DSEX</Term>} value={num(rk.beta)}
                sub={rk.beta === null ? "Too few shared sessions" : rk.beta < 0.8 ? "Moves less than the market" : rk.beta > 1.2 ? "Amplifies market moves" : "Moves roughly with the market"} />
            </div>
            {rk.correlation !== null && <p className="text-[11px] leading-relaxed text-[var(--text-subtle)]">Correlation with DSEX is <strong className="text-[var(--text)]">{rk.correlation.toFixed(2)}</strong>: {Math.abs(rk.correlation) >= 0.6 ? "daily moves mostly follow the market" : Math.abs(rk.correlation) >= 0.3 ? "the market explains part of its daily moves" : "it mostly moves on its own news"}.</p>}
          </div>
          <SourceLine>Daily log returns, {rk.window ? rk.window.replace(" to ", " – ") : "last year"}; annualised with 240 DSE sessions a year. Beta uses days both {stock.symbol} and DSEX traded.</SourceLine>
        </Card>

        {/* ── Valuation ────────────────────────────────────────────────────────────────────── */}
        <Card title="Valuation vs sector" icon={Scale}
          aside={v.official ? <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-[var(--up)]">DSE reported</span> : undefined}>
          {v.official && (v.eps !== null || v.nav !== null || v.dividendYieldPct !== null) ? (
            <>
              <div className="grid grid-cols-2 gap-2">
                <Stat label={<Term term="P/E">P/E</Term>} value={v.pe !== null ? `${v.pe.toFixed(1)}×` : "—"} sub={s.medianPe !== null ? `Sector median ${s.medianPe.toFixed(1)}×` : v.eps !== null && v.eps <= 0 ? "Loss-making" : undefined} />
                <Stat label={<Term term="P/B">P/B</Term>} value={v.pb !== null ? `${v.pb.toFixed(2)}×` : "—"} sub={s.medianPb !== null ? `Sector median ${s.medianPb.toFixed(2)}×` : undefined} />
                <Stat label={<Term term="Earnings yield" definition="EPS ÷ price: the inverse of P/E. Easy to compare with bank deposit or bond rates.">Earnings yield</Term>} value={v.earningsYieldPct !== null ? `${v.earningsYieldPct.toFixed(1)}%` : "—"} />
                <Stat label={<Term term="Dividend yield">Dividend yield</Term>} value={v.dividendYieldPct !== null ? `${v.dividendYieldPct.toFixed(2)}%` : "—"} sub={s.medianDividendYield !== null ? `Sector median ${s.medianDividendYield.toFixed(2)}%` : undefined} />
              </div>
              {v.pe !== null && s.medianPe !== null && (
                <p className="mt-3 rounded-2xl border border-white/[0.05] bg-white/[0.02] p-3 text-xs leading-relaxed text-[var(--text-muted)]">
                  At {v.pe.toFixed(1)}× earnings, {stock.symbol} is priced {v.pe < s.medianPe ? "below" : "above"} the {s.name} median of {s.medianPe.toFixed(1)}×
                  {s.pePercentile !== null && <> (cheaper than {100 - s.pePercentile}% of {s.peersWithOfficialRatios} peers with DSE-reported EPS)</>}. A low P/E can mean value or weak expected growth.
                </p>
              )}
              <SourceLine>EPS {num(v.eps)} and NAV {num(v.nav)} as shown on DSE's company page ({fmtDate(v.ratioDate)}); ratios use the {fmtDate(data.asOf)} close.</SourceLine>
            </>
          ) : (
            <Unavailable>
              DSE-reported EPS and NAV for {stock.symbol} have not been collected yet, so P/E and P/B are not shown rather than estimated.
              {s.peersWithOfficialRatios > 0 && <> {s.peersWithOfficialRatios} of {s.peers} {s.name} companies have them.</>}
            </Unavailable>
          )}
        </Card>

        {/* ── Liquidity ────────────────────────────────────────────────────────────────────── */}
        <Card title="Liquidity" icon={Layers}>
          <div className="grid grid-cols-2 gap-2">
            <Stat label={<Term term="Avg Volume">Avg volume (20 days)</Term>} value={lq.avgVolume20 !== null ? lq.avgVolume20.toLocaleString("en-US") : "—"} sub="shares per session" />
            <Stat label="Avg traded value" value={compactBdt(lq.avgValue20Bdt)} sub="close × volume, 20 sessions" />
          </div>
          <div className="mt-4">
            <div className="flex items-baseline justify-between text-xs">
              <span className="text-[var(--text-subtle)]">Sessions traded (last year)</span>
              <span className="font-mono font-bold">{lq.tradedSessions !== null && lq.marketSessions ? `${lq.tradedSessions} / ${lq.marketSessions}` : "—"}</span>
            </div>
            <div className="mt-2"><Meter value={lq.tradedSessionsPct} colorClass="bg-gradient-to-r from-sky-500 to-[var(--accent)]" label="Share of DSE sessions with trades" /></div>
          </div>
          {lq.liquidityPercentile !== null && (
            <p className="mt-3 text-xs leading-relaxed text-[var(--text-muted)]">Trades more value per day than <strong className="text-[var(--text)]">{lq.liquidityPercentile}%</strong> of DSE stocks{lq.liquidityPercentile >= 70 ? ": usually easy to buy and sell" : lq.liquidityPercentile < 30 ? ": orders can move the price" : ""}.</p>
          )}
          <SourceLine>From daily volume in DSE's day-end archive; value is approximated as close × volume.</SourceLine>
        </Card>

        {/* ── Earnings history ─────────────────────────────────────────────────────────────── */}
        <Card title="Earnings per share by year" icon={BarChart3}>
          {data.earnings.filter(e => e.eps !== null).length >= 2 ? (() => {
            const rows = data.earnings.filter(e => e.eps !== null).map((e, i, arr) => ({
              year: String(e.fiscalYear), eps: e.eps as number,
              yoy: i > 0 && arr[i - 1].eps ? Math.round((((e.eps as number) / (arr[i - 1].eps as number)) - 1) * 1000) / 10 : null,
            }));
            const lastRow = rows[rows.length - 1], first = rows[0];
            const cagr = first.eps > 0 && lastRow.eps > 0 && rows.length > 1 ? (Math.pow(lastRow.eps / first.eps, 1 / (Number(lastRow.year) - Number(first.year))) - 1) * 100 : null;
            return (
              <>
                <div className="h-40" role="img" aria-label={`EPS by fiscal year ${first.year} to ${lastRow.year}`}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={rows} margin={{ top: 6, right: 4, left: -24, bottom: 0 }}>
                      <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
                      <XAxis dataKey="year" stroke="#64748B" fontSize={10} tickLine={false} axisLine={false} />
                      <YAxis stroke="#64748B" fontSize={10} tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={{ background: "#0f1729", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, fontSize: 12 }}
                        formatter={(val: any, _n: any, item: any) => [`BDT ${Number(val).toFixed(2)}${item?.payload?.yoy !== null && item?.payload?.yoy !== undefined ? ` (${item.payload.yoy > 0 ? "+" : ""}${item.payload.yoy}% y/y)` : ""}`, "EPS"]} />
                      <Bar dataKey="eps" radius={[6, 6, 0, 0]} isAnimationActive animationDuration={700}>
                        {rows.map(r => <Cell key={r.year} fill={r.yoy === null ? "#38BDF8" : r.yoy >= 0 ? "#34D399" : "#F87171"} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-[var(--text-muted)]">
                  FY{lastRow.year} EPS <strong className="font-mono text-[var(--text)]">BDT {lastRow.eps.toFixed(2)}</strong>{lastRow.yoy !== null && <>, <strong className={tone(lastRow.yoy)}>{pct(lastRow.yoy)}</strong> on the year before</>}
                  {cagr !== null && <>; {cagr >= 0 ? "grew" : "shrank"} {Math.abs(cagr).toFixed(1)}% a year since FY{first.year}</>}.
                </p>
                <SourceLine>Fiscal-year EPS as listed on DSE's company page. Green = higher than the year before, red = lower.</SourceLine>
              </>
            );
          })() : (
            <Unavailable>Year-by-year EPS from DSE's company page has not been collected for {stock.symbol} yet, so no earnings trend is shown.</Unavailable>
          )}
        </Card>
      </div>

      {/* ── Data notes ─────────────────────────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-[var(--border)] bg-white/[0.02] p-4 text-xs leading-relaxed text-[var(--text-subtle)]">
        <div className="mb-1.5 flex items-center gap-1.5 font-semibold text-[var(--text-muted)]"><Info className="h-3.5 w-3.5" aria-hidden="true" /> About these numbers</div>
        <ul className="list-disc space-y-1 pl-5">
          {data.notes.map(n => <li key={n}>{n}</li>)}
          {data.flaggedMoves.map(m => <li key={m.to}>One-day move of {pct(m.changePct)} on {fmtDate(m.to)}, possibly a dividend, bonus or rights adjustment rather than a market move.</li>)}
          {s.name && s.peers > 0 && <li>Sector comparisons use the {s.peers} {s.name} securities on this site; valuation medians only use the {s.peersWithOfficialRatios} with DSE-reported figures and need at least 3.</li>}
          <li className="flex items-center gap-1"><Gauge className="h-3 w-3" aria-hidden="true" /> Educational use only. Not investment advice.</li>
        </ul>
      </div>
    </div>
  );
}
