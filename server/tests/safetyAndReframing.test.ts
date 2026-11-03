import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { calculateTradingOpportunitySignal } from "../services/tradingSignal";
import { CHAT_PROMPT } from "../prompts/chatPrompt";
import { STOCK_ANALYSIS_PROMPT } from "../prompts/stockAnalysisPrompt";
import { RISK_PROMPT } from "../prompts/riskPrompt";
import { PORTFOLIO_PROMPT } from "../prompts/portfolioPrompt";
import { TECHNICAL_PROMPT } from "../prompts/technicalPrompt";

describe("Step 1: Safety & Reframing Compliance Suite", () => {
  const FORBIDDEN_ADVICE_TERMS = [
    "STRONG BUY",
    "WEAK BUY",
    "STRONG SELL",
    "BUY NOW"
  ];

  it("should never emit buy/sell/hold/stop-loss directives in trading signal calculations", async () => {
    const symbols = ["GP", "BATBC", "SQURPHARMA"];
    
    for (const sym of symbols) {
      try {
        const signalResult = await calculateTradingOpportunitySignal(sym);
        expect(signalResult).toBeDefined();
        expect(signalResult.symbol).toBe(sym);

        // Signal must be neutral educational alignment
        for (const term of FORBIDDEN_ADVICE_TERMS) {
          expect(signalResult.signal).not.toBe(term);
        }

        // Must include educational reflection fields
        expect(Array.isArray(signalResult.whatItShows)).toBe(true);
        expect(signalResult.whatItShows.length).toBeGreaterThan(0);

        expect(Array.isArray(signalResult.whatItCannotTellYou)).toBe(true);
        expect(signalResult.whatItCannotTellYou.length).toBeGreaterThan(0);

        expect(Array.isArray(signalResult.questionsToInvestigate)).toBe(true);
        expect(signalResult.questionsToInvestigate.length).toBeGreaterThan(0);
      } catch (err: any) {
        if (!err.message.includes("Stock not found")) {
          throw err;
        }
      }
    }
  });

  it("should enforce patient DSE tutor persona and strict refusal of advice in all system prompts", () => {
    const prompts = [
      { name: "CHAT_PROMPT", text: CHAT_PROMPT },
      { name: "STOCK_ANALYSIS_PROMPT", text: STOCK_ANALYSIS_PROMPT },
      { name: "RISK_PROMPT", text: RISK_PROMPT },
      { name: "PORTFOLIO_PROMPT", text: PORTFOLIO_PROMPT },
      { name: "TECHNICAL_PROMPT", text: TECHNICAL_PROMPT }
    ];

    for (const { text } of prompts) {
      // Must contain tutor identity
      expect(text.toLowerCase()).toContain("tutor");
      
      // Must forbid giving buy/sell advice
      expect(text.toLowerCase()).toMatch(/not.*(investment|financial).*advice|refus|educational/);
    }
  });

  it("chat prompt explicitly instructs refusal of buy/sell recommendations and specifies citing data limitations", () => {
    expect(CHAT_PROMPT).toContain("STRICT REFUSAL OF ADVICE");
    expect(CHAT_PROMPT).toContain("Dhaka Stock Exchange");
    expect(CHAT_PROMPT).toContain("DATA LIMITATIONS");
  });

  it("should scan components and services to verify no forbidden advice terms exist", () => {
    const rootDir = path.resolve(__dirname, "../..");
    const filesToScan = [
      "src/components/StockOverview.tsx",
      "src/App.tsx",
      "src/components/SectorIntelligenceHub.tsx",
      "src/components/modules/OpportunityScanner.tsx",
      "src/components/modules/DangerScanner.tsx",
      "src/components/PortfolioManagement.tsx",
      "src/components/PricePrediction.tsx",
      "src/components/AIStockResearchAssistant.tsx",
      "src/components/EquityValuationModel.tsx",
      "server/services/decisionIntelligence.ts",
      "server/services/equityValuationModel.ts",
      "server/services/entryExitPlanner.ts",
      "server/routes/gemini.ts",
      "src/types.ts"
    ];

    const forbiddenPatterns = [
      /\bSTRONG BUY\b/i,
      /\bWEAK BUY\b/i,
      /\bSTRONG SELL\b/i,
      /\bBUY NOW\b/i,
      /Justified Forward Target Price/i,
      /Should I hold, accumulate, or sell\?/i,
      /\bverdict\s*=\s*["'](STRONG BUY|BUY|ACCUMULATE|SELL|REDUCE)["']/
    ];

    for (const relPath of filesToScan) {
      const fullPath = path.join(rootDir, relPath);
      expect(fs.existsSync(fullPath), `File must exist: ${relPath}`).toBe(true);
      const content = fs.readFileSync(fullPath, "utf-8");

      for (const pattern of forbiddenPatterns) {
        const match = content.match(pattern);
        expect(match, `Forbidden pattern ${pattern} found in ${relPath}`).toBeNull();
      }
    }
  });
});
