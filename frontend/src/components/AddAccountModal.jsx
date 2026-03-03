import { useEffect, useRef, useState } from "react";
import { getAddAccountUrl } from "../api/accounts.js";

/**
 * AddAccountModal — slide-in modal for connecting a second Gmail account.
 *
 * Props:
 *   onClose  – called when the modal should be dismissed
 *   canAdd   – boolean; false means the user is at their plan limit
 */
export default function AddAccountModal({ onClose, canAdd }) {
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState(null);
  const overlayRef = useRef(null);

  // Close on Escape key
  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleConnect = async () => {
    setConnecting(true);
    setError(null);
    try {
      const { url } = await getAddAccountUrl();
      window.location.href = url;
      // Navigation happens — no need to reset state
    } catch (err) {
      const detail = err?.response?.data?.detail;
      setError(detail ?? "Failed to start authentication. Please try again.");
      setConnecting(false);
    }
  };

  return (
    /* Backdrop */
    <div
      ref={overlayRef}
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
    >
      {/* Panel */}
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Add Gmail Account
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Connect a second account to build a unified memory.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Upgrade prompt when at plan limit */}
        {!canAdd ? (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800 mb-4">
            <p className="font-medium mb-1">You've reached the Free plan limit.</p>
            <p>
              Free accounts support up to 2 Gmail accounts. Upgrade to Pro for
              unlimited accounts.
            </p>
          </div>
        ) : (
          <>
            {/* How it works */}
            <ul className="space-y-2 mb-5">
              {[
                {
                  icon: "🔐",
                  text: "You'll be taken to Google to grant MailMind access.",
                },
                {
                  icon: "📬",
                  text: "We store embeddings, not raw emails. Delete anytime.",
                },
                {
                  icon: "🏷️",
                  text: "You can label the account (work, edu, etc.) after connecting.",
                },
              ].map(({ icon, text }) => (
                <li key={text} className="flex items-start gap-2 text-sm text-gray-600">
                  <span className="text-base leading-5">{icon}</span>
                  {text}
                </li>
              ))}
            </ul>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700 mb-4">
                {error}
              </div>
            )}
          </>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          {canAdd && (
            <button
              onClick={handleConnect}
              disabled={connecting}
              className="flex-1 flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-60"
            >
              {connecting ? (
                <>
                  <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Redirecting to Google…
                </>
              ) : (
                <>
                  <GoogleIcon className="w-4 h-4" />
                  Connect with Google
                </>
              )}
            </button>
          )}

          {!canAdd && (
            <a
              href="/settings"
              className="flex-1 text-center bg-blue-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors"
            >
              Upgrade to Pro
            </a>
          )}

          <button
            onClick={onClose}
            className="px-4 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function GoogleIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}
