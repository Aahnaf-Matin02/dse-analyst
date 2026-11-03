// Forgiving stock search: exact ticker > ticker prefix > name/word prefix > substring > typo-tolerant match.

export interface Searchable {
  symbol: string;
  name?: string;
  sector?: string;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Optimal-string-alignment (Damerau–Levenshtein) distance, capped for speed. */
export function editDistance(a: string, b: string, max = 3): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    let rowMin = Infinity;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      rowMin = Math.min(rowMin, d[i][j]);
    }
    if (rowMin > max) return max + 1;
  }
  return d[a.length][b.length];
}

/** Score how well a stock matches a query (0 = no match). */
export function scoreStock(item: Searchable, rawQuery: string): number {
  const q = norm(rawQuery);
  if (!q) return 0;
  const sym = norm(item.symbol);
  const name = (item.name || "").toLowerCase();
  const nameNorm = norm(name);
  const words = name.split(/[^a-z0-9]+/).filter(Boolean);

  if (sym === q) return 1000;
  if (sym.startsWith(q)) return 900 - (sym.length - q.length);
  if (nameNorm.startsWith(q)) return 800;
  if (words.some(w => w.startsWith(q))) return 700;
  if (sym.includes(q)) return 600;
  if (q.length >= 3 && nameNorm.includes(q)) return 500;

  // Typo tolerance: compare against the ticker, each name word, and the name prefix of similar length
  if (q.length >= 4) {
    const allowed = q.length >= 7 ? 2 : 1;
    const candidates = [sym, ...words, nameNorm.slice(0, q.length), nameNorm.slice(0, q.length + 1)];
    let best = allowed + 1;
    for (const c of candidates) if (c) best = Math.min(best, editDistance(q, c, allowed));
    if (best <= allowed) return 300 - best * 50;
  }
  return 0;
}

export function searchStocks<T extends Searchable>(items: T[], query: string, limit = 8): T[] {
  if (!norm(query)) return [];
  return items
    .map(item => ({ item, score: scoreStock(item, query) }))
    .filter(r => r.score > 0)
    .sort((a, b) => b.score - a.score || a.item.symbol.localeCompare(b.item.symbol))
    .slice(0, limit)
    .map(r => r.item);
}

const RECENT_KEY = "dse_recent_searches";

export function loadRecentSearches(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
    return Array.isArray(v) ? v.filter(x => typeof x === "string").slice(0, 6) : [];
  } catch {
    return [];
  }
}

export function pushRecentSearch(symbol: string): string[] {
  const next = [symbol, ...loadRecentSearches().filter(s => s !== symbol)].slice(0, 6);
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)); } catch { /* storage unavailable */ }
  return next;
}
