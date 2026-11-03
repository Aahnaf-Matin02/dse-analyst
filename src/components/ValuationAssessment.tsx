import React, { useEffect, useState } from "react";
import { Scale, Database, Info } from "lucide-react";
import { assessValuation, ValuationReading } from "../utils/valuationAssessment";
import { SkeletonCard } from "./ui/StatusPrimitives";

const TONE = {
  up: "text-[var(--up)] border-emerald-400/30 bg-emerald-400/10",
  down: "text-[var(--down)] border-rose-400/30 bg-rose-400/10",
  neutral: "text-amber-300 border-amber-400/30 bg-amber-400/10",
  none: "text-[var(--text-subtle)] border-white/10 bg-white/5",
};
const LEAN = { cheaper: "text-[var(--up)]", pricier: "text-[var(--down)]", "in line": "text-[var(--text-muted)]" };

/** Valuation reading for one stock, computed from DSE data without AI, with each step explained. */
export default function ValuationAssessment({ symbol }: { symbol: string }) {
  const [state, setState] = useState<{ reading: ValuationReading; asOf: string | null; ratioDate: string | null; sourceUrl: string | null } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setState(null); setError(null);
    fetch(`/api/stocks/${encodeURIComponent(symbol)}/analytics`)
      .then(r => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then(d => { if (!cancelled) setState({ reading: assessValuation(d), asOf: d.asOf, ratioDate: d.valuation.ratioDate, sourceUrl: d.valuation.sourceUrl }); })
      .catch(e => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [symbol]);

  if (error) return <p className="rounded-2xl border border-[var(--border)] p-4 text-sm text-[var(--text-subtle)]">Valuation data could not be loaded ({error}).</p>;
  if (!state) return <SkeletonCard lines={4} label="Loading valuation assessment" />;
  const { reading, asOf, ratioDate, sourceUrl } = state;

  return (
    <section aria-labelledby="valuation-assessment-heading" className="rounded-3xl border border-[var(--border)] bg-gradient-to-b from-[#121b2e] to-[var(--surface)] p-5 md:p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-[var(--accent)]">Valuation assessment · calculated, not AI</p>
          <h3 id="valuation-assessment-heading" className="mt-1 flex items-center gap-2 text-lg font-bold text-[var(--text)]">
            <Scale className="h-5 w-5 text-[var(--accent)]" aria-hidden="true" /> {symbol} compared with its sector
          </h3>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-[var(--text-muted)]">{reading.summary}</p>
        </div>
        <div className={`shrink-0 rounded-2xl border px-4 py-3 text-center ${TONE[reading.tone]}`}>
          <div className="text-[11px] font-medium opacity-80">Reading</div>
          <div className="text-base font-bold">{reading.verdict}</div>
        </div>
      </div>

      {reading.figures.length > 0 && (
        <div className="mt-5">
          <h4 className="mb-2 text-sm font-semibold text-[var(--text)]">{symbol}'s figures</h4>
          <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {reading.figures.map(f => (
              <div key={f.name} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3">
                <dt className="text-xs text-[var(--text-subtle)]">{f.name}</dt>
                <dd className="mt-0.5 font-mono text-lg font-bold tabular-nums text-[var(--text)]">{f.value}</dd>
                <dd className="mt-1 text-[11px] leading-snug text-[var(--text-muted)]">{f.explanation}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {reading.checks.length > 0 && (
        <div className="mt-5">
          <h4 className="mb-2 text-sm font-semibold text-[var(--text)]">Compared with the sector: how the reading was worked out</h4>
          <ol className="grid gap-3 md:grid-cols-3">
            {reading.checks.map((c, i) => (
              <li key={c.name} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-xs text-[var(--text-subtle)]">{i + 1}. {c.name}</span>
                  <span className={`text-xs font-bold capitalize ${LEAN[c.lean]}`}>{c.lean}</span>
                </div>
                <div className="mt-1 font-mono text-xl font-bold tabular-nums text-[var(--text)]">{c.value}</div>
                <div className="text-[11px] text-[var(--text-subtle)]">{c.benchmark}</div>
                <p className="mt-2 text-xs leading-relaxed text-[var(--text-muted)]">{c.explanation}</p>
              </li>
            ))}
          </ol>
        </div>
      )}

      <div className="mt-5 space-y-1.5 text-[11px] leading-relaxed text-[var(--text-subtle)]">
        <p className="flex items-start gap-1.5"><Info className="mt-[1px] h-3 w-3 shrink-0" aria-hidden="true" />
          Rule: a measure more than 20% better than the sector median points “cheaper”, more than 20% worse points “pricier”, otherwise “in line”. A share below its book value (P/B under 1) always points cheaper. The reading is the side with more measures.
        </p>
        <p className="flex items-start gap-1.5"><Database className="mt-[1px] h-3 w-3 shrink-0" aria-hidden="true" />
          EPS, NAV and dividend yield as reported on DSE's company page{ratioDate ? ` (${ratioDate})` : ""}; prices at the {asOf ?? "latest"} close; medians use sector peers with DSE-reported figures.{sourceUrl ? <> <a className="underline hover:text-[var(--text)]" href={sourceUrl} target="_blank" rel="noreferrer">Source</a></> : null}
        </p>
        <p>A cheap-looking ratio can reflect weak expected growth or risk. This is a comparison for learning, not investment advice.</p>
      </div>
    </section>
  );
}
