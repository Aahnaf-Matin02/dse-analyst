import React, { useState, useEffect } from "react";
import { Check, Crown, Zap, Sparkles, Lock, Shield, AlertCircle, CreditCard, Smartphone, X, Gift } from "lucide-react";

interface SubscriptionBillingPortalProps {
  currentUser: { email: string; name: string; tier?: string; subscriptionStatus?: string; subscriptionExpiresAt?: string } | null;
  authToken: string | null;
  onClose: () => void;
  onUpgradeSuccess: (updatedUser: any) => void;
}

export default function SubscriptionBillingPortal({
  currentUser,
  authToken,
  onClose,
  onUpgradeSuccess
}: SubscriptionBillingPortalProps) {
  const [plans, setPlans] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<any>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [couponLoading, setCouponLoading] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<string>("premium");
  
  // Checkout/Payment states
  const [paymentStep, setPaymentStep] = useState<"plans" | "checkout" | "simulation" | "success">("plans");
  const [paymentMethod, setPaymentMethod] = useState<"bkash" | "nagad" | "rocket" | "stripe">("bkash");
  
  // Simulation Form states
  const [mobileNumber, setMobileNumber] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [pinCode, setPinCode] = useState("");
  const [cardName, setCardName] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvv, setCardCvv] = useState("");
  
  const [processingPayment, setProcessingPayment] = useState(false);
  const [subscriptionDetails, setSubscriptionDetails] = useState<any>(null);

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/revenue/plans");
      if (res.ok) {
        const data = await res.json();
        setPlans(data.plans);
      } else {
        setError("Failed to retrieve product plans. Please reload.");
      }
    } catch (err) {
      setError("Network error occurred while fetching billing info.");
    } finally {
      setLoading(false);
    }
  };

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) return;
    setCouponLoading(true);
    setCouponError(null);
    try {
      const res = await fetch("/api/revenue/coupon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: couponCode })
      });
      const data = await res.json();
      if (res.ok) {
        setAppliedCoupon(data);
        setCouponError(null);
      } else {
        setCouponError(data.error || "Invalid coupon code.");
        setAppliedCoupon(null);
      }
    } catch (err) {
      setCouponError("Failed to validate coupon code.");
    } finally {
      setCouponLoading(false);
    }
  };

  const calculatePrice = (planId: string) => {
    if (!plans) return 0;
    const basePrice = plans[planId]?.priceBDT || 0;
    if (appliedCoupon) {
      return Math.round(basePrice * (1 - appliedCoupon.discountPercent / 100));
    }
    return basePrice;
  };

  const handleBeginCheckout = (planId: string) => {
    setSelectedPlanId(planId);
    setPaymentStep("checkout");
  };

  const handleStartSimulation = () => {
    setPaymentStep("simulation");
    setOtpSent(false);
  };

  const handleSendOtpSimulation = () => {
    if (!mobileNumber || mobileNumber.length < 11) {
      alert("Please enter a valid 11-digit Bangladeshi mobile number.");
      return;
    }
    setOtpSent(true);
  };

  const handleCompleteSimulation = async () => {
    setProcessingPayment(true);
    try {
      const mockTxId = `TXN-${paymentMethod.toUpperCase()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
      
      const response = await fetch("/api/revenue/subscribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${authToken}`
        },
        body: JSON.stringify({
          tier: selectedPlanId,
          paymentMethod,
          transactionId: mockTxId,
          couponCode: appliedCoupon?.code || null,
          paymentDetails: {
            mobileNumber: mobileNumber || null,
            cardName: cardName || null
          }
        })
      });

      const data = await response.json();
      if (response.ok) {
        setSubscriptionDetails(data);
        setPaymentStep("success");
        onUpgradeSuccess(data.user);
      } else {
        alert(data.message || data.error || "Payment verification failed. Please try again.");
      }
    } catch (err) {
      alert("An unexpected error occurred during subscription upgrade.");
    } finally {
      setProcessingPayment(false);
    }
  };

  const getTierIcon = (tierId: string) => {
    switch (tierId) {
      case "free": return <Zap className="w-5 h-5 text-gray-400" />;
      case "premium": return <Crown className="w-5 h-5 text-yellow-500" />;
      case "professional": return <Sparkles className="w-5 h-5 text-blue-400" />;
      case "institutional": return <Shield className="w-5 h-5 text-purple-500" />;
      default: return <Zap className="w-5 h-5 text-gray-400" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" id="subscription-billing-portal">
      <div className="relative w-full max-w-4xl overflow-hidden border border-gray-800 rounded-xl bg-gray-950 text-gray-100 flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-900 bg-gray-900/50">
          <div className="flex items-center gap-3">
            <Crown className="w-6 h-6 text-yellow-500 animate-pulse" />
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-white font-sans">
                {paymentStep === "success" ? "Upgrade Completed" : "Premium Subscription Portal"}
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Current Plan: <span className="font-semibold text-yellow-500 uppercase">{currentUser?.tier || "free"}</span>
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-all"
            id="close-billing-portal-btn"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Inner Content Area */}
        <div className="flex-1 overflow-y-auto p-6">
          
          {loading && (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-10 h-10 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-sm text-gray-400 mt-4">Retrieving pricing configurations...</p>
            </div>
          )}

          {error && (
            <div className="p-4 border border-red-900/50 bg-red-950/20 rounded-lg flex items-start gap-3 my-10 max-w-md mx-auto">
              <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-400">Loading Error</p>
                <p className="text-xs text-red-500 mt-1">{error}</p>
              </div>
            </div>
          )}

          {!loading && !error && plans && (
            <>
              {/* STEP 1: Plan selector visual grid */}
              {paymentStep === "plans" && (
                <div>
                  <div className="text-center mb-8">
                    <h3 className="text-lg font-medium text-white">Select a tier optimized for your trading scale</h3>
                    <p className="text-sm text-gray-400 mt-1">Gives you live AI analysis, predictive models, and risk controllers</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {Object.entries(plans).map(([planId, plan]: [string, any]) => {
                      const isCurrent = currentUser?.tier === planId;
                      const isPremiumOption = planId !== "free";
                      return (
                        <div 
                          key={planId} 
                          className={`relative flex flex-col justify-between p-5 rounded-xl border transition-all ${
                            isCurrent 
                              ? "border-green-600 bg-green-950/10" 
                              : planId === "premium"
                                ? "border-yellow-600/50 bg-yellow-950/5 shadow-[0_0_15px_rgba(234,179,8,0.05)]"
                                : "border-gray-800 hover:border-gray-700 bg-gray-900/30"
                          }`}
                        >
                          {planId === "premium" && (
                            <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-2.5 py-0.5 text-[10px] font-semibold text-yellow-950 bg-yellow-500 rounded-full uppercase tracking-wider">
                              Most Popular
                            </div>
                          )}

                          <div>
                            <div className="flex items-center gap-2 mb-2">
                              {getTierIcon(planId)}
                              <h4 className="text-sm font-semibold text-white uppercase">{planId}</h4>
                            </div>
                            <p className="text-[11px] text-gray-400 h-10 mb-3">{plan.name}</p>

                            <div className="mb-4">
                              <span className="text-2xl font-bold text-white">BDT {plan.priceBDT}</span>
                              <span className="text-xs text-gray-400">/mo</span>
                            </div>

                            <ul className="space-y-2 mb-6">
                              {plan.features.map((feat: string, i: number) => (
                                <li key={i} className="flex items-start gap-2 text-xs text-gray-300">
                                  <Check className="w-3.5 h-3.5 text-green-500 shrink-0 mt-0.5" />
                                  <span>{feat}</span>
                                </li>
                              ))}
                            </ul>
                          </div>

                          <button
                            onClick={() => handleBeginCheckout(planId)}
                            disabled={isCurrent || planId === "free"}
                            className={`w-full py-2 rounded-lg text-xs font-semibold transition-all ${
                              isCurrent 
                                ? "bg-green-900/20 text-green-400 border border-green-800 cursor-default"
                                : planId === "free"
                                  ? "bg-gray-800 text-gray-500 cursor-not-allowed"
                                  : "bg-yellow-500 hover:bg-yellow-400 text-gray-950 hover:shadow-[0_0_10px_rgba(234,179,8,0.2)]"
                            }`}
                          >
                            {isCurrent ? "Active Plan" : planId === "free" ? "Default Tier" : "Upgrade Plan"}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* STEP 2: Checkout Information / Promos */}
              {paymentStep === "checkout" && (
                <div className="max-w-2xl mx-auto bg-gray-900/30 border border-gray-800 rounded-xl p-6">
                  <div className="flex items-center justify-between pb-4 border-b border-gray-800 mb-5">
                    <div>
                      <h3 className="text-base font-semibold text-white">Checkout Review</h3>
                      <p className="text-xs text-gray-400">Review selected plan & apply launch promotions</p>
                    </div>
                    <button 
                      onClick={() => setPaymentStep("plans")}
                      className="text-xs text-yellow-500 hover:underline"
                    >
                      Change Plan
                    </button>
                  </div>

                  {/* Summary */}
                  <div className="bg-gray-950 p-4 rounded-lg border border-gray-800 flex items-center justify-between mb-5">
                    <div className="flex items-center gap-3">
                      {getTierIcon(selectedPlanId)}
                      <div>
                        <h4 className="text-sm font-semibold text-white uppercase">{selectedPlanId} Subscription</h4>
                        <p className="text-xs text-gray-400">Duration: 30 days of full premium capabilities</p>
                      </div>
                    </div>
                    <span className="text-lg font-bold text-white">BDT {plans[selectedPlanId]?.priceBDT}</span>
                  </div>

                  {/* Coupons */}
                  <div className="mb-6">
                    <label className="block text-xs font-medium text-gray-400 mb-2">Have a promo coupon code?</label>
                    <div className="flex gap-2">
                      <input 
                        type="text"
                        value={couponCode}
                        onChange={(e) => setCouponCode(e.target.value)}
                        placeholder="e.g. LAUNCH50"
                        className="flex-1 bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-yellow-500"
                      />
                      <button 
                        onClick={handleApplyCoupon}
                        disabled={couponLoading}
                        className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-100 rounded-lg text-xs font-semibold"
                      >
                        {couponLoading ? "Checking..." : "Apply"}
                      </button>
                    </div>
                    {couponError && <p className="text-[11px] text-red-500 mt-1">{couponError}</p>}
                    {appliedCoupon && (
                      <p className="text-[11px] text-green-500 mt-1 flex items-center gap-1">
                        <Gift className="w-3.5 h-3.5" />
                        <span>Successfully applied <strong>{appliedCoupon.code}</strong>: {appliedCoupon.description} ({appliedCoupon.discountPercent}% discount).</span>
                      </p>
                    )}
                  </div>

                  {/* Payment Gateway Selectors */}
                  <div className="mb-6">
                    <label className="block text-xs font-medium text-gray-400 mb-2">Select Payment Method</label>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {[
                        { id: "bkash", name: "bKash wallet", icon: <Smartphone className="w-4 h-4 text-pink-500" /> },
                        { id: "nagad", name: "Nagad wallet", icon: <Smartphone className="w-4 h-4 text-orange-500" /> },
                        { id: "rocket", name: "Rocket wallet", icon: <Smartphone className="w-4 h-4 text-purple-400" /> },
                        { id: "stripe", name: "Credit Card", icon: <CreditCard className="w-4 h-4 text-indigo-400" /> }
                      ].map((method) => (
                        <button
                          key={method.id}
                          onClick={() => setPaymentMethod(method.id as any)}
                          className={`p-3 rounded-lg border text-left flex flex-col justify-between h-20 transition-all ${
                            paymentMethod === method.id 
                              ? "border-yellow-500 bg-yellow-500/5 shadow-[0_0_10px_rgba(234,179,8,0.1)]" 
                              : "border-gray-800 hover:border-gray-700 bg-gray-950"
                          }`}
                        >
                          {method.icon}
                          <span className="text-xs font-medium text-white">{method.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Total calculation and upgrade */}
                  <div className="border-t border-gray-800 pt-4 flex items-center justify-between mb-6">
                    <div>
                      <p className="text-xs text-gray-400">Total Billed Price</p>
                      {appliedCoupon && (
                        <p className="text-xs text-gray-500 line-through">BDT {plans[selectedPlanId]?.priceBDT}</p>
                      )}
                      <p className="text-xl font-bold text-white">BDT {calculatePrice(selectedPlanId)}</p>
                    </div>
                    <button 
                      onClick={handleStartSimulation}
                      className="px-6 py-2.5 bg-yellow-500 hover:bg-yellow-400 text-gray-950 text-sm font-semibold rounded-lg flex items-center gap-2"
                    >
                      <span>Proceed to Payment</span>
                      <Crown className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 3: Payment gateway simulated experience */}
              {paymentStep === "simulation" && (
                <div className="max-w-md mx-auto bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden shadow-2xl">
                  {/* Customized banner header to match the payment provider */}
                  <div className={`p-4 text-center text-sm font-semibold text-white ${
                    paymentMethod === "bkash" ? "bg-pink-600" :
                    paymentMethod === "nagad" ? "bg-orange-600" :
                    paymentMethod === "rocket" ? "bg-purple-700" : "bg-indigo-600"
                  }`}>
                    {paymentMethod === "stripe" ? "Stripe Secure Card checkout" : `${paymentMethod.toUpperCase()} Sandbox payment gateway`}
                  </div>

                  <div className="p-5">
                    <p className="text-xs text-gray-400 text-center mb-4">
                      Simulation payment: you are authorized to click "Simulate Verification" to credit your profile.
                    </p>

                    <div className="bg-gray-950 p-3 rounded border border-gray-800 text-center mb-4">
                      <p className="text-xs text-gray-400">Amount to pay</p>
                      <p className="text-lg font-bold text-white">BDT {calculatePrice(selectedPlanId)}</p>
                    </div>

                    {/* MFS flows (bkash, nagad, rocket) */}
                    {paymentMethod !== "stripe" ? (
                      <div className="space-y-4">
                        {!otpSent ? (
                          <div>
                            <label className="block text-xs text-gray-400 mb-1">Enter your {paymentMethod.toUpperCase()} wallet account number</label>
                            <input 
                              type="text" 
                              value={mobileNumber}
                              onChange={(e) => setMobileNumber(e.target.value.replace(/\D/g, "").slice(0, 11))}
                              placeholder="017XXXXXXXX"
                              className="w-full bg-gray-950 border border-gray-800 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-yellow-500 text-center font-mono"
                            />
                            <button
                              onClick={handleSendOtpSimulation}
                              className="w-full mt-3 py-2 bg-yellow-500 hover:bg-yellow-400 text-gray-950 rounded text-xs font-semibold"
                            >
                              Send OTP Code
                            </button>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <div>
                              <label className="block text-xs text-gray-400 mb-1">Enter 6-digit OTP Code (simulated code: <strong>123456</strong>)</label>
                              <input 
                                type="text" 
                                value={otpCode}
                                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                                placeholder="******"
                                className="w-full bg-gray-950 border border-gray-800 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-yellow-500 text-center font-mono tracking-widest"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-gray-400 mb-1">Enter PIN code (simulated pin: <strong>1234</strong>)</label>
                              <input 
                                type="password" 
                                value={pinCode}
                                onChange={(e) => setPinCode(e.target.value.replace(/\D/g, "").slice(0, 5))}
                                placeholder="****"
                                className="w-full bg-gray-950 border border-gray-800 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-yellow-500 text-center tracking-widest"
                              />
                            </div>
                            <div className="flex gap-2 mt-4">
                              <button 
                                onClick={() => setOtpSent(false)}
                                className="flex-1 py-2 bg-gray-850 hover:bg-gray-800 text-gray-300 rounded text-xs font-semibold"
                              >
                                Edit Wallet No
                              </button>
                              <button
                                onClick={handleCompleteSimulation}
                                disabled={processingPayment || otpCode.length < 4}
                                className="flex-1 py-2 bg-yellow-500 hover:bg-yellow-400 text-gray-950 rounded text-xs font-semibold"
                              >
                                {processingPayment ? "Processing..." : "Confirm Payment"}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      /* Stripe Credit Card flow */
                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs text-gray-400 mb-1">Cardholder Name</label>
                          <input 
                            type="text" 
                            value={cardName}
                            onChange={(e) => setCardName(e.target.value)}
                            placeholder="John Doe"
                            className="w-full bg-gray-950 border border-gray-800 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-yellow-500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-400 mb-1">Card Number</label>
                          <input 
                            type="text" 
                            value={cardNumber}
                            onChange={(e) => setCardNumber(e.target.value.replace(/\D/g, "").slice(0, 16))}
                            placeholder="4000 1234 5678 9010"
                            className="w-full bg-gray-950 border border-gray-800 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-yellow-500 font-mono"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs text-gray-400 mb-1">Expiration (MM/YY)</label>
                            <input 
                              type="text" 
                              value={cardExpiry}
                              onChange={(e) => setCardExpiry(e.target.value)}
                              placeholder="12/28"
                              className="w-full bg-gray-950 border border-gray-800 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-yellow-500 text-center"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-400 mb-1">CVV / CVC</label>
                            <input 
                              type="password" 
                              value={cardCvv}
                              onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, "").slice(0, 4))}
                              placeholder="***"
                              className="w-full bg-gray-950 border border-gray-800 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-yellow-500 text-center"
                            />
                          </div>
                        </div>
                        <div className="flex gap-2 mt-5">
                          <button 
                            onClick={() => setPaymentStep("checkout")}
                            className="flex-1 py-2 bg-gray-850 hover:bg-gray-800 text-gray-300 rounded text-xs font-semibold"
                          >
                            Go Back
                          </button>
                          <button
                            onClick={handleCompleteSimulation}
                            disabled={processingPayment || cardNumber.length < 12}
                            className="flex-1 py-2 bg-yellow-500 hover:bg-yellow-400 text-gray-950 rounded text-xs font-semibold"
                          >
                            {processingPayment ? "Processing..." : "Complete Checkout"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* STEP 4: Checkout upgrade success screen */}
              {paymentStep === "success" && subscriptionDetails && (
                <div className="max-w-md mx-auto text-center py-8">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-500/10 border border-green-500 mb-4 text-green-500">
                    <Crown className="w-8 h-8" />
                  </div>
                  <h3 className="text-xl font-bold text-white">Upgrade Successful!</h3>
                  <p className="text-sm text-gray-400 mt-2">
                    Your account has been upgraded to <span className="text-yellow-500 font-semibold uppercase">{subscriptionDetails.user.tier}</span>.
                  </p>

                  <div className="bg-gray-900/30 border border-gray-800 rounded-lg p-4 mt-6 text-left space-y-2">
                    <p className="text-xs text-gray-400 flex justify-between">
                      <span>Transaction ID:</span>
                      <strong className="text-gray-200 font-mono">{subscriptionDetails.transactionId}</strong>
                    </p>
                    <p className="text-xs text-gray-400 flex justify-between">
                      <span>Payment Method:</span>
                      <strong className="text-gray-200 uppercase">{subscriptionDetails.paymentMethod}</strong>
                    </p>
                    <p className="text-xs text-gray-400 flex justify-between">
                      <span>Amount Credited:</span>
                      <strong className="text-gray-200">BDT {subscriptionDetails.finalPrice}</strong>
                    </p>
                    <p className="text-xs text-gray-400 flex justify-between">
                      <span>Expiration:</span>
                      <strong className="text-gray-200">{new Date(subscriptionDetails.expiresAt).toLocaleDateString()}</strong>
                    </p>
                  </div>

                  <button
                    onClick={onClose}
                    className="mt-8 px-6 py-2 bg-green-600 hover:bg-green-500 text-white text-xs font-semibold rounded-lg"
                  >
                    Return to Financial Terminal
                  </button>
                </div>
              )}
            </>
          )}

        </div>
        
        {/* Footer info banner */}
        <div className="p-4 border-t border-gray-900 bg-gray-950/80 flex items-center gap-2 justify-center text-[10px] text-gray-500">
          <Shield className="w-3.5 h-3.5 text-gray-400 shrink-0" />
          <span>Secure BDT sandbox. Payment transactions are processed with mock sandbox validation profiles.</span>
        </div>

      </div>
    </div>
  );
}
