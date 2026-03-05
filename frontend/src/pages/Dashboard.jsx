import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import AddAccountModal from "../components/AddAccountModal.jsx";
import MemoryStats from "../components/MemoryStats.jsx";
import Sidebar from "../components/Sidebar.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useAccounts } from "../hooks/useAccounts.js";
import { getMemoryStats } from "../api/memory.js";
import { getDailyInsights, getInboxStats } from "../api/inbox.js";
import { getAiKey } from "../api/settings.js";

import { ACCOUNT_TYPE_LABEL, STATUS_COLOR } from "../constants.js";

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export default function Dashboard() {
  const { user } = useAuth();
  const { accounts, status, loading: accountsLoading } = useAccounts();
  const [showAddModal, setShowAddModal] = useState(false);
  const [memoryStats,    setMemoryStats]    = useState(null);
  const [inboxStats,     setInboxStats]     = useState(null);
  const [dailyInsights,  setDailyInsights]  = useState(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [aiKeyConfigured, setAiKeyConfigured] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getMemoryStats()
      .then((data) => { if (!cancelled) setMemoryStats(data); })
      .catch(() => {});
    getInboxStats()
      .then((data) => { if (!cancelled) setInboxStats(data); })
      .catch(() => {});
    getAiKey()
      .then((data) => { if (!cancelled) setAiKeyConfigured(data.has_key ?? false); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const firstName = user?.name?.split(" ")[0] ?? "";

  const totalEmailsSynced = (accounts ?? []).reduce((sum, a) => sum + (a.emails_synced ?? 0), 0);
  const isSyncing = (accounts ?? []).some((a) => a.sync_status === "syncing");

  const hasAiKey        = aiKeyConfigured;
  const hasMultiAccount = (accounts?.length ?? 0) > 1;
  const hasSyncedEmails = totalEmailsSynced > 0;

  const steps = [
    {
      done:   true,
      label:  "Connected Gmail account",
      detail: user?.email,
      action: null,
    },
    {
      done:   hasSyncedEmails,
      label:  "Sync your email history",
      detail: isSyncing
        ? "Sync in progress — this may take a few minutes."
        : "Open Settings and click \u201cSync Now\u201d to build your memory.",
      action: !hasSyncedEmails && !isSyncing ? (
        <Link to="/settings" className="text-brand-500 text-xs font-medium hover:text-brand-600">
          Go to Settings →
        </Link>
      ) : null,
    },
    {
      done:   hasAiKey,
      label:  "Add your AI API key",
      detail: "Paste your Claude, GPT, Grok, or Gemini key to enable AI features.",
      action: (
        <Link to="/settings" className="text-brand-500 text-xs font-medium hover:text-brand-600">
          Go to Settings →
        </Link>
      ),
    },
    {
      done:   hasMultiAccount,
      label:  "Connect a second Gmail (optional)",
      detail: "Add your .edu, work, or freelance account for a unified view.",
      action: (
        <button
          onClick={() => setShowAddModal(true)}
          className="text-brand-500 text-xs font-medium hover:text-brand-600"
        >
          Add Gmail account →
        </button>
      ),
    },
    {
      done:   false,
      label:  "Start chatting with your email AI",
      detail: `Ask anything: "What do I have going on this week?"`,
      action: (
        <Link to="/chat" className="text-brand-500 text-xs font-medium hover:text-brand-600">
          Open Chat →
        </Link>
      ),
    },
  ];

  const statCards = [
    {
      label: "Gmail Accounts",
      value: accounts?.length ?? "—",
      sub:   status?.limit === -1 ? "Unlimited · Pro" : `${status?.count ?? "…"} of ${status?.limit ?? "…"} on Free`,
      gradient: "from-brand-600 to-violet-600",
      icon: (
        <svg className="w-5 h-5 text-white/70" viewBox="0 0 20 20" fill="currentColor">
          <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
          <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
        </svg>
      ),
      link: null,
    },
    {
      label: "Unread Emails",
      value: inboxStats ? inboxStats.total_unread.toLocaleString() : (isSyncing ? "…" : "—"),
      sub:   isSyncing ? "Sync in progress…" : "Across all accounts",
      gradient: "from-sky-500 to-brand-500",
      icon: (
        <svg className="w-5 h-5 text-white/70" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M5 3a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2V5a2 2 0 00-2-2H5zm0 2h10v7h-2l-1 2H8l-1-2H5V5z" clipRule="evenodd" />
        </svg>
      ),
      link: "/inbox",
    },
    {
      label: "Memory Chunks",
      value: memoryStats ? memoryStats.total_chunks.toLocaleString() : "—",
      sub:   memoryStats?.emails_processed > 0
        ? `From ${memoryStats.emails_processed.toLocaleString()} emails`
        : "Sync emails to build memory",
      gradient: "from-emerald-500 to-teal-500",
      icon: (
        <svg className="w-5 h-5 text-white/70" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M3 5a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2h-2.22l.123.489.804.804A1 1 0 0113 18H7a1 1 0 01-.707-1.707l.804-.804L7.22 15H5a2 2 0 01-2-2V5zm5.771 7H5V5h10v7H8.771z" clipRule="evenodd" />
        </svg>
      ),
      link: null,
    },
  ];

  return (
    <div className="flex min-h-screen bg-[#f5f6fa]">
      <Sidebar />
      <main className="flex-1 p-6 md:p-8 overflow-y-auto pb-20 md:pb-8">
        <div className="max-w-4xl mx-auto">

          {/* Page header */}
          <div className="mb-7">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              {getGreeting()}{firstName ? `, ${firstName}` : ""}
            </h1>
            <p className="text-slate-500 mt-1 text-sm">Here's your MailMind overview.</p>
            <MemoryStats className="mt-2" />
          </div>

          {/* Stat cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {statCards.map((stat) => {
              const inner = (
                <div className={`bg-gradient-to-br ${stat.gradient} rounded-2xl p-5 h-full`}>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-white/70 text-xs font-medium uppercase tracking-wide">
                      {stat.label}
                    </span>
                    {stat.icon}
                  </div>
                  <div className="text-3xl font-bold text-white mb-1 tabular-nums">
                    {stat.value}
                  </div>
                  <div className="text-white/60 text-xs">{stat.sub}</div>
                </div>
              );
              return stat.link ? (
                <Link
                  key={stat.label}
                  to={stat.link}
                  className="block rounded-2xl shadow-card hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-200"
                >
                  {inner}
                </Link>
              ) : (
                <div key={stat.label} className="rounded-2xl shadow-card">
                  {inner}
                </div>
              );
            })}
          </div>

          {/* Setup checklist */}
          <div className="bg-white rounded-2xl shadow-card border border-slate-100 p-6 mb-5">
            <h2 className="font-semibold text-slate-900 text-sm uppercase tracking-wide mb-5">
              Getting Started
            </h2>
            <ol className="space-y-4">
              {steps.map((step, i) => (
                <li key={step.label} className="flex items-start gap-4">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5 ${
                      step.done
                        ? "bg-emerald-100 text-emerald-600"
                        : "bg-slate-100 text-slate-400"
                    }`}
                  >
                    {step.done ? (
                      <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    ) : (
                      i + 1
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`font-medium text-sm ${step.done ? "text-slate-400 line-through" : "text-slate-800"}`}>
                      {step.label}
                    </p>
                    {step.detail && (
                      <p className="text-slate-400 text-xs mt-0.5 truncate">{step.detail}</p>
                    )}
                    {step.action && <div className="mt-1.5">{step.action}</div>}
                  </div>
                </li>
              ))}
            </ol>
          </div>

          {/* Connected Accounts */}
          <div className="bg-white rounded-2xl shadow-card border border-slate-100 p-6 mb-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-slate-900 text-sm">Connected Accounts</h2>
              <Link to="/settings" className="text-xs text-brand-500 font-medium hover:text-brand-600">
                Manage →
              </Link>
            </div>

            {accountsLoading ? (
              <div className="space-y-2">
                {[1, 2].map((i) => (
                  <div key={i} className="h-12 bg-slate-50 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {(accounts ?? []).map((account) => {
                  const sc = STATUS_COLOR[account.status] ?? STATUS_COLOR.active;
                  return (
                    <div
                      key={account.id}
                      className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl hover:bg-slate-100/80 transition-colors"
                    >
                      <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs flex-shrink-0 text-brand-700"
                           style={{ background: "linear-gradient(135deg, #e0e7ff, #c7d2fe)" }}>
                        {account.gmail_address[0].toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate">
                          {account.gmail_address}
                        </p>
                        <p className="text-xs text-slate-400">
                          {ACCOUNT_TYPE_LABEL[account.account_type]}
                          {account.emails_synced > 0 && (
                            <span className="ml-1.5 text-slate-300">· {account.emails_synced.toLocaleString()} emails</span>
                          )}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {account.sync_status === "syncing" ? (
                          <span className={`w-2.5 h-2.5 rounded-full bg-brand-400 animate-pulse ring-2 ${sc.ring}`} />
                        ) : (
                          <span className={`w-2.5 h-2.5 rounded-full ${sc.dot} ring-2 ${sc.ring}`} />
                        )}
                        {account.status === "needs_reauth" && (
                          <Link to="/settings" className="text-xs text-amber-600 font-medium hover:underline">
                            Re-auth
                          </Link>
                        )}
                      </div>
                    </div>
                  );
                })}

                {status?.can_add_more && (
                  <button
                    onClick={() => setShowAddModal(true)}
                    className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-slate-200 text-slate-400 rounded-xl py-2.5 text-xs font-medium hover:border-brand-300 hover:text-brand-500 transition-colors"
                  >
                    + Add Gmail account
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Daily Briefing */}
          <div className="bg-white rounded-2xl shadow-card border border-slate-100 p-6 mb-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-slate-900 text-sm">Today's Briefing</h2>
              {!dailyInsights && !insightsLoading && (
                <button
                  onClick={() => {
                    setInsightsLoading(true);
                    getDailyInsights()
                      .then((d) => setDailyInsights(d))
                      .catch(() => {})
                      .finally(() => setInsightsLoading(false));
                  }}
                  className="text-xs text-brand-500 font-medium hover:text-brand-600"
                >
                  Generate →
                </button>
              )}
            </div>
            {insightsLoading ? (
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <span className="w-3.5 h-3.5 border-2 border-brand-400 border-t-transparent rounded-full animate-spin" />
                Generating your briefing…
              </div>
            ) : dailyInsights ? (
              <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                {dailyInsights.content}
              </p>
            ) : (
              <p className="text-sm text-slate-400">
                Click "Generate" to get your AI-powered morning email briefing.
              </p>
            )}
          </div>

          {/* Chat CTA */}
          <div className="bg-white rounded-2xl shadow-card border border-slate-100 p-6 mb-5">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center"
                   style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}>
                <svg className="w-5 h-5 text-white" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zm-8-3a1 1 0 100 2 1 1 0 000-2zm-3 3a1 1 0 100 2 1 1 0 000-2zm6 0a1 1 0 100 2 1 1 0 000-2z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="flex-1">
                <h2 className="font-semibold text-slate-900 text-sm mb-1">Ask your AI anything</h2>
                <p className="text-slate-400 text-xs mb-3 leading-relaxed">
                  "What do I have this week?" · "Any emails about the contract?" · "Summarise last month's newsletters."
                </p>
                <Link
                  to="/chat"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-white px-4 py-2 rounded-xl transition-all duration-150 hover:opacity-90 active:scale-[0.98]"
                  style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}
                >
                  Open Chat
                  <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                  </svg>
                </Link>
              </div>
            </div>
          </div>

          {/* Upgrade nudge */}
          {user?.plan === "free" && !status?.can_add_more && (
            <div className="rounded-2xl p-6 text-white"
                 style={{ background: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)" }}>
              <h3 className="font-semibold mb-1 text-sm">Upgrade to Pro — $6/mo</h3>
              <p className="text-brand-200 text-xs mb-4">
                Unlimited Gmail accounts, full email history, and real-time sync.
              </p>
              <Link
                to="/settings"
                className="inline-block bg-white text-brand-700 px-4 py-2 rounded-lg text-xs font-semibold hover:bg-brand-50 transition-colors"
              >
                Upgrade Now
              </Link>
            </div>
          )}
        </div>
      </main>

      {showAddModal && (
        <AddAccountModal
          onClose={() => setShowAddModal(false)}
          canAdd={status?.can_add_more ?? false}
        />
      )}
    </div>
  );
}
