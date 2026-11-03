import React, { useState } from "react";
import { ChevronDown } from "lucide-react";

/**
 * Collapsible section (native <details>) for progressive disclosure of advanced content.
 * Children are only mounted once the section is first opened, so collapsed panels cost no
 * downloads, data requests or rendering on page load.
 */
export function Section({ title, hint, defaultOpen = false, children }: { title: string; hint?: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [everOpened, setEverOpened] = useState(defaultOpen);
  return (
    <details
      open={defaultOpen}
      onToggle={(e) => { if ((e.currentTarget as HTMLDetailsElement).open) setEverOpened(true); }}
      className="group rounded-xl border border-[var(--border)] bg-[var(--surface)]"
    >
      <summary className="list-none cursor-pointer select-none flex items-center justify-between gap-3 px-4 py-3 min-h-[52px] rounded-xl hover:bg-[#FFB020]/[0.04] group-open:rounded-b-none group-open:border-b group-open:border-[var(--border)] [&::-webkit-details-marker]:hidden">
        <span>
          <span className="block font-mono text-xs font-bold uppercase tracking-[0.14em] text-[var(--accent)]">{title}</span>
          {hint && <span className="block text-sm text-[var(--text-muted)] mt-0.5">{hint}</span>}
        </span>
        <ChevronDown className="h-5 w-5 text-[var(--text-subtle)] transition-transform group-open:rotate-180" aria-hidden="true" />
      </summary>
      <div className="p-2 sm:p-3">{everOpened ? children : null}</div>
    </details>
  );
}
