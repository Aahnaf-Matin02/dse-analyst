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
      className="group rounded-3xl border border-[var(--border)] bg-[var(--surface)]/40"
    >
      <summary className="list-none cursor-pointer select-none flex items-center justify-between gap-3 px-5 py-4 min-h-[56px] rounded-3xl hover:bg-white/[0.03] [&::-webkit-details-marker]:hidden">
        <span>
          <span className="block text-base font-semibold text-[var(--text)]">{title}</span>
          {hint && <span className="block text-sm text-[var(--text-muted)] mt-0.5">{hint}</span>}
        </span>
        <ChevronDown className="h-5 w-5 text-[var(--text-subtle)] transition-transform group-open:rotate-180" aria-hidden="true" />
      </summary>
      <div className="px-2 sm:px-3 pb-3">{everOpened ? children : null}</div>
    </details>
  );
}
