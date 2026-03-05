import { useEffect, useRef, useState } from "react";
import { getAddAccountUrl } from "../api/accounts.js";
import GoogleIcon from "./icons/GoogleIcon.jsx";

/**
 * AddAccountModal — slide-in modal for connecting a second Gmail account.
 *
 * Props:
 *   onClose  – called when the modal should be dismissed
 *   canAdd   – boolean; false means the user is at their plan limit
 */
export default function AddAccountModal({ onClose, canAdd }) {
  const [connecting, setConnecting] = useState(false);
  const [error, setError]           = useState(null);
  const overlayRef                  = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleConnect = async () => {
    setConnecting(true);
    setError(null);
    try {
      const { url } = await getAddAccountUrl();
      window.location.href = url;
    } catch (err) {
      const detail = err?.response?.data?.detail;
      setError(detail ?? "Failed to start authentication. Please try again.");
      setConnecting(false);
    }
  };

  return (
    <div
      ref={overlayRef}
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4"
    >
      {/* Panel */}
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 border border-slate-100">

        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Add Gmail Account</h2>
            <p className="text-sm text-slate-500 mt-0.5">
              Connect another account to build unified memory.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-slate-400 hover:text-slate-600 transition-colors p-1.5 rounded-lg hover:bg-slate-100"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Upgrade prompt when at plan limit */}
        {!canAdd ? (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800 mb-5">
            <p className="font-semibold mb-1">Free plan limit reached</p>
            <p className="text-xs leading-relaxed text-amber-700">
              Free accounts support up to 2 Gmail accounts. Upgrade to Pro for unlimited accounts.
            </p>
          </div>
        ) : (
          <>
            {/* How it works */}
            <ul className="space-y-3 mb-5">
              {[
                {
                  icon: (
                    <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                    </svg>
                  ),
                  text: "You'll be taken to Google to grant MailMind access.",
                },
                {
                  icon: (
                    <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                      <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                    </svg>
                  ),
                  text: "We store embeddings, not raw emails. Delete anytime.",
                },
                {
                  icon: (
                    <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M17.707 9.293a1 1 0 010 1.414l-7 7a1 1 0 01-1.414 0l-7-7A.997.997 0 012 10V5a3 3 0 013-3h5c.256 0 .512.098.707.293l7 7zM5 6a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                    </svg>
                  ),
                  text: "You can label the account (work, edu, etc.) after connecting.",
                },
              ].map(({ icon, text }) => (
                <li key={text} className="flex items-start gap-3 text-sm text-slate-600">
                  <span className="flex-shrink-0 w-7 h-7 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center mt-0.5">
                    {icon}
                  </span>
                  {text}
                </li>
              ))}
            </ul>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2.5 text-sm text-red-700 mb-4">
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
              className="flex-1 flex items-center justify-center gap-2 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-60 hover:opacity-90 active:scale-95"
              style={{ background: "linear-gradient(135deg, #4f46e5, #6366f1)" }}
            >
              {connecting ? (
                <>
                  <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Redirecting…
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
              className="flex-1 text-center text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all hover:opacity-90"
              style={{ background: "linear-gradient(135deg, #4f46e5, #6366f1)" }}
            >
              Upgrade to Pro
            </a>
          )}

          <button
            onClick={onClose}
            className="px-4 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

