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
      setError(
        err?.response?.data?.detail ?? "Failed to start checkout. Please try again."
      );
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
      setError(
        err?.response?.data?.detail ?? "Failed to open billing portal."
      );
      setLoading(false);
    }
  };

  return (
    <div>
      {isPro ? (
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-700">
              You're on the{" "}
              <span className="font-semibold text-blue-700">Pro plan</span>. ⭐
            </p>
            <p className="text-xs text-gray-400 mt-0.5">
              Unlimited accounts · full email history · real-time sync.
            </p>
          </div>
          <button
            onClick={handleManage}
            disabled={loading}
            className="text-sm text-blue-600 font-medium hover:underline disabled:opacity-60 flex-shrink-0 ml-4"
          >
            {loading ? "Loading…" : "Manage subscription →"}
          </button>
        </div>
      ) : (
        <div>
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <p className="text-sm text-gray-700">
                Current plan:{" "}
                <span className="font-medium text-gray-900">Free</span>
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                Up to 2 Gmail accounts · 90-day email history.
              </p>
            </div>
            <button
              onClick={handleUpgrade}
              disabled={loading}
              className="flex-shrink-0 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-60"
            >
              {loading ? "Loading…" : "Upgrade — $6/mo"}
            </button>
          </div>
          <ul className="text-xs text-gray-500 space-y-1.5">
            <li className="flex items-center gap-2">
              <span className="text-green-500 font-bold">✓</span>
              Unlimited Gmail accounts
            </li>
            <li className="flex items-center gap-2">
              <span className="text-green-500 font-bold">✓</span>
              Full email history (no 90-day limit)
            </li>
            <li className="flex items-center gap-2">
              <span className="text-green-500 font-bold">✓</span>
              Real-time sync via Pub/Sub
            </li>
            <li className="flex items-center gap-2">
              <span className="text-green-500 font-bold">✓</span>
              Priority memory processing
            </li>
          </ul>
        </div>
      )}

      {error && <p className="mt-3 text-xs text-red-600">{error}</p>}
    </div>
  );
}
