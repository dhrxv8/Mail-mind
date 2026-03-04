import { useCallback, useEffect, useState } from "react";
import EmailDraftModal from "../components/EmailDraftModal.jsx";
import Sidebar from "../components/Sidebar.jsx";
import { useAccounts } from "../hooks/useAccounts.js";
import { getInbox, markRead } from "../api/inbox.js";

const TRIAGE_CONFIG = {
  urgent:          { label: "Urgent",          bg: "bg-red-50",     text: "text-red-600",    dot: "bg-red-400",    border: "border-red-100"   },
  action_required: { label: "Action required", bg: "bg-amber-50",   text: "text-amber-600",  dot: "bg-amber-400",  border: "border-amber-100" },
  fyi:             { label: "FYI",             bg: "bg-slate-50",   text: "text-slate-500",  dot: "bg-slate-300",  border: "border-slate-100" },
};

const ACCOUNT_TYPE_LABEL = {
  personal:  "Personal",
  edu:       "Education",
  work:      "Work",
  freelance: "Freelance",
};

export default function Inbox() {
  const { accounts } = useAccounts();

  const [accountFilter,  setAccountFilter]  = useState(null);
  const [readFilter,     setReadFilter]     = useState(null);
  const [triageFilter,   setTriageFilter]   = useState(null);
  const [searchQuery,    setSearchQuery]    = useState("");
  const [page,           setPage]           = useState(1);

  const [result,   setResult]   = useState({ emails: [], total: 0, has_more: false });
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);
  const [draftEmail, setDraftEmail] = useState(null);

  const loadInbox = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = { page, limit: 25 };
      if (accountFilter)           params.account_id   = accountFilter;
      if (readFilter !== null)     params.is_read      = readFilter;
      if (triageFilter)            params.triage_label = triageFilter;
      if (searchQuery.trim())      params.q            = searchQuery.trim();
      const data = await getInbox(params);
      setResult(data);
    } catch {
      setError("Failed to load inbox. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [accountFilter, readFilter, triageFilter, searchQuery, page]);

  useEffect(() => { loadInbox(); }, [loadInbox]);
  useEffect(() => { setPage(1); }, [accountFilter, readFilter, triageFilter, searchQuery]);

  const handleMarkRead = async (emailId) => {
    try {
      await markRead(emailId);
      setResult((prev) => ({
        ...prev,
        emails: prev.emails.map((e) => e.id === emailId ? { ...e, is_read: true } : e),
      }));
    } catch { /* non-fatal */ }
  };

  return (
    <div className="flex min-h-screen bg-[#f5f6fa]">
      <Sidebar />

      <main className="flex-1 flex flex-col overflow-hidden h-screen pb-16 md:pb-0">
        {/* Top bar */}
        <div className="bg-white border-b border-slate-100 px-6 py-4 flex-shrink-0 shadow-sm">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <h1 className="text-lg font-bold text-slate-900 tracking-tight">Inbox</h1>

            {/* Search */}
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search emails..."
                className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 bg-slate-50 placeholder-slate-400 transition-all"
              />
            </div>
          </div>

          {/* Filter row */}
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <FilterPill active={accountFilter === null} onClick={() => setAccountFilter(null)}>All accounts</FilterPill>
            {(accounts ?? []).map((acct) => (
              <FilterPill key={acct.id} active={accountFilter === acct.id} onClick={() => setAccountFilter(acct.id)}>
                {acct.gmail_address.split("@")[0]}
              </FilterPill>
            ))}

            <span className="text-slate-200 text-xs select-none">|</span>

            {[{ label: "All", val: null }, { label: "Unread", val: false }, { label: "Read", val: true }].map(({ label, val }) => (
              <FilterPill key={label} active={readFilter === val} onClick={() => setReadFilter(val)}>{label}</FilterPill>
            ))}

            <span className="text-slate-200 text-xs select-none">|</span>

            {[
              { label: "All",           val: null             },
              { label: "Urgent",        val: "urgent"          },
              { label: "Action req.",   val: "action_required" },
              { label: "FYI",           val: "fyi"             },
            ].map(({ label, val }) => (
              <FilterPill key={label} active={triageFilter === val} onClick={() => setTriageFilter(val)}>{label}</FilterPill>
            ))}
          </div>
        </div>

        {/* Email list */}
        <div className="flex-1 overflow-y-auto bg-white">
          {error && (
            <div className="m-4 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-center gap-2 animate-slide-up">
              <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              {error}
            </div>
          )}

          {loading ? (
            <div className="space-y-px">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-6 py-3.5 border-b border-slate-50">
                  <div className="w-2 flex-shrink-0" />
                  <div className="w-8 h-8 rounded-full bg-slate-100 animate-pulse" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3.5 w-32 bg-slate-100 rounded animate-pulse" />
                    <div className="h-3 w-48 bg-slate-50 rounded animate-pulse" />
                  </div>
                  <div className="h-3 w-10 bg-slate-50 rounded animate-pulse" />
                </div>
              ))}
            </div>
          ) : result.emails.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center animate-fade-in">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3"
                   style={{ background: "linear-gradient(135deg, #eef2ff, #e0e7ff)" }}>
                <svg className="w-6 h-6 text-brand-400" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                  <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                </svg>
              </div>
              <p className="text-slate-500 text-sm font-medium">No emails match your filters</p>
              <p className="text-slate-400 text-xs mt-1">Try adjusting the filters above</p>
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
              <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100">
                <p className="text-xs text-slate-400">
                  {result.total.toLocaleString()} email{result.total !== 1 ? "s" : ""}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(p - 1, 1))}
                    disabled={page <= 1}
                    className="px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg hover:bg-slate-50 hover:border-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                  >
                    ← Prev
                  </button>
                  <span className="px-3 py-1.5 text-xs text-slate-500 font-medium tabular-nums">Page {page}</span>
                  <button
                    onClick={() => setPage((p) => p + 1)}
                    disabled={!result.has_more}
                    className="px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg hover:bg-slate-50 hover:border-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                  >
                    Next →
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {draftEmail && (
        <EmailDraftModal
          email={draftEmail}
          onClose={() => setDraftEmail(null)}
          onSent={() => { setDraftEmail(null); loadInbox(); }}
        />
      )}
    </div>
  );
}

function FilterPill({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 text-xs rounded-full font-medium transition-all duration-150 ${
        active
          ? "text-white shadow-sm"
          : "bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700"
      }`}
      style={active ? { background: "linear-gradient(135deg, #4f46e5, #6366f1)" } : undefined}
    >
      {children}
    </button>
  );
}

function EmailRow({ email, onMarkRead, onDraft }) {
  const triage = email.triage_label ? TRIAGE_CONFIG[email.triage_label] : null;

  return (
    <div
      onClick={() => { if (!email.is_read) onMarkRead(email.id); }}
      className={`flex items-center gap-3 px-6 py-3.5 border-b border-slate-50 cursor-pointer transition-all duration-150 hover:bg-slate-50/80 group ${
        email.is_read ? "bg-white" : "bg-brand-50/30"
      }`}
    >
      {/* Unread indicator */}
      <div className="w-2 flex-shrink-0">
        {!email.is_read && (
          <span className="block w-2 h-2 rounded-full animate-pulse-dot"
                style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }} />
        )}
      </div>

      {/* Sender avatar */}
      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 transition-transform duration-150 group-hover:scale-105 ${
        email.is_read ? "bg-slate-100 text-slate-500" : "text-brand-700"
      }`}
           style={!email.is_read ? { background: "linear-gradient(135deg, #e0e7ff, #c7d2fe)" } : undefined}>
        {(email.sender || email.sender_email || "?")[0].toUpperCase()}
      </div>

      {/* Main content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <p className={`text-sm truncate ${email.is_read ? "text-slate-600" : "font-semibold text-slate-900"}`}>
            {email.sender || email.sender_email || "Unknown"}
          </p>
          {triage && (
            <span className={`flex-shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${triage.bg} ${triage.text} ${triage.border}`}>
              {triage.label}
            </span>
          )}
          {email.replied_to && (
            <span className="flex-shrink-0 text-[10px] font-medium text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full border border-slate-200">Replied</span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <p className={`text-xs truncate ${email.is_read ? "text-slate-500" : "text-slate-700 font-medium"}`}>
            {email.subject || "(no subject)"}
          </p>
          {email.snippet && (
            <>
              <span className="text-slate-300 text-xs flex-shrink-0">—</span>
              <p className="text-xs text-slate-400 truncate">{email.snippet}</p>
            </>
          )}
        </div>
      </div>

      {/* Right section */}
      <div className="flex items-center gap-3 flex-shrink-0">
        <span className="text-xs text-slate-400 hidden sm:block">
          {ACCOUNT_TYPE_LABEL[email.account_type] ?? ""}{email.gmail_address ? ` · ${email.gmail_address.split("@")[0]}` : ""}
        </span>
        {email.date && (
          <span className="text-xs text-slate-400 w-14 text-right tabular-nums">{formatDate(email.date)}</span>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); onDraft(); }}
          className="text-xs font-medium text-brand-600 bg-brand-50 hover:bg-brand-100 px-2.5 py-1 rounded-lg transition-all opacity-0 group-hover:opacity-100 active:scale-95 border border-brand-100"
        >
          Draft Reply
        </button>
      </div>
    </div>
  );
}

function formatDate(isoString) {
  const d = new Date(isoString);
  const now = new Date();
  const days = Math.floor((now - d) / 86_400_000);
  if (days === 0) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (days < 7)  return d.toLocaleDateString([], { weekday: "short" });
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}
