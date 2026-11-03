import { describe, it, expect } from "vitest";
import { searchStocks, editDistance, scoreStock } from "./searchStocks";

const STOCKS = [
  { symbol: "GP", name: "Grameenphone Ltd." },
  { symbol: "GPHISPAT", name: "GPH Ispat Ltd" },
  { symbol: "SQURPHARMA", name: "Square Pharmaceuticals Ltd" },
  { symbol: "BATBC", name: "British American Tobacco Bangladesh" },
  { symbol: "KAY&QUE", name: "Kay & Que (Bangladesh) Ltd" },
  { symbol: "AMCL(PRAN)", name: "Agricultural Marketing Co. Ltd. (PRAN)" },
];

describe("stock search ranking", () => {
  it("puts the exact ticker first", () => {
    expect(searchStocks(STOCKS, "gp")[0].symbol).toBe("GP");
    expect(searchStocks(STOCKS, "GP").map(s => s.symbol)).toEqual(["GP", "GPHISPAT"]);
  });

  it("finds companies by name and by a word inside the name", () => {
    expect(searchStocks(STOCKS, "grameen")[0].symbol).toBe("GP");
    expect(searchStocks(STOCKS, "square pharma")[0].symbol).toBe("SQURPHARMA");
    expect(searchStocks(STOCKS, "tobacco")[0].symbol).toBe("BATBC");
  });

  it("tolerates common typos", () => {
    expect(searchStocks(STOCKS, "grameenfone")[0]?.symbol).toBe("GP");
    expect(searchStocks(STOCKS, "sqaure")[0]?.symbol).toBe("SQURPHARMA");
    expect(searchStocks(STOCKS, "batbs")[0]?.symbol).toBe("BATBC");
  });

  it("handles symbols with special characters", () => {
    expect(searchStocks(STOCKS, "kay&que")[0].symbol).toBe("KAY&QUE");
    expect(searchStocks(STOCKS, "amcl")[0].symbol).toBe("AMCL(PRAN)");
  });

  it("returns nothing for nonsense and empty queries", () => {
    expect(searchStocks(STOCKS, "zzzz")).toEqual([]);
    expect(searchStocks(STOCKS, "  ")).toEqual([]);
    expect(scoreStock(STOCKS[0], "")).toBe(0);
  });

  it("computes edit distance with transpositions", () => {
    expect(editDistance("square", "sqaure")).toBe(1);
    expect(editDistance("grameenfone", "grameenphone")).toBe(2);
  });
});
