import React, { useEffect, useMemo, useState } from "react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, LineChart, Line } from "recharts";
import { Terminal, TrendingUp, TrendingDown, Flame, LayoutGrid, Info } from "lucide-react";
import { StockData } from "../types";
import { StockSearch } from "./ui/StockSearch";
import { MarketStatusChip } from "./ui/StatusPrimitives";
import { IndicesPayload, feedState, describeAsOf } from "../utils/marketStatus";

/**
 * Front page market terminal: dense like a trading screen, but every panel says in one line how to
 * read it and every row opens the stock. Uses only DSE data the app already serves.
 */
type IndexKey = "DSEX" | "DS30" | "DSES";
interface IndexPoint { date: string; value: number }
interface Indices extends IndicesPayload {
  DSEX?: { value: number; change: number; changePercent: number };
  DS30?: { value: number; change: number; changePercent: number };
  DSES?: { value: number; change: number; changePercent: number };
}

const AMBER = "#FFB020";
const fmt = (v: number | null | undefined, d = 2) => (v === null || v === undefined || !Number.isFinite(v) ? "—" : v.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d }));
const signed = (v: number | null | undefined, d = 2, unit = "") => (v === null || v === undefined || !Number.isFinite(v) ? "—" : `${v > 0 ? "+" : ""}${fmt(v, d)}${unit}`);
const tone = (v: number | null | undefined) => (!v ? "text-[var(--text-muted)]" : v > 0 ? "text-[var(--up)]" : "text-[var(--down)]");
const compact = (v: number | null | undefined) => {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  if (v >= 1e12) return `${(v / 1e12).toFixed(2)}T`;
  if (v >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(2)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  return v.toFixed(0);
};
const shortDate = (d: string) => {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, day)).toLocaleDateString("en-GB", { timeZone: "UTC", day: "numeric", month: "short" });
};

function Panel({ title, hint, icon: Icon, children, className = "", aside }: { title: string; hint: string; icon: React.ComponentType<any>; children: React.ReactNode; className?: string; aside?: React.ReactNode }) {
  return (
    <section className={`flex min-w-0 flex-col rounded-xl border border-white/[0.08] bg-[#060a14] ${className}`} aria-label={title}>
      <header className="flex items-center justify-between gap-2 border-b border-white/[0.06] px-3 py-2">
        <h3 className="flex items-center gap-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: AMBER }}>
          <Icon className="h-3.5 w-3.5" aria-hidden="true" /> {title}
        </h3>
        {aside}
      </header>
      <p className="px-3 pt-2 text-[11px] leading-snug text-[var(--text-subtle)]">{hint}</p>
      <div className="min-w-0 flex-1 p-3 pt-2">{children}</div>
    </section>
  );
}

function IndexTile({ name, label, data, history }: { name: IndexKey; label: string; data?: { value: number; change: number; changePercent: number }; history: IndexPoint[] }) {
  const spark = history.slice(-60);
  const up = (data?.change ?? 0) >= 0;
  return (
    <div className="min-w-0 rounded-xl border border-white/[0.08] bg-[#060a14] p-3 transition-colors hover:border-[#FFB020]/40">
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-mono text-xs font-bold tracking-widest text-[var(--text)]">{name}</span>
        <span className="truncate text-[10px] text-[var(--text-subtle)]">{label}</span>
      </div>
      <div className="mt-1 font-mono text-2xl font-bold tabular-nums text-[var(--text)]">{fmt(data?.value)}</div>
      <div className={`font-mono text-xs font-semibold tabular-nums ${tone(data?.change)}`}>
        {signed(data?.change)} ({signed(data?.changePercent, 2, "%")})
      </div>
      <div className="mt-2 h-10" aria-hidden="true">
        {spark.length > 1 ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={spark} margin={{ top: 2, right: 0, left: 0, bottom: 2 }}>
              <YAxis hide domain={["dataMin", "dataMax"]} />
              <Line type="monotone" dataKey="value" stroke={up ? "#34D399" : "#F87171"} strokeWidth={1.5} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        ) : <div className="flex h-full items-center text-[10px] text-[var(--text-subtle)]">No daily history published</div>}
      </div>
    </div>
  );
}

function MoverTable({ rows, valueOf, valueLabel, onSelect }: { rows: StockData[]; valueOf: (s: StockData) => string; valueLabel: string; onSelect: (s: string) => void }) {
  if (!rows.length) return <p className="py-6 text-center text-xs text-[var(--text-subtle)]">No trades reported yet.</p>;
  return (
    <table className="w-full table-fixed font-mono text-xs">
      <thead>
        <tr className="text-left text-[10px] uppercase tracking-wider text-[var(--text-subtle)]">
          <th className="w-[38%] pb-1 font-medium">Ticker</th>
          <th className="pb-1 text-right font-medium">Price</th>
          <th className="pb-1 text-right font-medium">{valueLabel}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(s => (
          <tr key={s.symbol} className="cursor-pointer border-t border-white/[0.04] hover:bg-[#FFB020]/[0.06]" onClick={() => onSelect(s.symbol)}>
            <td className="truncate py-1.5">
              <button type="button" className="font-bold text-[var(--text)] hover:underline" onClick={e => { e.stopPropagation(); onSelect(s.symbol); }}>{s.symbol}</button>
            </td>
            <td className="py-1.5 text-right tabular-nums text-[var(--text-muted)]">{fmt(s.price)}</td>
            <td className={`py-1.5 text-right font-semibold tabular-nums ${valueLabel === "Change" ? tone(s.changePercent) : "text-[var(--text)]"}`}>{valueOf(s)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const RANGES: { key: string; label: string; days: number }[] = [
  { key: "1M", label: "1M", days: 22 }, { key: "3M", label: "3M", days: 66 }, { key: "6M", label: "6M", days: 130 }, { key: "1Y", label: "1Y", days: 260 },
];

export default function MarketTerminal({ stocks, onSelectStock, onNavigate }: { stocks: StockData[]; onSelectStock: (s: string) => void; onNavigate: (view: string) => void }) {
  const [indices, setIndices] = useState<Indices | null>(null);
  const [failed, setFailed] = useState(false);
  const [history, setHistory] = useState<Record<IndexKey, IndexPoint[]>>({ DSEX: [], DS30: [], DSES: [] });
  const [range, setRange] = useState("3M");

  useEffect(() => {
    let alive = true;
    fetch("/api/market/indices").then(r => (r.ok ? r.json() : Promise.reject(r.status)))
      .then(d => { if (alive) setIndices(d); }).catch(() => { if (alive) setFailed(true); });
    (["DSEX", "DS30", "DSES"] as IndexKey[]).forEach(k =>
      fetch(`/api/market/indices/${k}/chart?days=365`).then(r => (r.ok ? r.json() : null))
        .then(d => { if (alive && d?.data) setHistory(h => ({ ...h, [k]: d.data.filter((p: any) => p.value > 0).map((p: any) => ({ date: p.date, value: p.value })) })); })
        .catch(() => {}));
    return () => { alive = false; };
  }, []);

  const state = failed ? "offline" : feedState(indices);
  const asOf = failed ? null : describeAsOf(indices);
  const totals = indices?.totals;
  const breadth = indices?.breadth;

  const traded = useMemo(() => stocks.filter(s => s.price > 0 && (s.volume ?? 0) > 0), [stocks]);
  const gainers = useMemo(() => [...traded].filter(s => s.changePercent > 0).sort((a, b) => b.changePercent - a.changePercent).slice(0, 8), [traded]);
  const losers = useMemo(() => [...traded].filter(s => s.changePercent < 0).sort((a, b) => a.changePercent - b.changePercent).slice(0, 8), [traded]);
  const active = useMemo(() => [...traded].sort((a, b) => b.price * b.volume - a.price * a.volume).slice(0, 8), [traded]);
  const sectors = useMemo(() => {
    const m = new Map<string, { sum: number; n: number; up: number; down: number }>();
    for (const s of traded) {
      if (!s.sector) continue;
      const e = m.get(s.sector) ?? { sum: 0, n: 0, up: 0, down: 0 };
      e.sum += s.changePercent; e.n++; if (s.changePercent > 0) e.up++; if (s.changePercent < 0) e.down++;
      m.set(s.sector, e);
    }
    return [...m].map(([name, e]) => ({ name, avg: e.sum / e.n, n: e.n, up: e.up, down: e.down })).sort((a, b) => b.avg - a.avg);
  }, [traded]);

  const chart = useMemo(() => history.DSEX.slice(-(RANGES.find(r => r.key === range)?.days ?? 66)), [history.DSEX, range]);
  const chartChange = chart.length > 1 ? (chart[chart.length - 1].value / chart[0].value - 1) * 100 : null;
  const totalBreadth = breadth ? breadth.advanced + breadth.declined + breadth.unchanged : 0;
  const pct = (n: number) => (totalBreadth ? (n / totalBreadth) * 100 : 0);

  return (
    <section aria-labelledby="terminal-title" className="space-y-3 rounded-2xl border border-white/[0.08] bg-gradient-to-b from-[#0b1222] to-[#05080f] p-3 sm:p-4">
      {/* Command bar */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="flex shrink-0 items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-lg" style={{ background: AMBER }}><Terminal className="h-5 w-5 text-black" aria-hidden="true" /></span>
          <div>
            <h1 id="terminal-title" className="font-mono text-sm font-black uppercase tracking-[0.2em] text-[var(--text)]">DSE Market Terminal</h1>
            <p className="text-[11px] text-[var(--text-subtle)]">Dhaka Stock Exchange · prices in BDT · for learning, not investment advice</p>
          </div>
        </div>
        <div id="home-search" className="min-w-0 flex-1">
          <StockSearch stocks={stocks} onSelect={onSelectStock} size="lg" label="Search for a DSE stock" placeholder="Type a ticker or company name, e.g. GP, then press Enter" />
        </div>
        <div className="shrink-0"><MarketStatusChip state={state} detail={asOf} /></div>
      </div>

      {/* Index tiles + market totals */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <IndexTile name="DSEX" label="Broad index" data={indices?.DSEX} history={history.DSEX} />
        <IndexTile name="DS30" label="30 blue chips" data={indices?.DS30} history={history.DS30} />
        <IndexTile name="DSES" label="Shariah index" data={indices?.DSES} history={history.DSES} />
        <div className="min-w-0 rounded-xl border border-white/[0.08] bg-[#060a14] p-3">
          <div className="font-mono text-xs font-bold tracking-widest text-[var(--text)]">MARKET</div>
          <dl className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1.5 font-mono text-xs">
            <div><dt className="text-[10px] text-[var(--text-subtle)]">Turnover</dt><dd className="font-bold tabular-nums text-[var(--text)]">{totals?.turnover != null ? `৳${fmt(totals.turnover, 0)}M` : "—"}</dd></div>
            <div><dt className="text-[10px] text-[var(--text-subtle)]">Trades</dt><dd className="font-bold tabular-nums text-[var(--text)]">{compact(totals?.trades)}</dd></div>
            <div><dt className="text-[10px] text-[var(--text-subtle)]">Volume</dt><dd className="font-bold tabular-nums text-[var(--text)]">{compact(totals?.volume)}</dd></div>
            <div><dt className="text-[10px] text-[var(--text-subtle)]">Market cap</dt><dd className="font-bold tabular-nums text-[var(--text)]">{totals?.marketCap != null ? `৳${compact(totals.marketCap)}` : "—"}</dd></div>
          </dl>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-12">
        {/* DSEX chart */}
        <Panel title="DSEX history" icon={TrendingUp} className="lg:col-span-8"
          hint="The broad DSE index at each day's close. Pick a range; the figure on the right is the change over it."
          aside={
            <div className="flex items-center gap-2">
              <span className={`font-mono text-xs font-bold ${tone(chartChange)}`}>{signed(chartChange, 2, "%")}</span>
              <div className="flex gap-0.5" role="tablist" aria-label="Chart range">
                {RANGES.map(r => (
                  <button key={r.key} type="button" role="tab" aria-selected={range === r.key} onClick={() => setRange(r.key)}
                    className={`rounded px-2 py-0.5 font-mono text-[11px] font-bold transition-colors ${range === r.key ? "text-black" : "text-[var(--text-subtle)] hover:text-[var(--text)]"}`}
                    style={range === r.key ? { background: AMBER } : undefined}>{r.label}</button>
                ))}
              </div>
            </div>
          }>
          <div className="h-56 sm:h-64">
            {chart.length > 1 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chart} margin={{ top: 4, right: 4, left: -8, bottom: 0 }}>
                  <defs>
                    <linearGradient id="dsexFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={AMBER} stopOpacity={0.35} />
                      <stop offset="100%" stopColor={AMBER} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="date" tickFormatter={shortDate} stroke="#64748B" fontSize={10} tickLine={false} axisLine={false} minTickGap={40} />
                  <YAxis domain={["auto", "auto"]} stroke="#64748B" fontSize={10} tickLine={false} axisLine={false} width={48} tickFormatter={v => fmt(v, 0)} />
                  <Tooltip contentStyle={{ background: "#0b1222", border: "1px solid rgba(255,176,32,0.3)", borderRadius: 8, fontSize: 12, fontFamily: "monospace" }}
                    labelFormatter={d => shortDate(String(d))} formatter={(v: any) => [fmt(Number(v)), "DSEX"]} />
                  <Area type="monotone" dataKey="value" stroke={AMBER} strokeWidth={1.8} fill="url(#dsexFill)" dot={false} isAnimationActive animationDuration={600} />
                </AreaChart>
              </ResponsiveContainer>
            ) : <div className="grid h-full place-items-center text-xs text-[var(--text-subtle)]">Loading DSEX history…</div>}
          </div>
          <p className="mt-1 text-[10px] text-[var(--text-subtle)]">Source: DSE market summary archive (daily closes){chart.length ? ` · ${shortDate(chart[0].date)} – ${shortDate(chart[chart.length - 1].date)}` : ""}</p>
        </Panel>

        {/* Breadth */}
        <Panel title="Market breadth" icon={LayoutGrid} className="lg:col-span-4"
          hint="How many shares rose, fell or were unchanged in the session. More rising than falling = a broad up day.">
          {breadth && totalBreadth ? (
            <div className="space-y-4">
              <div className="flex h-4 overflow-hidden rounded-full" role="img" aria-label={`${breadth.advanced} up, ${breadth.declined} down, ${breadth.unchanged} unchanged`}>
                <div className="bg-emerald-400 transition-[width] duration-700" style={{ width: `${pct(breadth.advanced)}%` }} />
                <div className="bg-slate-500" style={{ width: `${pct(breadth.unchanged)}%` }} />
                <div className="bg-rose-400 transition-[width] duration-700" style={{ width: `${pct(breadth.declined)}%` }} />
              </div>
              <dl className="grid grid-cols-3 gap-2 text-center font-mono">
                <div><dt className="text-[10px] text-[var(--text-subtle)]">Up</dt><dd className="text-xl font-bold text-[var(--up)]">{breadth.advanced}</dd><dd className="text-[10px] text-[var(--text-subtle)]">{pct(breadth.advanced).toFixed(0)}%</dd></div>
                <div><dt className="text-[10px] text-[var(--text-subtle)]">Flat</dt><dd className="text-xl font-bold text-[var(--text-muted)]">{breadth.unchanged}</dd><dd className="text-[10px] text-[var(--text-subtle)]">{pct(breadth.unchanged).toFixed(0)}%</dd></div>
                <div><dt className="text-[10px] text-[var(--text-subtle)]">Down</dt><dd className="text-xl font-bold text-[var(--down)]">{breadth.declined}</dd><dd className="text-[10px] text-[var(--text-subtle)]">{pct(breadth.declined).toFixed(0)}%</dd></div>
              </dl>
              <p className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-2.5 text-xs leading-relaxed text-[var(--text-muted)]">
                {breadth.advanced > breadth.declined * 1.5 ? "Most shares are rising: a broad up session." : breadth.declined > breadth.advanced * 1.5 ? "Most shares are falling: a broad down session." : "Rising and falling shares are fairly balanced."}
              </p>
              <button type="button" onClick={() => onNavigate("about")} className="flex items-center gap-1 text-[11px] text-[var(--text-subtle)] hover:text-[var(--text)]">
                <Info className="h-3 w-3" aria-hidden="true" /> Where these numbers come from
              </button>
            </div>
          ) : <p className="py-6 text-center text-xs text-[var(--text-subtle)]">Breadth not reported yet.</p>}
        </Panel>
      </div>

      {/* Movers */}
      <div className="grid gap-3 md:grid-cols-3">
        <Panel title="Top gainers" icon={TrendingUp} hint="Biggest % rises this session among shares that traded. Click a row to open the stock.">
          <MoverTable rows={gainers} valueLabel="Change" valueOf={s => signed(s.changePercent, 2, "%")} onSelect={onSelectStock} />
        </Panel>
        <Panel title="Top losers" icon={TrendingDown} hint="Biggest % falls this session among shares that traded.">
          <MoverTable rows={losers} valueLabel="Change" valueOf={s => signed(s.changePercent, 2, "%")} onSelect={onSelectStock} />
        </Panel>
        <Panel title="Most active" icon={Flame} hint="Highest traded value (price × shares traded): where the money is moving.">
          <MoverTable rows={active} valueLabel="Value ৳" valueOf={s => compact(s.price * s.volume)} onSelect={onSelectStock} />
        </Panel>
      </div>

      {/* Sector heatmap */}
      <Panel title="Sector heatmap" icon={LayoutGrid} hint="Average % move of the traded shares in each sector (each share counts equally). Green = up, red = down; stronger colour = bigger move.">
        {sectors.length ? (
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-6">
            {sectors.map(sec => {
              const a = Math.min(1, Math.abs(sec.avg) / 3);
              const bg = sec.avg > 0 ? `rgba(52,211,153,${0.12 + a * 0.5})` : sec.avg < 0 ? `rgba(248,113,113,${0.12 + a * 0.5})` : "rgba(148,163,184,0.12)";
              return (
                <div key={sec.name} className="min-w-0 rounded-lg border border-white/[0.06] p-2" style={{ background: bg }} title={`${sec.name}: ${sec.up} up, ${sec.down} down of ${sec.n} traded`}>
                  <div className="truncate text-[11px] font-semibold text-[var(--text)]">{sec.name}</div>
                  <div className="font-mono text-sm font-bold tabular-nums text-white">{signed(sec.avg, 2, "%")}</div>
                  <div className="font-mono text-[10px] text-white/70">{sec.up}▲ {sec.down}▼ · {sec.n}</div>
                </div>
              );
            })}
          </div>
        ) : <p className="py-6 text-center text-xs text-[var(--text-subtle)]">No sector data yet.</p>}
      </Panel>
    </section>
  );
}
