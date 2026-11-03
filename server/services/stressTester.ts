import { getStockBySymbol } from "../repositories/stockRepository";
import { getStockHistory, getIndexHistory } from "../repositories/historicalRepository";
import { StressTestResult, StressScenario } from "../../src/types";

interface InputHolding {
  symbol: string;
  quantity: number;
  buyPrice: number;
}

/**
 * Calculates historical statistical Beta of a stock vs DSEX index over 120 trading days
 */
export function calculateStockBeta(symbol: string): number {
  const sym = symbol.toUpperCase().trim();
  const sHist = getStockHistory(sym, 120);
  const iHist = getIndexHistory("DSEX", 120);

  const sData = sHist.data || [];
  const iData = iHist.data || [];

  if (sData.length < 15 || iData.length < 15) {
    // Return standard sector-average default betas
    const stock = getStockBySymbol(sym);
    if (!stock) return 1.0;
    if (stock.sector === "Financial Institutions" || stock.sector === "Bank") return 1.15;
    if (stock.sector === "Pharmaceuticals & Chemicals" || stock.sector === "Telecommunication") return 0.75;
    return 1.0;
  }

  // Align dates
  const iMap = new Map<string, number>();
  iData.forEach(r => {
    if (r.changePercent !== null && r.changePercent !== undefined) {
      iMap.set(r.date, r.changePercent);
    }
  });

  const matchedPairs: { stockRet: number; indexRet: number }[] = [];
  sData.forEach(r => {
    const idxRet = iMap.get(r.date);
    if (idxRet !== undefined && r.changePercent !== null && r.changePercent !== undefined) {
      matchedPairs.push({
        stockRet: r.changePercent,
        indexRet: idxRet
      });
    }
  });

  if (matchedPairs.length < 10) {
    return 1.0;
  }

  // Beta = Covariance(stock, index) / Variance(index)
  const meanStock = matchedPairs.reduce((sum, p) => sum + p.stockRet, 0) / matchedPairs.length;
  const meanIndex = matchedPairs.reduce((sum, p) => sum + p.indexRet, 0) / matchedPairs.length;

  let cov = 0;
  let varIdx = 0;

  matchedPairs.forEach(p => {
    const diffStock = p.stockRet - meanStock;
    const diffIdx = p.indexRet - meanIndex;
    cov += diffStock * diffIdx;
    varIdx += diffIdx * diffIdx;
  });

  if (varIdx === 0) return 1.0;
  
  const beta = cov / varIdx;
  // Bounded within safety levels
  return Math.max(0.1, Math.min(2.5, parseFloat(beta.toFixed(2))));
}

export function runStressTesting(holdings: InputHolding[]): StressTestResult {
  if (!holdings || holdings.length === 0) {
    return {
      scenarios: [],
      overallRiskRating: "Low",
      mostVulnerable: [],
      mostResilient: []
    };
  }

  // Pre-calculate current values and beta for all holdings
  const enrichedHoldings = holdings.map(h => {
    const sym = h.symbol.toUpperCase().trim();
    const stock = getStockBySymbol(sym);
    const sector = stock?.sector || "Miscellaneous";
    const currentPrice = stock?.price ?? h.buyPrice;
    const value = h.quantity * currentPrice;
    const beta = calculateStockBeta(sym);
    const divYield = stock?.divYield ?? 0;
    const pe = stock?.peRatio ?? 15;

    return {
      symbol: sym,
      quantity: h.quantity,
      currentPrice,
      value,
      sector,
      beta,
      divYield,
      pe
    };
  });

  const totalPortfolioValue = enrichedHoldings.reduce((sum, h) => sum + h.value, 0);

  // Core Scenario Definitions & Handlers
  const scenariosDefinitions = [
    {
      name: "Scenario 1 — DSE Market Crash",
      description: "A sudden systemic liquidity shock causing DSEX to fall 20% over 30 days. Tested on asset high-beta multipliers.",
      calculator: (h: typeof enrichedHoldings[0]) => {
        // -20% * beta
        const pct = -20 * h.beta;
        return {
          impact: parseFloat(pct.toFixed(2)),
          reason: `Systemic shock. Beta of ${h.beta.toFixed(1)}x amplified the index 20% drop to ${pct.toFixed(1)}%.`
        };
      }
    },
    {
      name: "Scenario 2 — Bangladesh Taka Depreciation",
      description: "A sharp 15% currency depreciation of BDT against USD. Impacts raw material import-dependent sectors vs exporters.",
      calculator: (h: typeof enrichedHoldings[0]) => {
        let pct = -8; // generic default
        let reason = "Standard industrial adjustment under foreign exchange reserve compression.";

        if (h.sector === "Cement" || h.sector === "Engineering") {
          pct = -20;
          reason = "Severely affected by steep clinker/steel raw import inflation costs and BDT hedging failure.";
        } else if (h.sector === "Fuel & Power") {
          pct = -12;
          reason = "Fuel purchase dollar liquidity requirements create margin strain.";
        } else if (h.sector === "Textile") {
          pct = 6;
          reason = "Export-oriented sector gains positive conversion benefits on dollar-denominated garments sales.";
        } else if (h.sector === "Jute") {
          pct = 8;
          reason = "Agricultural exports experience positive price elasticity and domestic procurement advantages.";
        } else if (h.sector === "Pharmaceuticals & Chemicals") {
          pct = -4;
          reason = "Partially offset import API (Active Ingredients) inflation with growing export sales volumes.";
        }

        return { impact: pct, reason };
      }
    },
    {
      name: "Scenario 3 — Interest Rate Shock (+300bps)",
      description: "Central bank raises policy/SMART interest rate by +300bps to combat core inflation, leading to valuation multiple decompression.",
      calculator: (h: typeof enrichedHoldings[0]) => {
        let pct = -10;
        let reason = "Moderate multiple contraction due to increased opportunity cost of equity.";

        if (h.sector === "Bank" || h.sector === "Financial Institutions") {
          pct = -15;
          reason = "Yield cost-of-deposit margins compressed by strict interest caps, leading to PE compression.";
        } else if (h.pe > 25) {
          pct = -20;
          reason = "High-multiple growth stocks undergo severe discounted cash flow valuation haircuts under high discount rates.";
        } else if (h.divYield >= 6.0) {
          pct = -5;
          reason = "Protected by defensive premium yield (৳ yield >= 6%), resisting capital flight.";
        }

        return { impact: pct, reason };
      }
    },
    {
      name: "Scenario 4 — Inflation Shock (CPI +8%)",
      description: "Consumer price index flies another +8%, decreasing household purchasing power and margins on industrial inputs.",
      calculator: (h: typeof enrichedHoldings[0]) => {
        let pct = -6;
        let reason = "General operational cost increases across service supply chains.";

        if (h.sector === "Food & Allied" || h.sector === "Miscellaneous") {
          pct = -10;
          reason = "FMCG margins deteriorate. Inability to instantly pass full raw commodity increases to end consumers.";
        } else if (h.sector === "Fuel & Power") {
          pct = -8;
          reason = "Regulated pricing caps delay cost pass-through options on utility generation pipelines.";
        } else if (h.sector === "Services & Real Estate" || h.sector === "Cement") {
          pct = -12;
          reason = "Real estate capital expenditures inflate highly, depressing construction project start rates.";
        }

        return { impact: pct, reason };
      }
    },
    {
      name: "Scenario 5 — Political Instability",
      description: "Escalated domestic political blockades or disruptions, causing market-wide volume dryups.",
      calculator: (h: typeof enrichedHoldings[0]) => {
        let pct = -10;
        let reason = "Standard sovereign geopolitical discount applied across corporate segments.";

        if (h.sector === "Travel & Leisure" || h.sector === "Services & Real Estate") {
          pct = -18;
          reason = "Severe transport halts and logistical shutdowns fully freeze active leisure and distribution networks.";
        } else if (h.sector === "Pharmaceuticals & Chemicals" || h.sector === "Telecommunication") {
          pct = -5;
          reason = "Highly defensive essential consumables. Demand remains sticky despite geopolitical disruption boundaries.";
        }

        return { impact: pct, reason };
      }
    },
    {
      name: "Scenario 6 — Global Recession",
      description: "Global macro slowdown hits international trade volumes, affecting RMG exports and foreign remittance receipts.",
      calculator: (h: typeof enrichedHoldings[0]) => {
        let pct = -10;
        let reason = "Moderate impact from domestic macro cooling.";

        if (h.sector === "Textile" || h.sector === "Jute") {
          pct = -25;
          reason = "Severe order cancelations from Western retailers hit revenues and capacities deeply.";
        } else if (h.sector === "Bank" || h.sector === "Insurance") {
          pct = -10;
          reason = "General trade financing volumes shrink, lowering fee revenues.";
        } else if (h.sector === "Information Technology") {
          pct = -15;
          reason = "Foreign outsourcing agencies downsize off-shore developer contracts to preserve baseline budgets.";
        }

        return { impact: pct, reason };
      }
    }
  ];

  const scenarios: StressScenario[] = [];
  const symbolVulnerabilityCount: Record<string, number> = {};
  const symbolResilienceCount: Record<string, number> = {};

  scenariosDefinitions.forEach(def => {
    let scenarioLoss = 0;
    const holdingImpacts = enrichedHoldings.map(h => {
      const calc = def.calculator(h);
      const loss = h.value * (calc.impact / 100);
      scenarioLoss += loss;

      return {
        symbol: h.symbol,
        impact: calc.impact,
        loss: parseFloat(loss.toFixed(2)),
        reason: calc.reason
      };
    });

    const portfolioImpact = totalPortfolioValue > 0 ? (scenarioLoss / totalPortfolioValue) * 100 : 0;
    const projectedValue = totalPortfolioValue + scenarioLoss;

    // Pick best and worst holdings
    const sortedImpacts = [...holdingImpacts].sort((a, b) => a.impact - b.impact); // ascending meaning worst (most negative) is index 0
    const worstHolding = sortedImpacts[0]?.symbol || "N/A";
    const bestResistingHolding = sortedImpacts[sortedImpacts.length - 1]?.symbol || "N/A";

    // Count vulnerability flags
    if (sortedImpacts[0]) {
      symbolVulnerabilityCount[worstHolding] = (symbolVulnerabilityCount[worstHolding] || 0) + 1;
    }
    if (sortedImpacts[sortedImpacts.length - 1]) {
      symbolResilienceCount[bestResistingHolding] = (symbolResilienceCount[bestResistingHolding] || 0) + 1;
    }

    scenarios.push({
      name: def.name,
      description: def.description,
      portfolioImpact: parseFloat(portfolioImpact.toFixed(2)),
      estimatedLoss: parseFloat(scenarioLoss.toFixed(2)),
      projectedValue: parseFloat(projectedValue.toFixed(2)),
      worstHolding,
      bestResistingHolding,
      holdingImpacts
    });
  });

  // Calculate Overall Risk Rating based on worst scenario portfolio impact
  const worstScenarioImpact = Math.min(...scenarios.map(s => s.portfolioImpact));
  let overallRiskRating: StressTestResult["overallRiskRating"] = "Low";

  if (worstScenarioImpact <= -15.0) overallRiskRating = "Critical";
  else if (worstScenarioImpact <= -10.0) overallRiskRating = "High";
  else if (worstScenarioImpact <= -5.0) overallRiskRating = "Moderate";

  // Vulnerable list sorted by frequency
  const mostVulnerable = Object.entries(symbolVulnerabilityCount)
    .sort((a, b) => b[1] - a[1])
    .map(entry => entry[0])
    .slice(0, 3);

  // Resilient list sorted by frequency
  const mostResilient = Object.entries(symbolResilienceCount)
    .sort((a, b) => b[1] - a[1])
    .map(entry => entry[0])
    .slice(0, 3);

  return {
    scenarios,
    overallRiskRating,
    mostVulnerable,
    mostResilient
  };
}
