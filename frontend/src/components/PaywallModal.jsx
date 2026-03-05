import { useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import {
  createSubscription,
  verifyPayment,
  openRazorpayCheckout,
  detectCurrency,
} from "../api/billing.js";

export default function PaywallModal({ onClose, feature = "This feature" }) {
  const { user, fetchUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const overlayRef = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

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
      onClose();
    } catch (err) {
      if (err?.message === "cancelled") {
        // user closed the modal — not an error
      } else {
        setError(err?.response?.data?.detail ?? "Payment failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const priceLabel = detectCurrency() === "inr" ? "₹499/mo" : "$6/mo";

  return (
    <div
      ref={overlayRef}
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
    >
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full border border-slate-100 animate-scale-in overflow-hidden">
        {/* Gradient header */}
        <div className="px-6 pt-7 pb-5 text-center"
             style={{ background: "linear-gradient(160deg, #1e1b4b 0%, #312e81 100%)" }}>
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4"
               style={{ background: "rgba(255,255,255,0.15)", backdropFilter: "blur(8px)" }}>
            <svg className="w-6 h-6 text-amber-300" viewBox="0 0 20 20" fill="currentColor">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-white mb-1">Upgrade to Pro</h2>
          <p className="text-indigo-300 text-sm">
            {feature} requires a Pro plan.
          </p>
        </div>

        <div className="p-6">
          <ul className="space-y-2.5 mb-6">
            {[
              "Unlimited Gmail accounts",
              "Full email history",
              "Real-time sync",
              "Priority memory processing",
            ].map((f) => (
              <li key={f} className="flex items-center gap-2.5 text-sm text-slate-600">
                <svg className="w-4 h-4 text-emerald-500 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                {f}
              </li>
            ))}
          </ul>

          {error && (
            <p className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">{error}</p>
          )}

          <div className="flex gap-3">
            <button
              onClick={handleUpgrade}
              disabled={loading}
              className="flex-1 text-white py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-60 hover:opacity-90 active:scale-[0.99] flex items-center justify-center gap-2"
              style={{ background: "linear-gradient(135deg, #4f46e5, #6366f1)" }}
            >
              {loading ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Loading...
                </>
              ) : `Upgrade — ${priceLabel}`}
            </button>
            <button
              onClick={onClose}
              className="flex-1 border border-slate-200 text-slate-600 py-2.5 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors"
            >
              Maybe later
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
