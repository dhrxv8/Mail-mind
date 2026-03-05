import { useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import {
  createSubscription,
  verifyPayment,
  openRazorpayCheckout,
  detectCurrency,
} from "../api/billing.js";

export default function BillingCard() {
  const { user, fetchUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const isPro = user?.plan === "pro";

  const handleUpgrade = async () => {
    setLoading(true);
    setError(null);
    const currency = detectCurrency();
    try {
      const { subscription_id, razorpay_key_id } = await createSubscription(currency);

      const response = await openRazorpayCheckout({
        subscriptionId: subscription_id,
        keyId: razorpay_key_id,
        userName: user?.name,
        userEmail: user?.email,
        currency,
      });

      await verifyPayment({
        razorpay_payment_id: response.razorpay_payment_id,
        razorpay_subscription_id: response.razorpay_subscription_id,
        razorpay_signature: response.razorpay_signature,
      });

      await fetchUser();
    } catch (err) {
      if (err?.message !== "cancelled") {
        setError(err?.response?.data?.detail ?? "Payment failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const priceLabel = detectCurrency() === "inr" ? "₹499/mo" : "$6/mo";

  return (
    <div>
      {isPro ? (
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <p className="text-sm text-slate-700">
                You&apos;re on the{" "}
                <span className="font-semibold text-brand-600">Pro plan</span>
              </p>
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full text-amber-700"
                    style={{ background: "linear-gradient(135deg, #fef3c7, #fde68a)" }}>
                PRO
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Unlimited accounts · full email history · real-time sync.
            </p>
          </div>
        </div>
      ) : (
        <div>
          <div className="flex items-start justify-between gap-4 mb-5">
            <div>
              <p className="text-sm text-slate-700">
                Current plan:{" "}
                <span className="font-medium text-slate-900">Free</span>
              </p>
              <p className="text-xs text-slate-400 mt-0.5">
                Up to 2 Gmail accounts · 90-day email history.
              </p>
            </div>
            <button
              onClick={handleUpgrade}
              disabled={loading}
              className="flex-shrink-0 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-all disabled:opacity-60 hover:opacity-90 active:scale-95 flex items-center gap-2"
              style={{ background: "linear-gradient(135deg, #4f46e5, #6366f1)" }}
            >
              {loading ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Loading...
                </>
              ) : `Upgrade — ${priceLabel}`}
            </button>
          </div>
          <ul className="space-y-2">
            {[
              "Unlimited Gmail accounts",
              "Full email history (no 90-day limit)",
              "Real-time sync via Pub/Sub",
              "Priority memory processing",
            ].map((feature) => (
              <li key={feature} className="flex items-center gap-2 text-xs text-slate-500">
                <svg className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                {feature}
              </li>
            ))}
          </ul>
        </div>
      )}

      {error && <p className="mt-3 text-xs text-red-600">{error}</p>}
    </div>
  );
}
