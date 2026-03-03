import { useCallback, useEffect, useState } from "react";
import EmailDraftModal from "../components/EmailDraftModal.jsx";
import Sidebar from "../components/Sidebar.jsx";
import { useAccounts } from "../hooks/useAccounts.js";
import { getInbox, markRead } from "../api/inbox.js";

const TRIAGE_CONFIG = {
  urgent:          { label: "Urgent",          bg: "bg-red-100",    text: "text-red-700"    },
  action_required: { label: "Action required", bg: "bg-orange-100", text: "text-orange-700" },
  fyi:             { label: "FYI",             bg: "bg-gray-100",   text: "text-gray-500"   },
};

const ACCOUNT_TYPE_EMOJI = {
  personal:  "🏠",
  edu:       "🎓",
  work:      "💼",
  freelance: "🚀",
};

export default function Inbox() {
  const { accounts } = useAccounts();

  // ── Filter state ───────────────────────────────────────────────────────────
  const [accountFilter,  setAccountFilter]  = useState(null);
  const [readFilter,     setReadFilter]     = useState(null);   // null=all, false=unread, true=read
  const [triageFilter,   setTriageFilter]   = useState(null);
  const [searchQuery,    setSearchQuery]    = useState("");
  const [page,           setPage]           = useState(1);

  // ── Data state ─────────────────────────────────────────────────────────────
  const [result,   setResult]   = useState({ emails: [], total: 0, has_more: false });
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);

  // ── Draft modal ────────────────────────────────────────────────────────────
  const [draftEmail, setDraftEmail] = useState(null);

  // ── Load inbox ─────────────────────────────────────────────────────────────
  const loadInbox = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = { page, limit: 25 };
      if (accountFilter)             params.account_id   = accountFilter;
      if (readFilter !== null)       params.is_read      = readFilter;
      if (triageFilter)              params.triage_label = triageFilter;
      if (searchQuery.trim())        params.q            = searchQuery.trim();

      const data = await getInbox(params);
      setResult(data);
    } catch {
      setError("Failed to load inbox. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [accountFilter, readFilter, triageFilter, searchQuery, page]);

  useEffect(() => { loadInbox(); }, [loadInbox]);

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [accountFilter, readFilter, triageFilter, searchQuery]);

  // ── Mark as read ──────────────────────────────────────────────────────────
  const handleMarkRead = async (emailId) => {
    try {
      await markRead(emailId);
      setResult((prev) => ({
        ...prev,
        emails: prev.emails.map((e) =>
          e.id === emailId ? { ...e, is_read: true } : e
        ),
      }));
    } catch {
      // non-fatal
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />

      <main className="flex-1 flex flex-col overflow-hidden h-screen pb-16 md:pb-0">
        {/* Top bar */}
        <div className="bg-white border-b border-gray-200 px-6 py-4 flex-shrink-0">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <h1 className="text-xl font-bold text-gray-900">Inbox</h1>

            {/* Search */}
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search emails…"
                className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400"
              />
            </div>
          </div>

          {/* Filter row */}
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            {/* Account tabs */}
            <button
              onClick={() => setAccountFilter(null)}
              className={`px-3 py-1 text-xs rounded-full font-medium transition-colors ${
                accountFilter === null
                  ? "bg-gray-900 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              All accounts
            </button>
            {(accounts ?? []).map((acct) => (
              <button
                key={acct.id}
                onClick={() => setAccountFilter(acct.id)}
                className={`px-3 py-1 text-xs rounded-full font-medium transition-colors ${
                  accountFilter === acct.id
                    ? "bg-gray-900 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {ACCOUNT_TYPE_EMOJI[acct.account_type]} {acct.gmail_address.split("@")[0]}
              </button>
            ))}

            <span className="text-gray-200 text-sm">|</span>

            {/* Read filter */}
            {[
              { label: "All",    val: null  },
              { label: "Unread", val: false },
              { label: "Read",   val: true  },
            ].map(({ label, val }) => (
              <button
                key={label}
                onClick={() => setReadFilter(val)}
                className={`px-3 py-1 text-xs rounded-full font-medium transition-colors ${
                  readFilter === val
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {label}
              </button>
            ))}

            <span className="text-gray-200 text-sm">|</span>

            {/* Triage filter */}
            {[
              { label: "All",             val: null             },
              { label: "🔴 Urgent",       val: "urgent"          },
              { label: "🟠 Action req.",  val: "action_required" },
              { label: "⚪ FYI",          val: "fyi"             },
            ].map(({ label, val }) => (
              <button
                key={label}
                onClick={() => setTriageFilter(val)}
                className={`px-3 py-1 text-xs rounded-full font-medium transition-colors ${
                  triageFilter === val
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Email list */}
        <div className="flex-1 overflow-y-auto">
          {error && (
            <div className="m-4 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
              {error}
            </div>
          )}

          {loading ? (
            <div className="space-y-px">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="h-16 bg-white border-b border-gray-100 animate-pulse" />
              ))}
            </div>
          ) : result.emails.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="text-4xl mb-3">📭</div>
              <p className="text-gray-500 text-sm">No emails match your filters.</p>
            </div>
          ) : (
            <div>
              {result.emails.map((email) => (
                <EmailRow
                  key={email.id}
                  email={email}
                  onMarkRead={handleMarkRead}
                  onDraft={() => setDraftEmail(email)}
                />
              ))}

              {/* Pagination */}
              <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-white">
                <p className="text-xs text-gray-400">
                  {result.total.toLocaleString()} email{result.total !== 1 ? "s" : ""}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(p - 1, 1))}
                    disabled={page <= 1}
                    className="px-3 py-1 text-xs font-medium border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    ← Prev
                  </button>
                  <span className="px-3 py-1 text-xs text-gray-500">Page {page}</span>
                  <button
                    onClick={() => setPage((p) => p + 1)}
                    disabled={!result.has_more}
                    className="px-3 py-1 text-xs font-medium border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Next →
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Draft modal */}
      {draftEmail && (
        <EmailDraftModal
          email={draftEmail}
          onClose={() => setDraftEmail(null)}
          onSent={() => {
            setDraftEmail(null);
            loadInbox();
          }}
        />
      )}
    </div>
  );
}

// ── EmailRow ────────────────────────────────────────────────────────────────

function EmailRow({ email, onMarkRead, onDraft }) {
  const triage = email.triage_label ? TRIAGE_CONFIG[email.triage_label] : null;

  const handleRowClick = () => {
    if (!email.is_read) onMarkRead(email.id);
  };

  return (
    <div
      onClick={handleRowClick}
      className={`flex items-center gap-3 px-6 py-3 border-b border-gray-100 cursor-pointer transition-colors hover:bg-gray-50 ${
        email.is_read ? "bg-white" : "bg-blue-50/40"
      }`}
    >
      {/* Unread dot */}
      <div className="w-2 flex-shrink-0">
        {!email.is_read && (
          <span className="block w-2 h-2 rounded-full bg-blue-500" />
        )}
      </div>

      {/* Sender avatar */}
      <div className="w-8 h-8 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center text-xs font-bold flex-shrink-0">
        {(email.sender || email.sender_email || "?")[0].toUpperCase()}
      </div>

      {/* Main content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <p className={`text-sm truncate ${email.is_read ? "text-gray-700" : "font-semibold text-gray-900"}`}>
            {email.sender || email.sender_email || "Unknown"}
          </p>
          {triage && (
            <span className={`flex-shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${triage.bg} ${triage.text}`}>
              {triage.label}
            </span>
          )}
          {email.replied_to && (
            <span className="flex-shrink-0 text-[10px] font-medium text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">
              Replied
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <p className="text-xs text-gray-700 truncate font-medium">
            {email.subject || "(no subject)"}
          </p>
          {email.snippet && (
            <>
              <span className="text-gray-300 text-xs">—</span>
              <p className="text-xs text-gray-400 truncate">{email.snippet}</p>
            </>
          )}
        </div>
      </div>

      {/* Right section */}
      <div className="flex items-center gap-3 flex-shrink-0">
        {/* Account label */}
        <span className="text-xs text-gray-400 hidden sm:block">
          {ACCOUNT_TYPE_EMOJI[email.account_type]} {email.gmail_address.split("@")[0]}
        </span>

        {/* Date */}
        {email.date && (
          <span className="text-xs text-gray-400 w-16 text-right">
            {formatDate(email.date)}
          </span>
        )}

        {/* Draft reply button */}
        <button
          onClick={(e) => { e.stopPropagation(); onDraft(); }}
          className="text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-lg transition-colors"
        >
          Draft Reply
        </button>
      </div>
    </div>
  );
}

// ── Utility ─────────────────────────────────────────────────────────────────

function formatDate(isoString) {
  const d = new Date(isoString);
  const now = new Date();
  const diff = now - d;
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (days < 7)  return d.toLocaleDateString([], { weekday: "short" });
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}
