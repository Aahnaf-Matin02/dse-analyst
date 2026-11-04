import React from "react";
import { AlertTriangle, Clock, Inbox, RefreshCw, Radio, WifiOff, CircleDot } from "lucide-react";
import { FeedState, formatDhakaDateTime, sourceLabel } from "../../utils/marketStatus";

/** "Updated 4 Oct 2026, 2:40 PM · Source: DSE (old.dsebd.org)" — one consistent freshness line for data panels */
export function FreshnessLine({ updatedAt, source, label, className = "" }: { updatedAt?: string | null; source?: string | null; label?: string; className?: string }) {
  const when = updatedAt ? (formatDhakaDateTime(updatedAt) ?? updatedAt) : null;
  return (
    <p className={`text-xs text-[var(--text-muted)] flex flex-wrap items-center gap-x-1.5 ${className}`}>
      <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>{label ?? "Updated"} {when ?? "time unknown"}</span>
      <span aria-hidden="true">·</span>
      <span>Source: {sourceLabel(source)}</span>
    </p>
  );
}

const FEED_STYLES: Record<FeedState, { text: string; cls: string; Icon: React.ComponentType<any> }> = {
  live: { text: "Market open · live", cls: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30", Icon: Radio },
  closed: { text: "Market closed", cls: "bg-slate-500/15 text-slate-200 border-slate-400/30", Icon: CircleDot },
  delayed: { text: "Delayed · saved data", cls: "bg-amber-500/10 text-amber-300 border-amber-500/30", Icon: Clock },
  offline: { text: "Offline · saved data", cls: "bg-rose-500/10 text-rose-300 border-rose-500/30", Icon: WifiOff },
  unknown: { text: "Checking status…", cls: "bg-slate-500/10 text-slate-300 border-slate-500/20", Icon: Clock },
};

/** Icon + text status chip (never colour alone). Never says "live" for cached or closed-market data. */
export function MarketStatusChip({ state, detail }: { state: FeedState; detail?: string | null }) {
  const s = FEED_STYLES[state];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold ${s.cls}`} role="status">
      <s.Icon className="h-3.5 w-3.5" aria-hidden="true" />
      <span>{s.text}{detail ? <span className="font-normal opacity-90"> · {detail}</span> : null}</span>
    </span>
  );
}

export const Skeleton: React.FC<{ className?: string }> = ({ className = "" }) => {
  return <div className={`skeleton rounded-lg ${className}`} aria-hidden="true" />;
}

/** Card-shaped loading placeholder with a screen-reader message */
export function SkeletonCard({ lines = 3, label = "Loading", className = "" }: { lines?: number; label?: string; className?: string }) {
  return (
    <div className={`rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 space-y-3 ${className}`} role="status" aria-live="polite">
      <span className="sr-only">{label}…</span>
      <Skeleton className="h-4 w-1/3" />
      {Array.from({ length: lines }).map((_, i) => <Skeleton key={i} className={`h-3 ${i % 2 ? "w-2/3" : "w-full"}`} />)}
    </div>
  );
}

export function EmptyState({ title, message, action, icon: Icon = Inbox }: { title: string; message?: string; action?: React.ReactNode; icon?: React.ComponentType<any> }) {
  return (
    <div className="rounded-2xl border border-dashed border-[var(--border-strong)] bg-[var(--surface)]/60 p-6 text-center flex flex-col items-center gap-2">
      <Icon className="h-6 w-6 text-[var(--text-muted)]" aria-hidden="true" />
      <p className="text-sm font-semibold text-[var(--text)]">{title}</p>
      {message && <p className="text-sm text-[var(--text-muted)] max-w-md">{message}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ title = "Something went wrong", message, onRetry }: { title?: string; message?: string; onRetry?: () => void }) {
  return (
    <div className="rounded-2xl border border-rose-500/30 bg-rose-500/5 p-5 flex flex-col sm:flex-row sm:items-center gap-3" role="alert">
      <AlertTriangle className="h-5 w-5 text-rose-300 shrink-0" aria-hidden="true" />
      <div className="flex-1">
        <p className="text-sm font-semibold text-rose-200">{title}</p>
        {message && <p className="text-sm text-[var(--text-muted)] mt-0.5">{message}</p>}
      </div>
      {onRetry && (
        <button type="button" onClick={onRetry} className="btn-secondary">
          <RefreshCw className="h-4 w-4" aria-hidden="true" /> Try again
        </button>
      )}
    </div>
  );
}
