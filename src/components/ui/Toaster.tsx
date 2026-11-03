import React, { useEffect, useState } from "react";
import { CheckCircle2, Info, X } from "lucide-react";

export interface ToastOptions {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  kind?: "success" | "info";
  durationMs?: number;
}

const EVENT = "app-toast";

/** Show a toast from anywhere (no context wiring needed). */
export function toast(opts: ToastOptions) {
  window.dispatchEvent(new CustomEvent<ToastOptions>(EVENT, { detail: opts }));
}

/** Renders toasts in a polite live region; each can carry an action such as Undo. */
export function Toaster() {
  const [items, setItems] = useState<(ToastOptions & { id: number })[]>([]);

  useEffect(() => {
    const onToast = (e: Event) => {
      const detail = (e as CustomEvent<ToastOptions>).detail;
      const id = Date.now() + Math.random();
      setItems(prev => [...prev.slice(-2), { ...detail, id }]);
      setTimeout(() => setItems(prev => prev.filter(t => t.id !== id)), detail.durationMs ?? 6000);
    };
    window.addEventListener(EVENT, onToast);
    return () => window.removeEventListener(EVENT, onToast);
  }, []);

  return (
    <div aria-live="polite" role="status" className="fixed z-[60] bottom-20 lg:bottom-6 left-3 right-3 sm:left-auto sm:right-6 sm:w-96 flex flex-col gap-2 pointer-events-none">
      {items.map(t => (
        <div key={t.id} className="pointer-events-auto flex items-center gap-3 rounded-2xl border border-[var(--border-strong)] bg-[#0B1222] px-4 py-3 shadow-2xl text-sm text-[var(--text)]">
          {t.kind === "info" ? <Info className="h-5 w-5 text-[var(--accent)] shrink-0" aria-hidden="true" /> : <CheckCircle2 className="h-5 w-5 text-[var(--up)] shrink-0" aria-hidden="true" />}
          <span className="flex-1">{t.message}</span>
          {t.actionLabel && t.onAction && (
            <button type="button" className="font-semibold text-[var(--accent)] hover:underline min-h-[44px] px-2" onClick={() => { t.onAction?.(); setItems(prev => prev.filter(x => x.id !== t.id)); }}>
              {t.actionLabel}
            </button>
          )}
          <button type="button" aria-label="Dismiss" className="p-2 text-[var(--text-subtle)] hover:text-[var(--text)]" onClick={() => setItems(prev => prev.filter(x => x.id !== t.id))}>
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      ))}
    </div>
  );
}

/** Network status banner: calm, non-blocking, never replaces the page. */
export function OfflineBanner() {
  const [online, setOnline] = useState(typeof navigator === "undefined" ? true : navigator.onLine);
  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => { window.removeEventListener("online", up); window.removeEventListener("offline", down); };
  }, []);
  if (online) return null;
  return (
    <div role="status" className="w-full bg-amber-400/10 border-b border-amber-400/30 text-amber-100 text-sm px-4 py-2 text-center">
      You're offline. You can keep browsing what's already loaded; numbers may be out of date until the connection returns.
    </div>
  );
}
