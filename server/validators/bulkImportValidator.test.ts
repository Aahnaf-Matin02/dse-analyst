import { describe, it, expect, vi } from "vitest";
import { validateBulkImport } from "./bulkImportValidator";

describe("validateBulkImport Unit Tests", () => {
  it("should pass when given a valid payload with recognized symbol and valid rows", () => {
    const payload = {
      symbol: "GP",
      rows: [
        {
          date: "2026-06-01",
          open: 250,
          high: 255,
          low: 248,
          close: 252,
          volume: 1000
        },
        {
          date: "2026-06-02",
          open: 252,
          high: 258,
          low: 250,
          close: 256,
          volume: 1200
        }
      ]
    };

    const result = validateBulkImport(payload);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("should fail when ticker symbol is missing or empty", () => {
    const payload = {
      symbol: "",
      rows: [
        {
          date: "2026-06-01",
          open: 100,
          high: 105,
          low: 95,
          close: 102,
          volume: 500
        }
      ]
    };

    const result = validateBulkImport(payload);
    expect(result.valid).toBe(false);
    expect(result.errors.some(err => err.field === "symbol")).toBe(true);
  });

  it("should fail when the ticker symbol is unrecognized", () => {
    const payload = {
      symbol: "NON_EXISTING_Ticker_ZZZ",
      rows: [
        {
          date: "2026-06-01",
          open: 100,
          high: 105,
          low: 95,
          close: 102,
          volume: 500
        }
      ]
    };

    const result = validateBulkImport(payload);
    expect(result.valid).toBe(false);
    expect(result.errors.some(err => err.field === "symbol")).toBe(true);
  });

  it("should fail when rows array is empty", () => {
    const payload = {
      symbol: "GP",
      rows: []
    };

    const result = validateBulkImport(payload);
    expect(result.valid).toBe(false);
    expect(result.errors.some(err => err.field === "rows")).toBe(true);
  });

  it("should fail when rows is not an array", () => {
    const payload = {
      symbol: "GP",
      rows: {}
    };

    const result = validateBulkImport(payload);
    expect(result.valid).toBe(false);
    expect(result.errors.some(err => err.field === "rows")).toBe(true);
  });

  it("should fail when a row has a future date", () => {
    // Current local date mock context is 2026-06-08 (from system prompt metadata)
    const payload = {
      symbol: "GP",
      rows: [
        {
          date: "3026-12-31", // Far in the future
          open: 100,
          high: 105,
          low: 95,
          close: 102,
          volume: 500
        }
      ]
    };

    const result = validateBulkImport(payload);
    expect(result.valid).toBe(false);
    expect(result.errors.some(err => err.field === "date" && err.reason.includes("future"))).toBe(true);
  });

  it("should fail when logical boundaries are violated (high < low)", () => {
    const payload = {
      symbol: "GP",
      rows: [
        {
          date: "2026-06-01",
          open: 100,
          high: 90, // Lower than low
          low: 95,
          close: 98,
          volume: 500
        }
      ]
    };

    const result = validateBulkImport(payload);
    expect(result.valid).toBe(false);
    expect(result.errors.some(err => err.field === "high" && err.reason.includes("less than Low"))).toBe(true);
  });

  it("should fail when logical boundaries are violated (high < open or high < close)", () => {
    const payload = {
      symbol: "GP",
      rows: [
        {
          date: "2026-06-01",
          open: 110, // Higher than high
          high: 105,
          low: 95,
          close: 102,
          volume: 500
        }
      ]
    };

    const result = validateBulkImport(payload);
    expect(result.valid).toBe(false);
    expect(result.errors.some(err => err.field === "high" && err.reason.includes("Open"))).toBe(true);
  });

  it("should fail when duplicate dates are detected in payload for the same symbol", () => {
    const payload = {
      symbol: "GP",
      rows: [
        {
          date: "2026-06-01",
          open: 100,
          high: 105,
          low: 95,
          close: 102,
          volume: 500
        },
        {
          date: "2026-06-01", // Duplicate
          open: 102,
          high: 108,
          low: 98,
          close: 105,
          volume: 600
        }
      ]
    };

    const result = validateBulkImport(payload);
    expect(result.valid).toBe(false);
    expect(result.errors.some(err => err.field === "date" && err.reason.includes("Duplicate"))).toBe(true);
  });

  it("should fail when volume is invalid or negative", () => {
    const payload = {
      symbol: "GP",
      rows: [
        {
          date: "2026-06-01",
          open: 100,
          high: 105,
          low: 95,
          close: 102,
          volume: -50 // Negative
        }
      ]
    };

    const result = validateBulkImport(payload);
    expect(result.valid).toBe(false);
    expect(result.errors.some(err => err.field === "volume" && err.reason.includes("Volume"))).toBe(true);
  });
});
