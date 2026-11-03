import { DSE_COMPANIES } from "../../src/data/dseData";
import { DSE_SECTOR_MAP } from "../../src/data/dseSectors";

export interface FieldError {
  field?: string;
  row?: number;
  reason: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: FieldError[];
}

/**
 * Validates the bulk historical OHLCV data payload.
 * Pure function with no side-effects or DB calls.
 * 
 * @param payload The request body payload
 * @returns ValidationResult containing validation outcome and error list
 */
export function validateBulkImport(payload: unknown): ValidationResult {
  const errors: FieldError[] = [];

  if (!payload || typeof payload !== "object") {
    errors.push({ reason: "Payload must be a valid JSON object." });
    return { valid: false, errors };
  }

  const typedPayload = payload as Record<string, any>;
  const symbol = typedPayload.symbol;

  if (typeof symbol !== "string" || !symbol.trim()) {
    errors.push({ field: "symbol", reason: "Ticker symbol is required and must be a string." });
  } else {
    const upperSymbol = symbol.toUpperCase().trim();
    const existsInCompanies = Object.prototype.hasOwnProperty.call(DSE_COMPANIES, upperSymbol);
    const existsInSectors = Object.prototype.hasOwnProperty.call(DSE_SECTOR_MAP, upperSymbol);
    if (!existsInCompanies && !existsInSectors) {
      errors.push({ field: "symbol", reason: `Symbol '${upperSymbol}' is not a recognized DSE ticker.` });
    }
  }

  const rows = typedPayload.rows;
  if (!Array.isArray(rows)) {
    errors.push({ field: "rows", reason: "Rows must be a non-empty array." });
    return { valid: false, errors };
  }

  if (rows.length === 0) {
    errors.push({ field: "rows", reason: "Rows array must not be empty." });
  }

  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  const seenDates = new Set<string>();
  const today = new Date();
  // Safe end-of-day boundary for 'today'
  today.setHours(23, 59, 59, 999);

  rows.forEach((row, index) => {
    if (!row || typeof row !== "object") {
      errors.push({ row: index, reason: `Row at index ${index} must be an object.` });
      return;
    }

    const date = row.date;
    if (typeof date !== "string" || !dateRegex.test(date.trim())) {
      errors.push({ row: index, field: "date", reason: "Date must be a string in YYYY-MM-DD format." });
    } else {
      const trimmedDate = date.trim();
      const parsedDate = new Date(trimmedDate);
      if (isNaN(parsedDate.getTime())) {
        errors.push({ row: index, field: "date", reason: `Date '${trimmedDate}' is not a valid calendar date.` });
      } else if (parsedDate > today) {
        errors.push({ row: index, field: "date", reason: `Date '${trimmedDate}' cannot be in the future.` });
      } else {
        if (seenDates.has(trimmedDate)) {
          errors.push({ row: index, field: "date", reason: `Duplicate date '${trimmedDate}' detected in payload.` });
        } else {
          seenDates.add(trimmedDate);
        }
      }
    }

    // Checking numeric properties
    const open = row.open;
    const high = row.high;
    const low = row.low;
    const close = row.close;
    const volume = row.volume;

    const opOk = typeof open === "number" && !isNaN(open) && open > 0;
    const hiOk = typeof high === "number" && !isNaN(high) && high > 0;
    const loOk = typeof low === "number" && !isNaN(low) && low > 0;
    const clOk = typeof close === "number" && !isNaN(close) && close > 0;
    const voOk = typeof volume === "number" && !isNaN(volume) && volume >= 0 && Number.isInteger(volume);

    if (!opOk) {
      errors.push({ row: index, field: "open", reason: "Open price must be a positive number." });
    }
    if (!hiOk) {
      errors.push({ row: index, field: "high", reason: "High price must be a positive number." });
    }
    if (!loOk) {
      errors.push({ row: index, field: "low", reason: "Low price must be a positive number." });
    }
    if (!clOk) {
      errors.push({ row: index, field: "close", reason: "Close price must be a positive number." });
    }
    if (!voOk) {
      errors.push({ row: index, field: "volume", reason: "Volume must be a non-negative integer." });
    }

    // High/Low logical constraints
    if (hiOk && loOk && high < low) {
      errors.push({ row: index, field: "high", reason: `Bound violation: High price (${high}) is less than Low price (${low}).` });
    }
    if (hiOk && opOk && high < open) {
      errors.push({ row: index, field: "high", reason: `Bound violation: High price (${high}) is less than Open price (${open}).` });
    }
    if (hiOk && clOk && high < close) {
      errors.push({ row: index, field: "high", reason: `Bound violation: High price (${high}) is less than Close price (${close}).` });
    }
    if (loOk && opOk && low > open) {
      errors.push({ row: index, field: "low", reason: `Bound violation: Low price (${low}) is greater than Open price (${open}).` });
    }
    if (loOk && clOk && low > close) {
      errors.push({ row: index, field: "low", reason: `Bound violation: Low price (${low}) is greater than Close price (${close}).` });
    }
  });

  return {
    valid: errors.length === 0,
    errors
  };
}
