import React, { useEffect, useState } from "react";
import { Search, Star, BookOpen } from "lucide-react";
import { StockData } from "../types";
import { StockSearch } from "./ui/StockSearch";
import { MarketStatusChip } from "./ui/StatusPrimitives";
import { IndicesPayload, feedState, describeAsOf } from "../utils/marketStatus";

/** First screen for a new visitor: what this is, a big search, market status, and where to start. */
export default function HomeHero({ stocks, onSelectStock, onNavigate }: { stocks: StockData[]; onSelectStock: (s: string) => void; onNavigate: (view: string) => void }) {
  const [indices, setIndices] = useState<IndicesPayload | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch("/api/market/indices")
      .then(r => (r.ok ? r.json() : Promise.reject(r.status)))
      .then(d => { if (alive) setIndices(d); })
      .catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, []);

  const state = failed ? "offline" : feedState(indices);
  const asOf = failed ? null : describeAsOf(indices);
  const focusSearch = () => (document.querySelector("#home-search input") as HTMLInputElement | null)?.focus();
  const scrollToWatchlist = () => document.getElementById("dse-watchlist-bar")?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <section aria-labelledby="home-title" className="rounded-3xl border border-[var(--border)] bg-gradient-to-b from-[#111A2E] to-[var(--surface)] p-6 sm:p-10">
      <div className="max-w-3xl">
        <MarketStatusChip state={state} detail={asOf} />
        <h1 id="home-title" className="mt-4 text-3xl sm:text-4xl lg:text-5xl font-display font-bold text-white leading-tight">
          Understand any Dhaka Stock Exchange company in minutes.
        </h1>
        <p className="mt-3 text-base sm:text-lg text-[var(--text-muted)]">
          Prices from the Dhaka Stock Exchange and companies' reported numbers, explained in plain language. For learning — not investment advice.
        </p>
        <div id="home-search" className="mt-6">
          <StockSearch stocks={stocks} onSelect={onSelectStock} size="lg" label="Search for a DSE stock" />
          <p className="mt-2 text-sm text-[var(--text-subtle)]">Try <button type="button" className="underline hover:text-white" onClick={() => onSelectStock("GP")}>GP</button>, <button type="button" className="underline hover:text-white" onClick={() => onSelectStock("SQURPHARMA")}>SQURPHARMA</button> or a company name.</p>
        </div>
      </div>

      <nav aria-label="Start here" className="mt-8 grid gap-3 sm:grid-cols-3">
        {[
          { icon: Search, t: "Search a stock", d: "Find a company by ticker or name.", on: focusSearch },
          { icon: Star, t: "Open your watchlist", d: "Keep an eye on the stocks you care about.", on: scrollToWatchlist },
          { icon: BookOpen, t: "How it works", d: "Where the data comes from and what the labels mean.", on: () => onNavigate("about") },
        ].map(({ icon: Icon, t, d, on }) => (
          <button key={t} type="button" onClick={on} className="text-left rounded-2xl border border-[var(--border)] bg-[var(--surface-2)]/50 hover:border-[var(--accent)]/50 hover:bg-[var(--surface-2)] transition-colors p-4 min-h-[88px]">
            <span className="flex items-center gap-2 font-semibold text-[var(--text)]"><Icon className="h-5 w-5 text-[var(--accent)]" aria-hidden="true" /> {t}</span>
            <span className="block text-sm text-[var(--text-muted)] mt-1">{d}</span>
          </button>
        ))}
      </nav>
    </section>
  );
}
