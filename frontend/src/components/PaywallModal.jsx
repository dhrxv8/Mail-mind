import { useState } from "react";
import { createCheckout } from "../api/billing.js";

/**
 * PaywallModal — shown when a free-tier user tries to access a Pro feature.
 *
 * Props:
 *   onClose  – close the modal
 *   feature  – short description of the blocked feature (default "This feature")
 */
export default function PaywallModal({ onClose, feature = "This feature" }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

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

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6">
        <div className="text-center mb-5">
          <div className="text-4xl mb-3">⭐</div>
          <h2 className="text-lg font-bold text-gray-900 mb-1">Upgrade to Pro</h2>
          <p className="text-gray-500 text-sm">
            {feature} requires a Pro plan.
          </p>
        </div>

        <ul className="text-sm text-gray-600 space-y-2 mb-6">
          <li className="flex items-center gap-2">
            <span className="text-green-500 font-bold">✓</span>
            Unlimited Gmail accounts
          </li>
          <li className="flex items-center gap-2">
            <span className="text-green-500 font-bold">✓</span>
            Full email history
          </li>
          <li className="flex items-center gap-2">
            <span className="text-green-500 font-bold">✓</span>
            Real-time sync
          </li>
          <li className="flex items-center gap-2">
            <span className="text-green-500 font-bold">✓</span>
            Priority memory processing
          </li>
        </ul>

        {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

        <div className="flex gap-3">
          <button
            onClick={handleUpgrade}
            disabled={loading}
            className="flex-1 bg-blue-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-60"
          >
            {loading ? "Loading…" : "Upgrade — $6/mo"}
          </button>
          <button
            onClick={onClose}
            className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            Maybe later
          </button>
        </div>
      </div>
    </div>
  );
}
