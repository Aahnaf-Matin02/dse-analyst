import { planEntryExit } from "./entryExitPlanner";
import { RiskRewardResult, RiskRewardCombination } from "../../src/types";

export async function calculateRiskReward(symbol: string): Promise<RiskRewardResult> {
  const sym = symbol.toUpperCase().trim();
  const plan = await planEntryExit(sym);

  const targets = [
    { label: "Target 1 (R1)", price: plan.targets.t1 },
    { label: "Target 2 (R2)", price: plan.targets.t2 },
    { label: "Target 3 (BB)", price: plan.targets.t3 }
  ];

  const configs = [
    { entryType: "Aggressive Entry", entryPrice: plan.entryZone.aggressive, stopType: "Tight Stop", stopPrice: plan.stopLoss.tight },
    { entryType: "Conservative Entry", entryPrice: plan.entryZone.conservative, stopType: "Normal Stop", stopPrice: plan.stopLoss.normal },
    { entryType: "Conservative Entry", entryPrice: plan.entryZone.conservative, stopType: "Wide Stop", stopPrice: plan.stopLoss.wide }
  ];

  const combinations: RiskRewardCombination[] = [];

  for (const config of configs) {
    for (const target of targets) {
      const reward = Math.max(0, target.price - config.entryPrice);
      const risk = Math.max(0.01, config.entryPrice - config.stopPrice);
      const ratio = reward / risk;

      let quality: RiskRewardCombination["quality"] = "Poor";
      if (ratio >= 3.0) quality = "Excellent";
      else if (ratio >= 2.0) quality = "Good";
      else if (ratio >= 1.5) quality = "Acceptable";

      combinations.push({
        entryType: config.entryType,
        stopType: config.stopType,
        target: target.label,
        entryPrice: config.entryPrice,
        stopPrice: config.stopPrice,
        targetPrice: target.price,
        reward: parseFloat(reward.toFixed(2)),
        risk: parseFloat(risk.toFixed(2)),
        ratio: parseFloat(ratio.toFixed(2)),
        quality
      });
    }
  }

  // Filter combinations of quality >= Acceptable (RR >= 1.5) and choose the one with the highest ratio
  const acceptableCombos = combinations.filter(c => c.ratio >= 1.5);
  let bestCombination: RiskRewardCombination | null = null;
  if (acceptableCombos.length > 0) {
    bestCombination = acceptableCombos.reduce((best, cur) => cur.ratio > best.ratio ? cur : best, acceptableCombos[0]);
  } else {
    // If no combination is acceptable style, select highest overall ratio
    bestCombination = combinations.reduce((best, cur) => cur.ratio > best.ratio ? cur : best, combinations[0]);
  }

  // Generate educational explanation of the risk-reward model
  let recommendation = "";
  if (bestCombination && bestCombination.ratio >= 2.0) {
    recommendation = `Educational Analysis: The technical boundaries demonstrate a wide theoretical upside-to-downside ratio of ${bestCombination.ratio.toFixed(2)}:1 (${bestCombination.quality} theoretical asymmetry based on reference bands). What this shows: distance between mathematical support (৳${bestCombination.stopPrice.toFixed(2)}) and resistance (৳${bestCombination.targetPrice.toFixed(2)}). What it cannot tell you: future market direction or regulatory impacts. Questions to investigate: Does current trading volume corroborate momentum?`;
  } else if (bestCombination && bestCombination.ratio >= 1.5) {
    recommendation = `Educational Analysis: The model reflects a moderate theoretical upside-to-downside ratio of ${bestCombination.ratio.toFixed(2)}:1 (${bestCombination.quality}). What this shows: price is situated midway between technical pivot boundaries. What it cannot tell you: macro shifts in sector performance. Questions to investigate: Are earnings and dividend payouts sustainable?`;
  } else {
    recommendation = `Educational Analysis: The modeled upside-to-downside ratio is constrained (< 1.5:1). What this shows: the current price trades close to historical resistance with wider downside distance to support. What it cannot tell you: sudden news catalysts. Questions to investigate: Has the sector experienced liquidity contraction?`;
  }

  return {
    symbol: sym,
    combinations,
    bestCombination,
    recommendation
  };
}
