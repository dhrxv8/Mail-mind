import { useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { createCheckout, getBillingPortal } from "../api/billing.js";

export default function BillingCard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const isPro = user?.plan === "pro";

  const handleUpgrade = async () => {
    setLoading(true);
    setError(null);
    try {
      const { url } = await createCheckout();
      window.location.href = url;
    } catch (err) {
      setError(err?.response?.data?.detail ?? "Failed to start checkout. Please try again.");
      setLoading(false);
    }
  };

  const handleManage = async () => {
    setLoading(true);
    setError(null);
    try {
      const { url } = await getBillingPortal();
      window.location.href = url;
    } catch (err) {
      setError(err?.response?.data?.detail ?? "Failed to open billing portal.");
      setLoading(false);
    }
  };

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
          <button
            onClick={handleManage}
            disabled={loading}
            className="text-sm text-brand-600 font-medium hover:text-brand-700 transition-colors disabled:opacity-60 flex-shrink-0 ml-4"
          >
            {loading ? "Loading…" : "Manage →"}
          </button>
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
              className="flex-shrink-0 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-all disabled:opacity-60 hover:opacity-90 active:scale-95"
              style={{ background: "linear-gradient(135deg, #4f46e5, #6366f1)" }}
            >
              {loading ? "Loading…" : "Upgrade — $6/mo"}
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
