import { useState } from "react";
import { revokeAccount, triggerReauth, updateAccountLabel } from "../api/accounts.js";
import { triggerInitialSync } from "../api/gmail.js";
import SyncProgress from "./SyncProgress.jsx";

const ACCOUNT_TYPE_OPTIONS = [
  { value: "personal",  label: "Personal"         },
  { value: "edu",       label: "Education (.edu)"  },
  { value: "work",      label: "Work"              },
  { value: "freelance", label: "Freelance"         },
];

const STATUS_CONFIG = {
  active:       { dot: "bg-emerald-400", text: "Active",         textColor: "text-emerald-600" },
  needs_reauth: { dot: "bg-amber-400",   text: "Re-auth needed", textColor: "text-amber-600"   },
  syncing:      { dot: "bg-brand-400",   text: "Syncing…",       textColor: "text-brand-600"   },
};

/**
 * AccountCard — displays one connected Gmail account with:
 * - Status indicator (active / needs_reauth / syncing)
 * - Inline label (account_type) selector
 * - Sync Now button + SyncProgress polling widget
 * - Re-authenticate button when status == needs_reauth
 * - Remove button with inline confirmation
 */
export default function AccountCard({ account, isPrimary, onUpdated, chunkCount, unreadCount }) {
  const [labelValue,    setLabelValue]    = useState(account.account_type);
  const [labelSaving,   setLabelSaving]   = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [removing,      setRemoving]      = useState(false);
  const [reauthing,     setReauthing]     = useState(false);
  const [syncing,       setSyncing]       = useState(false);
  const [showProgress,  setShowProgress]  = useState(account.sync_status === "syncing");
  const [error,         setError]         = useState(null);

  const statusCfg = STATUS_CONFIG[account.status] ?? STATUS_CONFIG.active;

  const handleLabelChange = async (newType) => {
    setLabelValue(newType);
    setLabelSaving(true);
    setError(null);
    try {
      await updateAccountLabel(account.id, newType);
      onUpdated();
    } catch (err) {
      setError(err?.response?.data?.detail ?? "Failed to update label");
      setLabelValue(account.account_type);
    } finally {
      setLabelSaving(false);
    }
  };

  const handleReauth = async () => {
    setReauthing(true);
    setError(null);
    try {
      await triggerReauth(account.gmail_address);
    } catch (err) {
      setError(err?.response?.data?.detail ?? "Failed to start re-authentication");
      setReauthing(false);
    }
  };

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
    <div className={`border rounded-2xl p-4 transition-colors ${
      account.status === "needs_reauth"
        ? "border-amber-200 bg-amber-50/50"
        : "border-slate-200 bg-white"
    }`}>

      {/* Header row */}
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 text-brand-700"
             style={{ background: "linear-gradient(135deg, #e0e7ff, #c7d2fe)" }}>
          {account.gmail_address[0].toUpperCase()}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-medium text-slate-900 truncate">
              {account.gmail_address}
            </p>
            {isPrimary && (
              <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full font-medium">
                primary
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 mt-0.5">
            <span className={`inline-block w-1.5 h-1.5 rounded-full ${statusCfg.dot}`} />
            <span className={`text-xs font-medium ${statusCfg.textColor}`}>
              {statusCfg.text}
            </span>
          </div>
        </div>

        {/* Remove button */}
        {!isPrimary && !confirmRemove && (
          <button
            onClick={() => setConfirmRemove(true)}
            disabled={removing}
            className="text-slate-300 hover:text-red-400 transition-colors p-1 rounded-lg hover:bg-red-50"
            title="Remove account"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Label selector */}
      <div className="mt-3 flex items-center gap-2">
        <span className="text-xs text-slate-400 w-10 flex-shrink-0">Label</span>
        <div className="relative flex-1">
          <select
            value={labelValue}
            onChange={(e) => handleLabelChange(e.target.value)}
            disabled={labelSaving}
            className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 pr-6 bg-white text-slate-700 appearance-none cursor-pointer hover:border-slate-300 focus:outline-none focus:ring-1 focus:ring-brand-400 disabled:opacity-60 transition-colors"
          >
            {ACCOUNT_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          {labelSaving && (
            <span className="absolute right-2 top-1/2 -translate-y-1/2">
              <span className="inline-block w-3 h-3 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
            </span>
          )}
        </div>
      </div>

      {/* Sync row */}
      <div className="mt-3 flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          {showProgress ? (
            <SyncProgress
              accountId={account.id}
              onComplete={() => { setShowProgress(false); onUpdated(); }}
            />
          ) : (
            <p className="text-xs text-slate-400">
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
            className="text-xs bg-slate-100 text-slate-600 px-3 py-1 rounded-lg font-medium hover:bg-brand-50 hover:text-brand-600 transition-colors disabled:opacity-60 flex-shrink-0"
          >
            {syncing ? "Starting…" : "Sync Now"}
          </button>
        )}
      </div>

      {/* Stats chips */}
      <div className="mt-2 flex items-center gap-3 flex-wrap">
        {typeof unreadCount === "number" && (
          <div className="flex items-center gap-1.5">
            <svg className="w-3 h-3 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
              <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
              <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
            </svg>
            <span className="text-xs text-slate-400">
              {unreadCount > 0 ? `${unreadCount.toLocaleString()} unread` : "No unread"}
            </span>
          </div>
        )}
        {typeof chunkCount === "number" && (
          <div className="flex items-center gap-1.5">
            <svg className="w-3 h-3 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
              <path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z" />
            </svg>
            <span className="text-xs text-slate-400">
              {chunkCount > 0
                ? `${chunkCount.toLocaleString()} memory chunk${chunkCount === 1 ? "" : "s"}`
                : "No memory built yet"}
            </span>
          </div>
        )}
      </div>

      {/* Re-auth banner */}
      {account.status === "needs_reauth" && (
        <div className="mt-3 flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
          <p className="text-xs text-amber-800 font-medium">
            Token expired — please reconnect.
          </p>
          <button
            onClick={handleReauth}
            disabled={reauthing}
            className="text-xs bg-amber-500 text-white px-3 py-1 rounded-lg font-medium hover:bg-amber-600 transition-colors disabled:opacity-60 flex-shrink-0 ml-3"
          >
            {reauthing ? "Redirecting…" : "Re-authenticate"}
          </button>
        </div>
      )}

      {/* Remove confirmation */}
      {confirmRemove && (
        <div className="mt-3 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
          <p className="text-xs text-red-800 mb-2">
            Remove <span className="font-medium">{account.gmail_address}</span>? This will delete all synced memory.
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
              className="text-xs border border-slate-200 text-slate-600 px-3 py-1 rounded-lg font-medium hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Inline error */}
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}
