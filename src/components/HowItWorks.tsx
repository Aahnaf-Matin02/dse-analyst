import React from "react";
import { Search, LineChart, Sparkles, ShieldCheck, Database, AlertTriangle } from "lucide-react";
import { BadgeLegend } from "./SourceDataBadge";

/** "How it works / Data sources" page. Describes sources exactly as the app uses them today. */
export default function HowItWorks({ onStart }: { onStart?: () => void }) {
  return (
    <article className="max-w-3xl mx-auto space-y-8 text-[var(--text)]" aria-labelledby="how-heading">
      <header className="space-y-2">
        <h1 id="how-heading" className="text-3xl font-display font-bold">How DSE Analyst works</h1>
        <p className="text-base text-[var(--text-muted)] leading-relaxed">
          A learning tool for the Dhaka Stock Exchange: look up a company, see its price and reported numbers,
          and read plain-language explanations. It is for education only and is <strong>not investment advice</strong>.
        </p>
      </header>

      <section aria-labelledby="steps-heading" className="space-y-3">
        <h2 id="steps-heading" className="text-xl font-semibold">Three steps</h2>
        <ol className="grid gap-3 sm:grid-cols-3">
          {[
            { icon: Search, t: "1. Find a stock", d: "Search by ticker (GP) or company name (Grameenphone). Press / to jump to search." },
            { icon: LineChart, t: "2. Read the numbers", d: "Price, change, P/E, EPS and NAV — each with its source and the date it is from." },
            { icon: Sparkles, t: "3. Ask for an explanation", d: "Press Generate to get an AI or rule-based summary. It always says which one produced it." },
          ].map(({ icon: Icon, t, d }) => (
            <li key={t} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
              <Icon className="h-5 w-5 text-[var(--accent)]" aria-hidden="true" />
              <p className="font-semibold mt-2">{t}</p>
              <p className="text-sm text-[var(--text-muted)] mt-1">{d}</p>
            </li>
          ))}
        </ol>
        {onStart && <button type="button" className="btn-primary" onClick={onStart}><Search className="h-4 w-4" aria-hidden="true" /> Start with a stock</button>}
      </section>

      <section aria-labelledby="sources-heading" className="space-y-3">
        <h2 id="sources-heading" className="text-xl font-semibold flex items-center gap-2"><Database className="h-5 w-5 text-[var(--accent)]" aria-hidden="true" /> Where the data comes from</h2>
        <div className="overflow-x-auto rounded-2xl border border-[var(--border)]">
          <table className="w-full text-sm">
            <caption className="sr-only">Data sources used by the app</caption>
            <thead className="bg-[var(--surface-2)] text-left">
              <tr><th scope="col" className="p-3">What</th><th scope="col" className="p-3">Source</th><th scope="col" className="p-3">How fresh</th></tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)] text-[var(--text-muted)]">
              <tr><td className="p-3 text-[var(--text)]">Prices, volume, indices</td><td className="p-3">Dhaka Stock Exchange website (dse.com.bd)</td><td className="p-3">Refreshed every few minutes while the server runs. When the market is closed you see the last session's closing values, labelled “Market closed”.</td></tr>
              <tr><td className="p-3 text-[var(--text)]">EPS, NAV, P/E, dividends</td><td className="p-3">DSE company pages and company filings</td><td className="p-3">As last reported by the company; shown as “Not reported” when missing.</td></tr>
              <tr><td className="p-3 text-[var(--text)]">Price history (charts)</td><td className="p-3">DSE's official day-end archive (daily open, high, low, close, volume)</td><td className="p-3">The last two years (DSE’s archive keeps a rolling two years), updated after each trading day. Days a security did not trade are left out, never filled in. Securities without history show “No historical data available”.</td></tr>
              <tr><td className="p-3 text-[var(--text)]">Index history</td><td className="p-3">DSE market summary archive</td><td className="p-3">Daily closing values for DSEX and DS30 over the same two years. DSES history is not published there, so it is not shown.</td></tr>
              <tr><td className="p-3 text-[var(--text)]">Explanations</td><td className="p-3">Google Gemini when configured, otherwise fixed rules</td><td className="p-3">Only when you press Generate. Each result says which engine produced it.</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="badges-heading" className="space-y-3">
        <h2 id="badges-heading" className="text-xl font-semibold">What the labels mean</h2>
        <BadgeLegend />
      </section>

      <section aria-labelledby="limits-heading" className="space-y-2 rounded-2xl border border-amber-400/30 bg-amber-400/5 p-5">
        <h2 id="limits-heading" className="text-lg font-semibold flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-amber-300" aria-hidden="true" /> Limits to keep in mind</h2>
        <ul className="list-disc pl-5 space-y-1 text-sm text-[var(--text-muted)]">
          <li>Prices are not adjusted for dividends, bonus shares, rights issues or splits, so charts can show sudden drops on those dates.</li>
          <li>History older than about two years is not available from DSE’s public archive, so it is not shown.</li>
          <li>Forecasts and “AI interpretations” are illustrations for learning. They have not been back-tested.</li>
          <li>Free AI explanations are limited per hour to keep the service available for everyone.</li>
        </ul>
      </section>

      <p className="text-sm text-[var(--text-subtle)] flex items-center gap-2"><ShieldCheck className="h-4 w-4" aria-hidden="true" /> Educational use only. Not investment advice. This app does not buy or sell shares.</p>
    </article>
  );
}
