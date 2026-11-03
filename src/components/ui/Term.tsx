import React, { useEffect, useId, useRef, useState } from "react";
import { HelpCircle } from "lucide-react";

/** One- or two-sentence plain-language definitions for terms used across the app. */
export const GLOSSARY: Record<string, string> = {
  "Market Cap": "Company value on the stock market: share price × number of shares.",
  "P/E Ratio": "Price ÷ earnings per share. How many taka investors pay for each taka of yearly profit; higher can mean expensive or high expected growth.",
  "P/E": "Price ÷ earnings per share. How many taka investors pay for each taka of yearly profit.",
  "P/B": "Price ÷ book value (NAV) per share. Below 1 means the share trades for less than its accounting net worth.",
  "EPS (BDT)": "Earnings per share: the company's profit for the year divided by its number of shares, in taka.",
  "EPS": "Earnings per share: yearly profit divided by the number of shares.",
  "NAV": "Net asset value per share: what each share would be worth on paper if all assets were sold and debts paid.",
  "52W High": "The highest price in the last 52 weeks (one year).",
  "52W Low": "The lowest price in the last 52 weeks (one year).",
  "Avg Volume": "Average number of shares traded per day. Higher volume usually means easier buying and selling.",
  "RSI": "Relative Strength Index (0–100): above 70 often called 'overbought', below 30 'oversold'. A momentum gauge, not a forecast.",
  "MACD": "Moving Average Convergence Divergence: compares a fast and a slow moving average to show momentum shifts.",
  "Graham value": "Benjamin Graham's rough fair value: √(22.5 × EPS × NAV). A conservative rule of thumb for value investors.",
  "Margin of safety": "How far below an estimated fair value the price is. A bigger margin leaves more room for estimation errors.",
  "Dividend yield": "Yearly dividend ÷ share price, as a percentage.",
  "Moving average": "The average closing price over the last N days, used to smooth out daily noise.",
};

/** A term with an accessible tooltip (hover, keyboard focus, or tap). */
export function Term({ term, children, definition }: { term: string; children?: React.ReactNode; definition?: string }) {
  const text = definition ?? GLOSSARY[term];
  const [open, setOpen] = useState(false);
  const id = useId();
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | TouchEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", close);
    document.addEventListener("touchstart", close);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("touchstart", close); document.removeEventListener("keydown", esc); };
  }, [open]);

  if (!text) return <>{children ?? term}</>;
  return (
    <span ref={ref} className="relative inline-flex items-center gap-1" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <span>{children ?? term}</span>
      <button
        type="button"
        aria-label={`What is ${term}?`}
        aria-describedby={open ? id : undefined}
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className="term-btn inline-flex items-center justify-center p-0.5 rounded-full text-[var(--text-subtle)] hover:text-[var(--text)]"
      >
        <HelpCircle className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
      {open && (
        <span id={id} role="tooltip" className="absolute left-0 top-full mt-1.5 z-50 w-64 rounded-xl border border-[var(--border-strong)] bg-[#0B1222] p-3 text-xs font-normal normal-case tracking-normal leading-relaxed text-[var(--text)] shadow-2xl">
          {text}
        </span>
      )}
    </span>
  );
}

/** "4 Oct '26" style axis tick from an ISO date (keeps short ranges readable). */
export function formatChartTick(value: string): string {
  const d = new Date(value);
  if (isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
}

/** "Sunday 4 Oct 2026" for tooltips. */
export function formatChartDate(value: string): string {
  const d = new Date(value);
  if (isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}
