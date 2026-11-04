import React, { useEffect, useState } from "react";
import { GLOSSARY } from "./Term";

const TIPS = Object.entries(GLOSSARY);

/**
 * Loading state in the terminal style: a scanning bar, what is loading, and a rotating glossary
 * definition so the wait teaches something. Announced politely to screen readers.
 */
export function TerminalLoader({ label = "Loading", className = "", compact = false }: { label?: string; className?: string; compact?: boolean }) {
  const [i, setI] = useState(() => Math.floor(Math.random() * TIPS.length));
  useEffect(() => {
    const t = setInterval(() => setI(n => (n + 1) % TIPS.length), 4500);
    return () => clearInterval(t);
  }, []);
  const [term, def] = TIPS[i];
  return (
    <div role="status" aria-live="polite" className={`rounded-xl border border-white/[0.08] bg-[#060a14] p-4 ${className}`}>
      <div className="flex items-center gap-2 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--accent)]">
        <span className="term-pulse inline-block h-2 w-2 rounded-full bg-[var(--accent)]" aria-hidden="true" />
        {label}<span className="term-dots" aria-hidden="true" />
      </div>
      <div className="term-scan mt-3 h-1 overflow-hidden rounded-full bg-white/[0.06]" aria-hidden="true" />
      {!compact && (
        <p key={term} className="term-fade mt-3 text-xs leading-relaxed text-[var(--text-muted)]">
          <span className="font-semibold text-[var(--text)]">While you wait · {term}:</span> {def}
        </p>
      )}
    </div>
  );
}
