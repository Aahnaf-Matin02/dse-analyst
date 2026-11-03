export interface ValidationIssue {
  field: string;
  value: any;
  rule: string;
  severity: "error" | "warning";
}

export interface ValidationResult<T> {
  isValid: boolean;
  sanitized: T;
  issues: ValidationIssue[];
}

export class DseValidator {
  /**
   * Validates and sanitizes a market snapshot row or candle.
   */
  static validateMarketCandle(candle: {
    symbol: string;
    date: string;
    open: number | null;
    high: number | null;
    low: number | null;
    close: number | null;
    volume: number | null;
    trades?: number | null;
  }): ValidationResult<typeof candle> {
    const issues: ValidationIssue[] = [];
    const sanitized = { ...candle };

    // Symbol validation
    if (!sanitized.symbol || typeof sanitized.symbol !== "string" || sanitized.symbol.trim().length === 0) {
      issues.push({ field: "symbol", value: sanitized.symbol, rule: "Symbol must be non-empty string", severity: "error" });
    } else {
      sanitized.symbol = sanitized.symbol.toUpperCase().trim();
    }

    // Date validation
    if (!sanitized.date || isNaN(Date.parse(sanitized.date))) {
      issues.push({ field: "date", value: sanitized.date, rule: "Date must be a valid ISO or parseable date string", severity: "error" });
    }

    // Numbers sanity
    const checkPositiveOrZero = (field: "open" | "high" | "low" | "close" | "volume" | "trades") => {
      const val = sanitized[field];
      if (val !== null && val !== undefined) {
        if (typeof val !== "number" || isNaN(val) || val < 0) {
          issues.push({ field, value: val, rule: `${field} must be a non-negative number`, severity: "error" });
          (sanitized as any)[field] = null;
        }
      }
    };

    checkPositiveOrZero("open");
    checkPositiveOrZero("high");
    checkPositiveOrZero("low");
    checkPositiveOrZero("close");
    checkPositiveOrZero("volume");
    checkPositiveOrZero("trades");

    // OHLC Relationship consistency: high >= max(open, close, low), low <= min(open, close, high)
    const { open, high, low, close } = sanitized;
    if (high !== null && low !== null) {
      if (high < low) {
        issues.push({ field: "high/low", value: { high, low }, rule: "High cannot be less than low", severity: "error" });
      }
    }

    if (high !== null) {
      const comparePoints = [open, close, low].filter((v): v is number => v !== null);
      if (comparePoints.length > 0) {
        const maxVal = Math.max(...comparePoints);
        if (high < maxVal - 0.001) {
          issues.push({ field: "high", value: { high, maxVal }, rule: "High must be greater than or equal to open, close, and low", severity: "warning" });
          sanitized.high = Math.max(high, maxVal); // heal upward
        }
      }
    }

    if (low !== null) {
      const comparePoints = [open, close, high].filter((v): v is number => v !== null);
      if (comparePoints.length > 0) {
        const minVal = Math.min(...comparePoints);
        if (low > minVal + 0.001) {
          issues.push({ field: "low", value: { low, minVal }, rule: "Low must be less than or equal to open, close, and high", severity: "warning" });
          sanitized.low = Math.min(low, minVal); // heal downward
        }
      }
    }

    const hasErrors = issues.some(i => i.severity === "error");
    return {
      isValid: !hasErrors,
      sanitized,
      issues
    };
  }

  /**
   * Validates official reported financial metrics without inventing or fabricating missing fields.
   */
  static validateReportedMetrics(metrics: {
    symbol: string;
    peRatio: number | null;
    eps: number | null;
    nav: number | null;
    dividendYield: number | null;
    marketCap: number | null;
  }): ValidationResult<typeof metrics> {
    const issues: ValidationIssue[] = [];
    const sanitized = { ...metrics };

    const checkNullableNumber = (field: "peRatio" | "eps" | "nav" | "dividendYield" | "marketCap", minAllowed: number, maxAllowed: number) => {
      const val = sanitized[field];
      if (val !== null && val !== undefined) {
        if (typeof val !== "number" || isNaN(val) || !isFinite(val)) {
          issues.push({ field, value: val, rule: `${field} must be a valid finite number`, severity: "error" });
          sanitized[field] = null;
        } else if (val < minAllowed || val > maxAllowed) {
          issues.push({ field, value: val, rule: `${field} out of plausible bounds (${minAllowed} to ${maxAllowed})`, severity: "warning" });
        }
      }
    };

    checkNullableNumber("peRatio", -100, 1000);
    checkNullableNumber("eps", -500, 2000);
    checkNullableNumber("nav", -100, 5000);
    checkNullableNumber("dividendYield", 0, 100);
    checkNullableNumber("marketCap", 0, 1e14);

    const hasErrors = issues.some(i => i.severity === "error");
    return {
      isValid: !hasErrors,
      sanitized,
      issues
    };
  }
}
