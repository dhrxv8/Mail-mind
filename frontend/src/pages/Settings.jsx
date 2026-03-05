import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import AccountCard from "../components/AccountCard.jsx";
import AddAccountModal from "../components/AddAccountModal.jsx";
import BillingCard from "../components/BillingCard.jsx";
import Sidebar from "../components/Sidebar.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { useAccounts } from "../hooks/useAccounts.js";
import { setupWatch } from "../api/gmail.js";
import { getMemoryStats } from "../api/memory.js";
import { getInboxStats } from "../api/inbox.js";
import { saveAiKey, getAiKey, deleteAiKey } from "../api/settings.js";
import { cancelSubscription } from "../api/billing.js";

const AI_PROVIDERS = [
  { value: "anthropic", label: "Anthropic (Claude)",  defaultModel: "claude-3-5-sonnet-20241022", placeholder: "sk-ant-api03-…" },
  { value: "openai",    label: "OpenAI (GPT)",         defaultModel: "gpt-4o",                    placeholder: "sk-…"           },
  { value: "xai",       label: "xAI (Grok)",           defaultModel: "grok-2-latest",             placeholder: "xai-…"          },
  { value: "google",    label: "Google (Gemini)",       defaultModel: "gemini-2.0-flash",          placeholder: "AIza…"          },
];

export default function Settings() {
  const { user, fetchUser } = useAuth();
  const addToast = useToast();
  const { accounts, status, loading, error, refetch } = useAccounts();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);

  const [showAddModal, setShowAddModal]   = useState(false);
  const [banner, setBanner]               = useState(null);
  const [memoryByAccount, setMemoryByAccount] = useState({});
  const [unreadByAccount, setUnreadByAccount] = useState({});

  const [aiKey, setAiKey]               = useState(null);
  const [aiKeyLoading, setAiKeyLoading] = useState(true);
  const [aiProvider, setAiProvider]     = useState("anthropic");
  const [aiModel, setAiModel]           = useState("claude-3-5-sonnet-20241022");
  const [aiKeyInput, setAiKeyInput]     = useState("");
  const [aiKeySaving, setAiKeySaving]   = useState(false);
  const [aiKeyError, setAiKeyError]     = useState(null);
  const [aiKeyDeleting, setAiKeyDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getMemoryStats().then((data) => {
      if (cancelled) return;
      const map = {};
      for (const row of data.by_account ?? []) map[row.account_id] = row.chunk_count;
      setMemoryByAccount(map);
    }).catch(() => {});

    getInboxStats().then((data) => {
      if (cancelled) return;
      const map = {};
      for (const row of data.by_account ?? []) map[row.account_id] = row.unread_count;
      setUnreadByAccount(map);
    }).catch(() => {});

    getAiKey().then((data) => {
      if (cancelled) return;
      setAiKey(data);
      if (data.has_key) { setAiProvider(data.provider); setAiModel(data.model_preference); }
    }).catch(() => {}).finally(() => { if (!cancelled) setAiKeyLoading(false); });

    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const accountAdded  = searchParams.get("account_added");
    const reauthed      = searchParams.get("reauthed");
    const oauthError    = searchParams.get("error");

    if (accountAdded === "true") {
      setBanner({ type: "success", message: "Gmail account connected successfully. Starting sync…" });
      refetch();
      setSearchParams({}, { replace: true });
      (async () => {
        try {
          await new Promise((r) => setTimeout(r, 1500));
          const fresh = await refetch();
          if (fresh?.length) {
            const newest = [...fresh].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
            await setupWatch(newest.id);
          }
        } catch { /* Non-fatal */ }
      })();
    } else if (reauthed === "true") {
      setBanner({ type: "success", message: "Account re-authenticated successfully." });
      refetch(); setSearchParams({}, { replace: true });
    } else if (oauthError) {
      const messages = {
        account_limit:         "You've reached the Free plan limit of 2 accounts. Upgrade to Pro for unlimited.",
        already_connected:     "That Gmail account is already connected.",
        user_not_found:        "Session error — please sign out and sign back in.",
        oauth_exchange_failed: "Google authentication failed. Please try again.",
        userinfo_failed:       "Could not retrieve your Google profile. Please try again.",
        invalid_state:         "Authentication state mismatch. Please try again.",
      };
      setBanner({ type: "error", message: messages[oauthError] ?? "An error occurred during authentication." });
      setSearchParams({}, { replace: true });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => {
    if (!banner) return;
    const t = setTimeout(() => setBanner(null), 6000);
    return () => clearTimeout(t);
  }, [banner]);

  const handleProviderChange = (provider) => {
    setAiProvider(provider);
    const found = AI_PROVIDERS.find((p) => p.value === provider);
    setAiModel(found?.defaultModel ?? "");
    setAiKeyInput("");
    setAiKeyError(null);
  };

  const handleSaveAiKey = async (e) => {
    e.preventDefault();
    if (!aiKeyInput.trim()) { setAiKeyError("Please enter your API key."); return; }
    setAiKeySaving(true);
    setAiKeyError(null);
    try {
      const updated = await saveAiKey({ provider: aiProvider, api_key: aiKeyInput.trim(), model_preference: aiModel || undefined });
      setAiKey(updated);
      setAiKeyInput("");
      setBanner({ type: "success", message: "AI key saved and verified successfully!" });
    } catch (err) {
      setAiKeyError(err?.response?.data?.detail ?? "Failed to save API key. Please try again.");
    } finally {
      setAiKeySaving(false);
    }
  };

  const handleDeleteAiKey = async () => {
    setAiKeyDeleting(true);
    setAiKeyError(null);
    try {
      await deleteAiKey();
      setAiKey({ has_key: false });
      setAiKeyInput("");
      setAiProvider("anthropic");
      setAiModel("claude-3-5-sonnet-20241022");
    } catch (err) {
      setAiKeyError(err?.response?.data?.detail ?? "Failed to remove key.");
    } finally {
      setAiKeyDeleting(false);
    }
  };

  const handleCancelSubscription = async () => {
    setCancelLoading(true);
    try {
      await cancelSubscription();
      await fetchUser();
      setShowCancelModal(false);
      addToast("Subscription cancelled successfully.", "success");
    } catch (err) {
      addToast(err?.response?.data?.detail ?? "Failed to cancel. Please try again.", "error");
    } finally {
      setCancelLoading(false);
    }
  };

  const canAddMore = status?.can_add_more ?? false;
  const isAtLimit  = status ? !status.can_add_more : false;
  const limitLabel = status?.limit === -1 ? "Unlimited (Pro)" : `${status?.count ?? "…"} / ${status?.limit ?? "…"}`;

  return (
    <div className="flex min-h-screen bg-[#f5f6fa]">
      <Sidebar />
      <main className="flex-1 p-6 md:p-8 overflow-y-auto pb-20 md:pb-8">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight mb-7">Settings</h1>

          {/* Banner */}
          {banner && (
            <div
              className={`mb-6 flex items-start gap-3 px-4 py-3.5 rounded-xl border text-sm font-medium animate-slide-up ${
                banner.type === "success"
                  ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                  : "bg-red-50 border-red-200 text-red-800"
              }`}
            >
              <span className="flex-shrink-0 mt-0.5">
                {banner.type === "success" ? (
                  <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                )}
              </span>
              <span className="flex-1">{banner.message}</span>
              <button onClick={() => setBanner(null)} className="text-current opacity-50 hover:opacity-100 transition-opacity flex-shrink-0">×</button>
            </div>
          )}

          {/* Account profile */}
          <section className="bg-white rounded-2xl shadow-card border border-slate-100 p-6 mb-5">
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-4">Account</h2>
            <div className="flex items-center gap-4">
              {user?.avatar_url ? (
                <img src={user.avatar_url} alt={user.name} className="w-12 h-12 rounded-full object-cover ring-2 ring-brand-200" />
              ) : (
                <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg"
                     style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}>
                  {user?.name?.[0]?.toUpperCase()}
                </div>
              )}
              <div>
                <p className="font-semibold text-slate-900">{user?.name}</p>
                <p className="text-slate-500 text-sm">{user?.email}</p>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                    user?.plan === "pro"
                      ? "text-amber-700"
                      : "bg-slate-100 text-slate-500"
                  }`}
                    style={user?.plan === "pro" ? { background: "linear-gradient(135deg, #fef3c7, #fde68a)" } : undefined}>
                    {user?.plan === "pro" ? "★ Pro" : "Free Plan"}
                  </span>
                  {user?.plan === "pro" && (
                    <button
                      onClick={() => setShowCancelModal(true)}
                      className="text-[11px] text-slate-400 hover:text-red-500 transition-colors font-medium"
                    >
                      Cancel plan
                    </button>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* Connected Gmail Accounts */}
          <section className="bg-white rounded-2xl shadow-card border border-slate-100 p-6 mb-5">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Connected Gmail Accounts</h2>
              <span className="text-xs text-slate-400 font-medium">{limitLabel}</span>
            </div>
            <p className="text-slate-400 text-xs mb-4">
              {user?.plan === "free" ? "Free plan supports up to 2 Gmail accounts." : "Pro plan — unlimited Gmail accounts."}
            </p>

            {loading ? (
              <div className="space-y-3">
                {[1, 2].map((i) => (
                  <div key={i} className="h-20 bg-slate-50 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : error ? (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">{error}</div>
            ) : (
              <div className="space-y-3">
                {accounts.map((account) => (
                  <AccountCard
                    key={account.id}
                    account={account}
                    isPrimary={account.gmail_address === user?.email}
                    onUpdated={refetch}
                    chunkCount={memoryByAccount[account.id]}
                    unreadCount={unreadByAccount[account.id]}
                  />
                ))}
              </div>
            )}

            <div className="mt-4">
              <button
                onClick={() => setShowAddModal(true)}
                disabled={isAtLimit && user?.plan === "free"}
                className={`w-full flex items-center justify-center gap-2 border-2 border-dashed rounded-xl py-3 text-sm font-medium transition-colors ${
                  isAtLimit && user?.plan === "free"
                    ? "border-slate-100 text-slate-300 cursor-not-allowed"
                    : "border-slate-200 text-slate-400 hover:border-brand-300 hover:text-brand-500 hover:bg-brand-50/50"
                }`}
              >
                <span className="text-lg leading-none font-light">+</span>
                {isAtLimit && user?.plan === "free" ? "Upgrade to add more accounts" : "Add Gmail Account"}
              </button>
              {isAtLimit && user?.plan === "free" && (
                <p className="text-center text-xs text-slate-400 mt-2">
                  Free plan limit reached.{" "}
                  <button onClick={() => setShowAddModal(true)} className="text-brand-500 hover:underline font-medium">
                    Upgrade to Pro →
                  </button>
                </p>
              )}
            </div>
          </section>

          {/* AI Provider */}
          <section className="bg-white rounded-2xl shadow-card border border-slate-100 p-6 mb-5">
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">AI Provider</h2>
            <p className="text-slate-400 text-xs mb-4">
              Paste your API key once. Your key, your credits — MailMind never charges you for AI usage.
            </p>

            {aiKeyLoading ? (
              <div className="h-28 bg-slate-50 rounded-xl animate-pulse" />
            ) : aiKey?.has_key ? (
              <div>
                <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
                      <svg className="w-3 h-3 text-white" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-emerald-800">
                        {AI_PROVIDERS.find((p) => p.value === aiKey.provider)?.label ?? aiKey.provider} configured
                      </p>
                      <p className="text-xs text-emerald-600 mt-0.5">Model: {aiKey.model_preference}</p>
                    </div>
                  </div>
                  <button
                    onClick={handleDeleteAiKey}
                    disabled={aiKeyDeleting}
                    className="text-xs text-red-500 hover:text-red-700 font-medium disabled:opacity-60 ml-4"
                  >
                    {aiKeyDeleting ? "Removing…" : "Remove"}
                  </button>
                </div>
                <p className="text-xs text-slate-400 mb-3">Update your key or switch providers:</p>
                <AiKeyForm
                  provider={aiProvider} model={aiModel} keyInput={aiKeyInput}
                  saving={aiKeySaving} error={aiKeyError}
                  onProviderChange={handleProviderChange} onModelChange={setAiModel}
                  onKeyChange={setAiKeyInput} onSubmit={handleSaveAiKey}
                />
              </div>
            ) : (
              <AiKeyForm
                provider={aiProvider} model={aiModel} keyInput={aiKeyInput}
                saving={aiKeySaving} error={aiKeyError}
                onProviderChange={handleProviderChange} onModelChange={setAiModel}
                onKeyChange={setAiKeyInput} onSubmit={handleSaveAiKey}
              />
            )}
          </section>

          {/* Billing */}
          <section className="bg-white rounded-2xl shadow-card border border-slate-100 p-6 mb-5">
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-4">Billing</h2>
            <BillingCard />
          </section>
        </div>
      </main>

      {showAddModal && (
        <AddAccountModal onClose={() => setShowAddModal(false)} canAdd={canAddMore} />
      )}

      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !cancelLoading && setShowCancelModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl border border-slate-100 max-w-sm w-full p-6 animate-slide-up">
            <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
              <svg className="w-6 h-6 text-red-600" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-slate-900 text-center mb-1">Cancel Pro Subscription?</h3>
            <p className="text-sm text-slate-500 text-center mb-6">
              You'll immediately lose access to unlimited accounts, full email history, and real-time sync. This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowCancelModal(false)}
                disabled={cancelLoading}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-60"
              >
                Keep Pro
              </button>
              <button
                onClick={handleCancelSubscription}
                disabled={cancelLoading}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-red-600 hover:bg-red-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-1.5"
              >
                {cancelLoading && (
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                )}
                {cancelLoading ? "Cancelling…" : "Cancel Subscription"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AiKeyForm({ provider, model, keyInput, saving, error, onProviderChange, onModelChange, onKeyChange, onSubmit }) {
  const selected = AI_PROVIDERS.find((p) => p.value === provider) ?? AI_PROVIDERS[0];

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div>
        <label className="text-xs font-semibold text-slate-600 block mb-1.5">Provider</label>
        <select
          value={provider}
          onChange={(e) => onProviderChange(e.target.value)}
          className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 transition-all"
        >
          {AI_PROVIDERS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
      </div>

      <div>
        <label className="text-xs font-semibold text-slate-600 block mb-1.5">Model</label>
        <input
          type="text"
          value={model}
          onChange={(e) => onModelChange(e.target.value)}
          placeholder={selected.defaultModel}
          className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 transition-all placeholder-slate-300"
        />
      </div>

      <div>
        <label className="text-xs font-semibold text-slate-600 block mb-1.5">API Key</label>
        <input
          type="password"
          value={keyInput}
          onChange={(e) => onKeyChange(e.target.value)}
          placeholder={selected.placeholder}
          autoComplete="off"
          className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 transition-all placeholder-slate-300"
        />
        <p className="text-xs text-slate-400 mt-1.5">Encrypted at rest · never sent to third parties.</p>
      </div>

      {error && (
        <p className="text-xs text-red-600 flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={saving}
        className="w-full text-white py-2.5 rounded-xl text-sm font-semibold transition-all duration-150 disabled:opacity-60 flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.99]"
        style={{ background: "linear-gradient(135deg, #4f46e5, #6366f1)" }}
      >
        {saving ? (
          <>
            <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            Verifying key…
          </>
        ) : "Save & Verify"}
      </button>
    </form>
  );
}
