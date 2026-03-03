import { useState } from "react";
import { revokeAccount, triggerReauth, updateAccountLabel } from "../api/accounts.js";
import { triggerInitialSync } from "../api/gmail.js";
import SyncProgress from "./SyncProgress.jsx";

const ACCOUNT_TYPE_OPTIONS = [
  { value: "personal",  label: "Personal",          emoji: "🏠" },
  { value: "edu",       label: "Education (.edu)",   emoji: "🎓" },
  { value: "work",      label: "Work",               emoji: "💼" },
  { value: "freelance", label: "Freelance",          emoji: "🚀" },
];

const STATUS_CONFIG = {
  active:        { dot: "bg-green-400",  text: "Active",           textColor: "text-green-600"  },
  needs_reauth:  { dot: "bg-orange-400", text: "Re-auth needed",   textColor: "text-orange-600" },
  syncing:       { dot: "bg-blue-400",   text: "Syncing…",         textColor: "text-blue-600"   },
};

/**
 * AccountCard — displays one connected Gmail account with:
 * - Status indicator (active / needs_reauth / syncing)
 * - Inline label (account_type) selector
 * - Sync Now button + SyncProgress polling widget
 * - Re-authenticate button when status == needs_reauth
 * - Remove button with inline confirmation
 *
 * Props:
 *   account     – GmailAccountResponse from the API
 *   isPrimary   – true when this account is the user's login email (can't be removed)
 *   onUpdated   – callback to trigger a refetch from the parent
 *   chunkCount  – number of memory chunks built from this account (optional)
 *   unreadCount – number of unread emails in this account (optional)
 */
export default function AccountCard({ account, isPrimary, onUpdated, chunkCount, unreadCount }) {
  const [labelValue,     setLabelValue]     = useState(account.account_type);
  const [labelSaving,    setLabelSaving]    = useState(false);
  const [confirmRemove,  setConfirmRemove]  = useState(false);
  const [removing,       setRemoving]       = useState(false);
  const [reauthing,      setReauthing]      = useState(false);
  const [syncing,        setSyncing]        = useState(false);
  const [showProgress,   setShowProgress]   = useState(
    account.sync_status === "syncing"
  );
  const [error, setError] = useState(null);

  const statusCfg = STATUS_CONFIG[account.status] ?? STATUS_CONFIG.active;

  // ── Label change ───────────────────────────────────────────────────────────
  const handleLabelChange = async (newType) => {
    setLabelValue(newType);
    setLabelSaving(true);
    setError(null);
    try {
      await updateAccountLabel(account.id, newType);
      onUpdated();
    } catch (err) {
      setError(err?.response?.data?.detail ?? "Failed to update label");
      setLabelValue(account.account_type); // revert optimistic update
    } finally {
      setLabelSaving(false);
    }
  };

  // ── Re-auth ────────────────────────────────────────────────────────────────
  const handleReauth = async () => {
    setReauthing(true);
    setError(null);
    try {
      await triggerReauth(account.gmail_address);
      // triggerReauth navigates away — no further state update needed
    } catch (err) {
      setError(err?.response?.data?.detail ?? "Failed to start re-authentication");
      setReauthing(false);
    }
  };

  // ── Sync Now ───────────────────────────────────────────────────────────────
  const handleSyncNow = async () => {
    setSyncing(true);
    setError(null);
    try {
      await triggerInitialSync(account.id);
      setShowProgress(true);
    } catch (err) {
      setError(err?.response?.data?.detail ?? "Failed to start sync");
    } finally {
      setSyncing(false);
    }
  };

  // ── Remove ─────────────────────────────────────────────────────────────────
  const handleRemove = async () => {
    setRemoving(true);
    setError(null);
    try {
      await revokeAccount(account.id);
      onUpdated();
    } catch (err) {
      setError(err?.response?.data?.detail ?? "Failed to remove account");
      setRemoving(false);
      setConfirmRemove(false);
    }
  };

  return (
    <div
      className={`border rounded-xl p-4 transition-colors ${
        account.status === "needs_reauth"
          ? "border-orange-200 bg-orange-50"
          : "border-gray-200 bg-white"
      }`}
    >
      {/* ── Header row ── */}
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm flex-shrink-0">
          {account.gmail_address[0].toUpperCase()}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-medium text-gray-900 truncate">
              {account.gmail_address}
            </p>
            {isPrimary && (
              <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">
                primary
              </span>
            )}
          </div>

          {/* Status badge */}
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className={`inline-block w-2 h-2 rounded-full ${statusCfg.dot}`} />
            <span className={`text-xs font-medium ${statusCfg.textColor}`}>
              {statusCfg.text}
            </span>
          </div>
        </div>

        {/* Remove button (top-right) */}
        {!isPrimary && !confirmRemove && (
          <button
            onClick={() => setConfirmRemove(true)}
            disabled={removing}
            className="text-gray-400 hover:text-red-500 transition-colors p-1 rounded"
            title="Remove account"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* ── Label selector ── */}
      <div className="mt-3 flex items-center gap-2">
        <span className="text-xs text-gray-500 w-10 flex-shrink-0">Label</span>
        <div className="relative flex-1">
          <select
            value={labelValue}
            onChange={(e) => handleLabelChange(e.target.value)}
            disabled={labelSaving}
            className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 pr-6 bg-white text-gray-700 appearance-none cursor-pointer hover:border-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-60"
          >
            {ACCOUNT_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.emoji} {opt.label}
              </option>
            ))}
          </select>
          {labelSaving && (
            <span className="absolute right-2 top-1/2 -translate-y-1/2">
              <span className="inline-block w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </span>
          )}
        </div>
      </div>

      {/* ── Sync row ── */}
      <div className="mt-3 flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          {showProgress ? (
            <SyncProgress
              accountId={account.id}
              onComplete={() => {
                setShowProgress(false);
                onUpdated();
              }}
            />
          ) : (
            <p className="text-xs text-gray-400">
              {account.emails_synced > 0
                ? `${account.emails_synced.toLocaleString()} emails synced`
                : "No emails synced yet"}
            </p>
          )}
        </div>
        {account.status !== "needs_reauth" && !showProgress && (
          <button
            onClick={handleSyncNow}
            disabled={syncing}
            className="text-xs bg-gray-100 text-gray-600 px-3 py-1 rounded-lg font-medium hover:bg-blue-50 hover:text-blue-600 transition-colors disabled:opacity-60 flex-shrink-0"
          >
            {syncing ? "Starting…" : "Sync Now"}
          </button>
        )}
      </div>

      {/* ── Stats chips ── */}
      <div className="mt-2 flex items-center gap-3 flex-wrap">
        {typeof unreadCount === "number" && (
          <div className="flex items-center gap-1.5">
            <span className="text-xs" aria-hidden="true">📥</span>
            <span className="text-xs text-gray-400">
              {unreadCount > 0
                ? `${unreadCount.toLocaleString()} unread`
                : "No unread emails"}
            </span>
          </div>
        )}
        {typeof chunkCount === "number" && (
          <div className="flex items-center gap-1.5">
            <span className="text-xs" aria-hidden="true">🧠</span>
            <span className="text-xs text-gray-400">
              {chunkCount > 0
                ? `${chunkCount.toLocaleString()} memory chunk${chunkCount === 1 ? "" : "s"}`
                : "No memory built yet"}
            </span>
          </div>
        )}
      </div>

      {/* ── Re-auth banner ── */}
      {account.status === "needs_reauth" && (
        <div className="mt-3 flex items-center justify-between bg-orange-100 border border-orange-200 rounded-lg px-3 py-2">
          <p className="text-xs text-orange-800 font-medium">
            Token expired — please reconnect this account.
          </p>
          <button
            onClick={handleReauth}
            disabled={reauthing}
            className="text-xs bg-orange-500 text-white px-3 py-1 rounded-lg font-medium hover:bg-orange-600 transition-colors disabled:opacity-60 flex-shrink-0 ml-3"
          >
            {reauthing ? "Redirecting…" : "Re-authenticate"}
          </button>
        </div>
      )}

      {/* ── Remove confirmation ── */}
      {confirmRemove && (
        <div className="mt-3 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          <p className="text-xs text-red-800 mb-2">
            Remove <span className="font-medium">{account.gmail_address}</span>? This will revoke
            MailMind's access and delete all synced memory from this account.
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleRemove}
              disabled={removing}
              className="text-xs bg-red-600 text-white px-3 py-1 rounded-lg font-medium hover:bg-red-700 transition-colors disabled:opacity-60"
            >
              {removing ? "Removing…" : "Yes, remove"}
            </button>
            <button
              onClick={() => setConfirmRemove(false)}
              disabled={removing}
              className="text-xs border border-gray-300 text-gray-600 px-3 py-1 rounded-lg font-medium hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── Inline error ── */}
      {error && (
        <p className="mt-2 text-xs text-red-600">{error}</p>
      )}
    </div>
  );
}
