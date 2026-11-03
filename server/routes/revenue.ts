import { Router, Response } from "express";
import { UserRepository } from "../repositories/userRepository";
import { authenticateToken, AuthenticatedRequest, requireEmailVerified } from "../middleware/auth";

const router = Router();

// Mock verified coupons
const ACTIVE_COUPONS: Record<string, { discountPercent: number; description: string }> = {
  "LAUNCH50": { discountPercent: 50, description: "50% launch discount for early adopters" },
  "COMPCOFOUNDER": { discountPercent: 100, description: "100% discount for special testing" },
  "TRADERPRO": { discountPercent: 20, description: "20% professional trader coupon" }
};

// Plan detail descriptors
const PLANS = {
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
};

/**
 * GET /api/revenue/plans
 * Exposes product plan definitions
 */
router.get("/plans", (req, res) => {
  return res.json({ success: true, plans: PLANS });
});

/**
 * POST /api/revenue/coupon
 * Validates a coupon code
 */
router.post("/coupon", (req, res) => {
  const { code } = req.body;
  if (!code || typeof code !== "string") {
    return res.status(400).json({ error: "Coupon code parameter is required." });
  }

  const normalized = code.toUpperCase().trim();
  const coupon = ACTIVE_COUPONS[normalized];

  if (!coupon) {
    return res.status(404).json({ error: "Invalid coupon code. Please try another one." });
  }

  return res.json({
    success: true,
    code: normalized,
    discountPercent: coupon.discountPercent,
    description: coupon.description
  });
});

/**
 * POST /api/revenue/subscribe
 * Processes mock integrated payments for bKash, Nagad, Rocket, SSLCommerz, and Stripe card checkout.
 */
router.post("/subscribe", authenticateToken as any, requireEmailVerified as any, (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const email = req.userEmail;
    if (!email) {
      return res.status(401).json({ error: "Unauthorized session context." });
    }

    const { tier, paymentMethod, transactionId, paymentDetails, couponCode } = req.body;

    if (!tier || !["free", "premium", "professional", "institutional"].includes(tier)) {
      return res.status(400).json({ error: "Invalid plan tier requested." });
    }

    if (tier !== "free" && (!paymentMethod || !transactionId)) {
      return res.status(400).json({ error: "Payment verification details (paymentMethod, transactionId) are required." });
    }

    // Validate coupon if applied
    let discount = 0;
    if (couponCode) {
      const normalizedCoupon = couponCode.toUpperCase().trim();
      if (ACTIVE_COUPONS[normalizedCoupon]) {
        discount = ACTIVE_COUPONS[normalizedCoupon].discountPercent;
      }
    }

    const basePrice = PLANS[tier as keyof typeof PLANS].priceBDT;
    const finalPrice = Math.round(basePrice * (1 - discount / 100));

    // Expiration date (30 days from now)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    // Update in user repository
    const success = UserRepository.updateUserSubscription(
      email,
      tier as any,
      "active",
      expiresAt.toISOString()
    );

    if (!success) {
      return res.status(500).json({ error: "Failed to update user profile billing state." });
    }

    const updatedUser = UserRepository.getByEmail(email);

    return res.json({
      success: true,
      message: `Successfully upgraded to ${PLANS[tier as keyof typeof PLANS].name}.`,
      finalPrice,
      paymentMethod,
      transactionId,
      expiresAt: expiresAt.toISOString(),
      user: {
        email: updatedUser?.email,
        name: updatedUser?.name,
        tier: updatedUser?.tier,
        subscriptionStatus: updatedUser?.subscriptionStatus,
        subscriptionExpiresAt: updatedUser?.subscriptionExpiresAt
      }
    });

  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/revenue/billing-status
 * Queries user subscription status, limit counters, and options
 */
router.get("/billing-status", authenticateToken as any, (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const email = req.userEmail;
    if (!email) {
      return res.status(401).json({ error: "Unauthorized session context." });
    }

    const user = UserRepository.getByEmail(email);
    if (!user) {
      return res.status(404).json({ error: "User no longer exists." });
    }

    const currentTier = user.tier || "free";
    const planDetails = PLANS[currentTier as keyof typeof PLANS];

    return res.json({
      success: true,
      tier: currentTier,
      status: user.subscriptionStatus || "active",
      expiresAt: user.subscriptionExpiresAt || "",
      aiDailyLimit: planDetails.aiDailyLimit,
      aiUsageToday: user.aiUsageCount || 0,
      planDetails
    });
  } catch (err) {
    next(err);
  }
});

export const RevenueRouter = router;
