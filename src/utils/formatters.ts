export function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function formatNumber(value: unknown, decimals = 2): string {
  return isFiniteNumber(value) ? value.toFixed(decimals) : "N/A";
}

export function formatPrice(value: unknown): string {
  return isFiniteNumber(value) ? `BDT ${value.toFixed(2)}` : "N/A";
}

export function formatPercent(value: unknown, decimals = 2): string {
  return isFiniteNumber(value) ? `${value >= 0 ? "+" : ""}${value.toFixed(decimals)}%` : "N/A";
}

export function formatPlainPercent(value: unknown, decimals = 2): string {
  return isFiniteNumber(value) ? `${value.toFixed(decimals)}%` : "N/A";
}

export function formatMarketCap(value: unknown): string {
  if (typeof value === "number" && Number.isFinite(value)) {
    if (value >= 1_000_000_000_000) {
      return `BDT ${(value / 1_000_000_000_000).toFixed(2)}T`;
    }
    if (value >= 1_000_000_000) {
      return `BDT ${(value / 1_000_000_000).toFixed(2)}B`;
    }
    if (value >= 1_000_000) {
      return `BDT ${(value / 1_000_000).toFixed(2)}M`;
    }
    return `BDT ${value.toLocaleString()}`;
  }
  if (typeof value === "string" && value.trim() && value !== "N/A") return value;
  return "N/A";
}

export function formatVolume(value: unknown): string {
  if (!isFiniteNumber(value)) return "N/A";
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toLocaleString();
}
