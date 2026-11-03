// Single source of truth for subscription plans and their daily AI quotas.
// Used by the billing routes and by the Gemini quota middleware, so advertised and enforced limits match.
export const PLANS = {
  free: {
    name: "Free Basic Tier",
    priceBDT: 0,
    aiDailyLimit: 5,
    features: ["Standard watchlist", "Basic stock analytics", "Daily summary"]
  },
  premium: {
    name: "Premium Individual",
    priceBDT: 999,
    aiDailyLimit: 100,
    features: ["Intraday Ticker Tape", "100 AI queries/day", "Fundamental & DCF Models", "Email alerts"]
  },
  professional: {
    name: "Professional Trader",
    priceBDT: 2499,
    aiDailyLimit: 500,
    features: ["Unlimited AI scans", "Breakout Scanners", "Black-Litterman Portfolio Optimization", "Stress Testing Models"]
  },
  institutional: {
    name: "Institutional Enterprise",
    priceBDT: 9999,
    aiDailyLimit: 5000,
    features: ["Multi-seat integration", "Broker connection layer", "Priority API access", "Full PDF research export"]
  }
} as const;

export type PlanTier = keyof typeof PLANS;
