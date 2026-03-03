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

const ACCOUNT_TYPE_EMOJI = {
  personal:  "🏠",
  edu:       "🎓",
  work:      "💼",
  freelance: "🚀",
};

const STATUS_DOT = {
  active:       "bg-green-400",
  needs_reauth: "bg-orange-400",
  syncing:      "bg-blue-400",
};

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

  // ── Aggregate sync stats across all accounts ──────────────────────────────
  const totalEmailsSynced = (accounts ?? []).reduce(
    (sum, a) => sum + (a.emails_synced ?? 0),
    0
  );
  const isSyncing = (accounts ?? []).some((a) => a.sync_status === "syncing");

  // ── Setup checklist steps ──────────────────────────────────────────────────
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
        : "Open Settings and click "Sync Now" to build your memory.",
      action: !hasSyncedEmails && !isSyncing ? (
        <Link to="/settings" className="text-blue-600 text-xs font-medium hover:underline">
          Go to Settings →
        </Link>
      ) : null,
    },
    {
      done:   hasAiKey,
      label:  "Add your AI API key",
      detail: "Paste your Claude, GPT, Grok, or Gemini key to enable AI features.",
      action: (
        <Link to="/settings" className="text-blue-600 text-xs font-medium hover:underline">
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
          className="text-blue-600 text-xs font-medium hover:underline"
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
        <Link to="/chat" className="text-blue-600 text-xs font-medium hover:underline">
          Open Chat →
        </Link>
      ),
    },
  ];

  // ── Stats ─────────────────────────────────────────────────────────────────
  const stats = [
    {
      label: "Gmail Accounts",
      value: accounts?.length ?? "—",
      icon:  "📬",
      sub:
        status?.limit === -1
          ? "Unlimited (Pro)"
          : `${status?.count ?? "…"} of ${status?.limit ?? "…"} on Free`,
    },
    {
      label: "Unread Emails",
      value: inboxStats ? inboxStats.total_unread.toLocaleString() : (isSyncing ? "…" : "—"),
      icon:  "📥",
      sub:   isSyncing ? "Sync in progress…" : "Across all accounts",
      link:  "/inbox",
    },
    {
      label: "Memory Chunks",
      value: memoryStats ? memoryStats.total_chunks.toLocaleString() : "—",
      icon:  "🧠",
      sub:
        memoryStats && memoryStats.emails_processed > 0
          ? `From ${memoryStats.emails_processed.toLocaleString()} processed emails`
          : "Sync emails to build memory",
      link:  null,
    },
  ];

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 p-8 overflow-y-auto pb-20 md:pb-8">
        <div className="max-w-4xl mx-auto">
          {/* Page header */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900">
              Good morning{firstName ? `, ${firstName}` : ""}. 👋
            </h1>
            <p className="text-gray-500 mt-1">Here's your MailMind overview.</p>
            <MemoryStats className="mt-2" />
          </div>

          {/* Setup checklist */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
            <h2 className="font-semibold text-gray-900 mb-5">Getting Started</h2>
            <ol className="space-y-5">
              {steps.map((step, i) => (
                <li key={step.label} className="flex items-start gap-4">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                      step.done
                        ? "bg-green-100 text-green-600"
                        : "bg-gray-100 text-gray-400"
                    }`}
                  >
                    {step.done ? "✓" : i + 1}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 text-sm">{step.label}</p>
                    {step.detail && (
                      <p className="text-gray-500 text-xs mt-0.5">{step.detail}</p>
                    )}
                    {step.action && <div className="mt-1.5">{step.action}</div>}
                  </div>
                </li>
              ))}
            </ol>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {stats.map((stat) => {
              const inner = (
                <>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-gray-500 text-sm">{stat.label}</span>
                    <span className="text-xl">{stat.icon}</span>
                  </div>
                  <div className="text-3xl font-bold text-gray-900 mb-1">
                    {stat.value}
                  </div>
                  <div className="text-gray-400 text-xs">{stat.sub}</div>
                </>
              );
              return stat.link ? (
                <Link
                  key={stat.label}
                  to={stat.link}
                  className="bg-white rounded-2xl border border-gray-200 p-5 hover:border-blue-300 transition-colors block"
                >
                  {inner}
                </Link>
              ) : (
                <div
                  key={stat.label}
                  className="bg-white rounded-2xl border border-gray-200 p-5"
                >
                  {inner}
                </div>
              );
            })}
          </div>

          {/* Connected Accounts section */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900">Connected Accounts</h2>
              <Link
                to="/settings"
                className="text-xs text-blue-600 font-medium hover:underline"
              >
                Manage →
              </Link>
            </div>

            {accountsLoading ? (
              <div className="space-y-2">
                {[1, 2].map((i) => (
                  <div
                    key={i}
                    className="h-12 bg-gray-100 rounded-xl animate-pulse"
                  />
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {(accounts ?? []).map((account) => (
                  <div
                    key={account.id}
                    className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl"
                  >
                    <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs flex-shrink-0">
                      {account.gmail_address[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {account.gmail_address}
                      </p>
                      <p className="text-xs text-gray-400">
                        {ACCOUNT_TYPE_EMOJI[account.account_type]}{" "}
                        {account.account_type.charAt(0).toUpperCase() +
                          account.account_type.slice(1)}
                        {account.emails_synced > 0 && (
                          <span className="ml-2 text-gray-300">
                            · {account.emails_synced.toLocaleString()} emails
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {account.sync_status === "syncing" ? (
                        <span className="inline-block w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                      ) : (
                        <span
                          className={`w-2 h-2 rounded-full ${
                            STATUS_DOT[account.status] ?? "bg-gray-300"
                          }`}
                        />
                      )}
                      {account.status === "needs_reauth" && (
                        <Link
                          to="/settings"
                          className="text-xs text-orange-600 font-medium hover:underline"
                        >
                          Re-auth
                        </Link>
                      )}
                    </div>
                  </div>
                ))}

                {/* Add account shortcut */}
                {status?.can_add_more && (
                  <button
                    onClick={() => setShowAddModal(true)}
                    className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-gray-200 text-gray-400 rounded-xl py-2.5 text-xs font-medium hover:border-blue-300 hover:text-blue-500 transition-colors"
                  >
                    + Add Gmail account
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Daily Insights card */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-gray-900">Today's Briefing</h2>
              {!dailyInsights && !insightsLoading && (
                <button
                  onClick={() => {
                    setInsightsLoading(true);
                    getDailyInsights()
                      .then((d) => setDailyInsights(d))
                      .catch(() => {})
                      .finally(() => setInsightsLoading(false));
                  }}
                  className="text-xs text-blue-600 font-medium hover:underline"
                >
                  Generate →
                </button>
              )}
            </div>
            {insightsLoading ? (
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <span className="w-3.5 h-3.5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                Generating your briefing…
              </div>
            ) : dailyInsights ? (
              <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                {dailyInsights.content}
              </p>
            ) : (
              <p className="text-sm text-gray-400">
                Click "Generate" to get your AI-powered morning email briefing.
              </p>
            )}
          </div>

          {/* Ask your AI anything — quick chat CTA */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
            <div className="flex items-start gap-4">
              <div className="text-3xl">💬</div>
              <div className="flex-1">
                <h2 className="font-semibold text-gray-900 mb-1">
                  Ask your AI anything
                </h2>
                <p className="text-gray-500 text-sm mb-3">
                  "What do I have this week?" · "Any emails about the contract?"
                  · "Summarise last month's newsletters."
                </p>
                <Link
                  to="/chat"
                  className="inline-block bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors"
                >
                  Open Chat →
                </Link>
              </div>
            </div>
          </div>

          {/* Upgrade nudge for free users at limit */}
          {user?.plan === "free" && !status?.can_add_more && (
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl p-6 text-white">
              <h3 className="font-semibold mb-1">Upgrade to Pro — $6/mo</h3>
              <p className="text-blue-100 text-sm mb-4">
                Unlimited Gmail accounts, full email history, and real-time sync.
              </p>
              <Link
                to="/settings"
                className="inline-block bg-white text-blue-700 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-50 transition-colors"
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
