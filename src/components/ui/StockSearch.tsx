import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { Search, Clock, X } from "lucide-react";
import { StockData } from "../../types";
import { searchStocks, loadRecentSearches, pushRecentSearch } from "../../utils/searchStocks";

interface StockSearchProps {
  stocks: StockData[];
  onSelect: (symbol: string) => void;
  placeholder?: string;
  size?: "md" | "lg";
  /** Register the "/" keyboard shortcut to focus this field (enable on one instance per page). */
  slashShortcut?: boolean;
  autoFocus?: boolean;
  className?: string;
  label?: string;
}

/**
 * Accessible stock search combobox: ticker or company name, typo tolerant, ↑/↓/Enter/Esc, recent searches.
 */
export function StockSearch({
  stocks,
  onSelect,
  placeholder = "Search by ticker or company, e.g. GP or Grameenphone",
  size = "md",
  slashShortcut = false,
  autoFocus = false,
  className = "",
  label = "Search DSE stocks",
}: StockSearchProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [recent, setRecent] = useState<string[]>(() => loadRecentSearches());
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const results = useMemo(() => searchStocks(stocks, query, 8), [stocks, query]);
  const recentItems = useMemo(
    () => recent.map(sym => stocks.find(s => s.symbol === sym)).filter(Boolean) as StockData[],
    [recent, stocks]
  );
  const showingRecent = query.trim() === "" && recentItems.length > 0;
  const items = showingRecent ? recentItems : results;

  useEffect(() => setActive(0), [query]);

  // "/" focuses search (ignored while typing in another field)
  useEffect(() => {
    if (!slashShortcut) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const typing = t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);
      if (e.key === "/" && !typing && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [slashShortcut]);

  // Close when clicking outside
  useEffect(() => {
    const onDown = (e: MouseEvent) => { if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const choose = (symbol: string) => {
    setRecent(pushRecentSearch(symbol));
    setQuery("");
    setOpen(false);
    inputRef.current?.blur();
    onSelect(symbol);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setActive(i => Math.min(i + 1, Math.max(items.length - 1, 0))); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive(i => Math.max(i - 1, 0)); }
    else if (e.key === "Enter") { if (open && items[active]) { e.preventDefault(); choose(items[active].symbol); } }
    else if (e.key === "Escape") { if (query) setQuery(""); else { setOpen(false); inputRef.current?.blur(); } }
  };

  const isLg = size === "lg";
  const expanded = open && (items.length > 0 || query.trim().length > 0);

  return (
    <div ref={wrapRef} className={`relative ${className}`}>
      <label className="sr-only" htmlFor={`${listId}-input`}>{label}</label>
      <div className="relative">
        <Search className={`absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-subtle)] ${isLg ? "h-5 w-5" : "h-4 w-4"}`} aria-hidden="true" />
        <input
          ref={inputRef}
          id={`${listId}-input`}
          type="search"
          role="combobox"
          aria-expanded={expanded}
          aria-controls={`${listId}-list`}
          aria-autocomplete="list"
          aria-activedescendant={expanded && items[active] ? `${listId}-opt-${active}` : undefined}
          autoComplete="off"
          spellCheck={false}
          autoFocus={autoFocus}
          value={query}
          placeholder={placeholder}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          className={`w-full bg-[var(--surface-2)] text-[var(--text)] placeholder-[var(--text-subtle)] border border-[var(--border-strong)] focus:border-[var(--accent)] outline-none rounded-xl transition-colors ${
            isLg ? "h-14 pl-12 pr-14 text-base" : "h-10 pl-10 pr-10 text-sm"
          }`}
        />
        {slashShortcut && !query && (
          <kbd className="hidden md:inline-flex absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[var(--text-subtle)] border border-[var(--border-strong)] rounded px-1.5 py-0.5" aria-hidden="true">/</kbd>
        )}
        {query && (
          <button type="button" onClick={() => { setQuery(""); inputRef.current?.focus(); }} aria-label="Clear search"
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-[var(--text-subtle)] hover:text-[var(--text)]">
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>

      {expanded && (
        <div className="absolute left-0 right-0 mt-2 z-50 rounded-2xl border border-[var(--border-strong)] bg-[var(--surface)] shadow-2xl overflow-hidden">
          {showingRecent && <p className="px-4 pt-3 pb-1 text-xs text-[var(--text-subtle)] flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" aria-hidden="true" /> Recent</p>}
          {items.length === 0 ? (
            <div className="px-4 py-4 text-sm" role="status">
              <p className="text-[var(--text)]">No DSE stock matches “{query}”.</p>
              <p className="text-[var(--text-muted)] mt-1">Try a ticker such as <strong>GP</strong> or part of a company name, e.g. <strong>Square</strong>.</p>
            </div>
          ) : (
            <ul id={`${listId}-list`} role="listbox" aria-label={showingRecent ? "Recent searches" : "Matching stocks"} className="max-h-80 overflow-y-auto py-1">
              {items.map((item, i) => {
                const up = (item.changePercent || 0) >= 0;
                return (
                  <li
                    key={item.symbol}
                    id={`${listId}-opt-${i}`}
                    role="option"
                    aria-selected={i === active}
                    onMouseDown={e => { e.preventDefault(); choose(item.symbol); }}
                    onMouseEnter={() => setActive(i)}
                    className={`px-4 py-2.5 min-h-[48px] flex items-center justify-between gap-3 cursor-pointer ${i === active ? "bg-white/[0.07]" : ""}`}
                  >
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-[var(--text)]">{item.symbol}</span>
                      <span className="block text-xs text-[var(--text-muted)] truncate">{item.name}</span>
                    </span>
                    {item.price > 0 && (
                      <span className="text-right shrink-0">
                        <span className="block text-sm text-[var(--text)]">৳{item.price.toFixed(2)}</span>
                        <span className={`block text-xs ${up ? "text-[var(--up)]" : "text-[var(--down)]"}`}>
                          <span aria-hidden="true">{up ? "▲" : "▼"}</span> {up ? "+" : ""}{(item.changePercent || 0).toFixed(2)}%
                        </span>
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
