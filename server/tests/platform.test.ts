import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import fs from "fs";
import path from "path";
import * as cheerio from "cheerio";
import { HistoryRepository } from "../repositories/historyRepository";
import { PORTFOLIO_PROMPT } from "../prompts/portfolioPrompt";
import { STOCK_ANALYSIS_PROMPT } from "../prompts/stockAnalysisPrompt";

describe("DSE AI Analyst Platform Test Suite", () => {
  // Test 1: Historical Data Repository Logic
  describe("HistoryRepository", () => {
    const mockJsonSymbol = "MOCKTESTSYM";
    const testDir = path.join(process.cwd(), "data", "history");
    const testJsonPath = path.join(testDir, `${mockJsonSymbol}.json`);

    beforeAll(() => {
      if (!fs.existsSync(testDir)) {
        fs.mkdirSync(testDir, { recursive: true });
      }
      // Save mock historical records in unsorted format
      const mockBars = [
        { date: "2025-06-03", open: 120.5, high: 125, low: 119.5, close: 124.0, volume: 10000 },
        { date: "2025-06-01", open: 110.0, high: 115, low: 109.0, close: 112.5, volume: 8000 },
        { date: "2025-06-02", open: 115.0, high: 121, low: 114.5, close: 120.0, volume: 12000 }
      ];
      fs.writeFileSync(testJsonPath, JSON.stringify(mockBars), "utf-8");
    });

    afterAll(() => {
      if (fs.existsSync(testJsonPath)) {
        fs.unlinkSync(testJsonPath);
      }
    });

    it("should successfully read, parse, and chronologically sort historical JSON data (ascending)", () => {
      const result = HistoryRepository.getHistoricalData(mockJsonSymbol);
      expect(result.source).toBe("HistoricalData");
      expect(result.data).toHaveLength(3);
      
      // Chronological ascending check: 2025-06-01 -> 2025-06-02 -> 2025-06-03
      expect(result.data[0].date).toBe("2025-06-01");
      expect(result.data[1].date).toBe("2025-06-02");
      expect(result.data[2].date).toBe("2025-06-03");

      expect(result.data[0].close).toBe(112.5);
      expect(result.data[2].close).toBe(124);
    });

    it("should return empty array and 'NoHistoricalData' source for non-existent stock symbols", () => {
      const result = HistoryRepository.getHistoricalData("NONEXISTENTSYMBOLXYZ");
      expect(result.source).toBe("NoHistoricalData");
      expect(result.data).toEqual([]);
    });
  });

  // Test 2: HTML Scraper Parser Integrity
  describe("DSE HTML Ticker Scraper Parser", () => {
    it("should correctly parse corporate elements and stock attributes out of raw DSE PHP HTML grid structure", () => {
      const mockHtml = `
        <html>
          <body>
            <table>
              <tr>
                <td>1</td>
                <td><a href="displayCompany.php?name=GP">GP</a></td>
                <td>320.50</td> <!-- LTP -->
                <td>325.00</td> <!-- High -->
                <td>319.00</td> <!-- Low -->
                <td>318.00</td> <!-- Close -->
                <td>318.40</td> <!-- YCP -->
                <td>+2.10</td>  <!-- Change -->
                <td>4,500</td>  <!-- Trades -->
                <td>120,400</td> <!-- Value in BDT -->
                <td>1,502,400</td> <!-- Volume -->
              </tr>
              <tr>
                <td>2</td>
                <td><a href="displayCompany.php?name=SQURPHARMA">SQURPHARMA</a></td>
                <td>245.00</td>
                <td>246.50</td>
                <td>244.00</td>
                <td>243.50</td>
                <td>243.80</td>
                <td>+1.20</td>
                <td>2,100</td>
                <td>95,450</td>
                <td>678,250</td>
              </tr>
            </table>
          </body>
        </html>
      `;

      const $ = cheerio.load(mockHtml);
      const anchors = $('a[href^="displayCompany.php?name="]');
      expect(anchors).toHaveLength(2);

      const scrapedList: any[] = [];
      anchors.each((_, a) => {
        const href = $(a).attr("href") || "";
        const symbol = href.split("=").pop()?.trim().toUpperCase();
        const row = $(a).closest("tr");
        const cells = row.find("td");

        if (cells.length >= 8) {
          const ltp = parseFloat($(cells.eq(2)).text().replace(/,/g, "").trim());
          const high = parseFloat($(cells.eq(3)).text().replace(/,/g, "").trim());
          const low = parseFloat($(cells.eq(4)).text().replace(/,/g, "").trim());
          const ycp = parseFloat($(cells.eq(6)).text().replace(/,/g, "").trim());
          const change = parseFloat($(cells.eq(7)).text().replace(/,/g, "").trim());
          const trades = parseInt($(cells.eq(8)).text().replace(/,/g, "").trim(), 10);
          const volume = parseInt($(cells.eq(10)).text().replace(/,/g, "").trim(), 10);

          scrapedList.push({ symbol, ltp, high, low, ycp, change, trades, volume });
        }
      });

      expect(scrapedList).toHaveLength(2);
      expect(scrapedList[0].symbol).toBe("GP");
      expect(scrapedList[0].ltp).toBe(320.5);
      expect(scrapedList[0].high).toBe(325.0);
      expect(scrapedList[0].change).toBe(2.1);
      expect(scrapedList[0].trades).toBe(4500);
      expect(scrapedList[0].volume).toBe(1502400);

      expect(scrapedList[1].symbol).toBe("SQURPHARMA");
      expect(scrapedList[1].ltp).toBe(245.0);
      expect(scrapedList[1].volume).toBe(678250);
    });
  });

  // Test 3: Centralized Gemini Prompt System Templates
  describe("Prompt Template Verification", () => {
    it("should guarantee that central templates contain mandatory constraints and structured definitions", () => {
      // Portfolio optimization prompt template verification
      expect(PORTFOLIO_PROMPT).toContain("Dhaka Stock Exchange");
      expect(PORTFOLIO_PROMPT).toContain("JSON");
      expect(PORTFOLIO_PROMPT).toContain("allocation");
      expect(PORTFOLIO_PROMPT).toContain("diversificationScore");

      // Fundamental and overview analysis template checks
      expect(STOCK_ANALYSIS_PROMPT).toContain("trend");
      expect(STOCK_ANALYSIS_PROMPT).toContain("technicalView");
      expect(STOCK_ANALYSIS_PROMPT).toContain("fundamentalView");
      expect(STOCK_ANALYSIS_PROMPT).toContain("riskScore");
      expect(STOCK_ANALYSIS_PROMPT).toContain("bullishCase");
    });
  });

  // Test 4: Financial Mathematics Constraints (Portfolio Allocation Sums)
  describe("Financial Math Allocation Constraint Rules", () => {
    it("should distribute assets with allocating multipliers and ensure the final sum does not violate bounds", () => {
      const budget = 500000;
      const targetAllocation = [
        { symbol: "GP", weight: 30 },
        { symbol: "SQURPHARMA", weight: 25 },
        { symbol: "BRACBANK", weight: 20 },
        { symbol: "BATBC", weight: 15 },
        { symbol: "RENATA", weight: 10 }
      ];

      const sumWeights = targetAllocation.reduce((sum, item) => sum + item.weight, 0);
      expect(sumWeights).toBe(100);

      const calculatedAllocations = targetAllocation.map(item => ({
        symbol: item.symbol,
        allocatedAmount: (budget * item.weight) / 100
      }));

      const sumAllocatedBill = calculatedAllocations.reduce((sum, item) => sum + item.allocatedAmount, 0);
      expect(sumAllocatedBill).toBe(budget);
      expect(calculatedAllocations[0].allocatedAmount).toBe(150000);
      expect(calculatedAllocations[4].allocatedAmount).toBe(50000);
    });
  });
});
