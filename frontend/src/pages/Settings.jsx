import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import AccountCard from "../components/AccountCard.jsx";
import AddAccountModal from "../components/AddAccountModal.jsx";
import BillingCard from "../components/BillingCard.jsx";
import Sidebar from "../components/Sidebar.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useAccounts } from "../hooks/useAccounts.js";
import { setupWatch } from "../api/gmail.js";
import { getMemoryStats } from "../api/memory.js";
import { getInboxStats } from "../api/inbox.js";
import { saveAiKey, getAiKey, deleteAiKey } from "../api/settings.js";

const AI_PROVIDERS = [
  {
    value:        "anthropic",
    label:        "Anthropic (Claude)",
    defaultModel: "claude-3-5-sonnet-20241022",
    placeholder:  "sk-ant-api03-…",
  },
  {
    value:        "openai",
    label:        "OpenAI (GPT)",
    defaultModel: "gpt-4o",
    placeholder:  "sk-…",
  },
  {
    value:        "xai",
    label:        "xAI (Grok)",
    defaultModel: "grok-2-latest",
    placeholder:  "xai-…",
  },
  {
    value:        "google",
    label:        "Google (Gemini)",
    defaultModel: "gemini-2.0-flash",
    placeholder:  "AIza…",
  },
];

export default function Settings() {
  const { user, fetchUser } = useAuth();
  const { accounts, status, loading, error, refetch } = useAccounts();
  const [searchParams, setSearchParams] = useSearchParams();

  const [showAddModal, setShowAddModal]   = useState(false);
  const [banner, setBanner]               = useState(null);
  const [memoryByAccount, setMemoryByAccount] = useState({});
  const [unreadByAccount, setUnreadByAccount] = useState({});

  // AI key state
  const [aiKey, setAiKey]               = useState(null);
  const [aiKeyLoading, setAiKeyLoading] = useState(true);
  const [aiProvider, setAiProvider]     = useState("anthropic");
  const [aiModel, setAiModel]           = useState("claude-3-5-sonnet-20241022");
  const [aiKeyInput, setAiKeyInput]     = useState("");
  const [aiKeySaving, setAiKeySaving]   = useState(false);
  const [aiKeyError, setAiKeyError]     = useState(null);
  const [aiKeyDeleting, setAiKeyDeleting] = useState(false);

  // ── Fetch stats + AI key on mount ───────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    getMemoryStats()
      .then((data) => {
        if (cancelled) return;
        const map = {};
        for (const row of data.by_account ?? []) map[row.account_id] = row.chunk_count;
        setMemoryByAccount(map);
      })
      .catch(() => {});

    getInboxStats()
      .then((data) => {
        if (cancelled) return;
        const map = {};
        for (const row of data.by_account ?? []) map[row.account_id] = row.unread_count;
        setUnreadByAccount(map);
      })
      .catch(() => {});

    getAiKey()
      .then((data) => {
        if (cancelled) return;
        setAiKey(data);
        if (data.has_key) {
          setAiProvider(data.provider);
          setAiModel(data.model_preference);
        }
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setAiKeyLoading(false); });

    return () => { cancelled = true; };
  }, []);

  // ── Handle redirect query params ─────────────────────────────────────────────
  useEffect(() => {
    const accountAdded   = searchParams.get("account_added");
    const reauthed       = searchParams.get("reauthed");
    const oauthError     = searchParams.get("error");
    const upgradeStatus  = searchParams.get("upgrade");

    if (accountAdded === "true") {
      setBanner({ type: "success", message: "Gmail account connected successfully. Starting sync…" });
      refetch();
      setSearchParams({}, { replace: true });

      (async () => {
        try {
          await new Promise((r) => setTimeout(r, 1500));
          const fresh = await refetch();
          if (fresh?.length) {
            const newest = [...fresh].sort(
              (a, b) => new Date(b.created_at) - new Date(a.created_at)
            )[0];
            await setupWatch(newest.id);
          }
        } catch {
          // Non-fatal
        }
      })();

    } else if (reauthed === "true") {
      setBanner({ type: "success", message: "Account re-authenticated successfully." });
      refetch();
      setSearchParams({}, { replace: true });

    } else if (upgradeStatus === "success") {
      setBanner({ type: "success", message: "Welcome to Pro! Your plan has been upgraded. ⭐" });
      fetchUser();
      setSearchParams({}, { replace: true });

    } else if (upgradeStatus === "cancelled") {
      setBanner({ type: "error", message: "Upgrade cancelled. You're still on the Free plan." });
      setSearchParams({}, { replace: true });

    } else if (oauthError) {
      const messages = {
        account_limit:
          "You've reached the Free plan limit of 2 accounts. Upgrade to Pro for unlimited.",
        already_connected: "That Gmail account is already connected.",
        user_not_found:    "Session error — please sign out and sign back in.",
        oauth_exchange_failed: "Google authentication failed. Please try again.",
        userinfo_failed:   "Could not retrieve your Google profile. Please try again.",
        invalid_state:     "Authentication state mismatch. Please try again.",
      };
      setBanner({
        type: "error",
        message: messages[oauthError] ?? "An error occurred during authentication.",
      });
      setSearchParams({}, { replace: true });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Auto-dismiss banner after 6 s
  useEffect(() => {
    if (!banner) return;
    const t = setTimeout(() => setBanner(null), 6000);
    return () => clearTimeout(t);
  }, [banner]);

  // ── AI key handlers ──────────────────────────────────────────────────────────
  const handleProviderChange = (provider) => {
    setAiProvider(provider);
    const found = AI_PROVIDERS.find((p) => p.value === provider);
    setAiModel(found?.defaultModel ?? "");
    setAiKeyInput("");
    setAiKeyError(null);
  };

  const handleSaveAiKey = async (e) => {
    e.preventDefault();
    if (!aiKeyInput.trim()) {
      setAiKeyError("Please enter your API key.");
      return;
    }
    setAiKeySaving(true);
    setAiKeyError(null);
    try {
      const updated = await saveAiKey({
        provider: aiProvider,
        api_key:  aiKeyInput.trim(),
        model_preference: aiModel || undefined,
      });
      setAiKey(updated);
      setAiKeyInput("");
      setBanner({ type: "success", message: "AI key saved and verified successfully!" });
    } catch (err) {
      setAiKeyError(
        err?.response?.data?.detail ?? "Failed to save API key. Please try again."
      );
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

  const canAddMore = status?.can_add_more ?? false;
  const isAtLimit  = status ? !status.can_add_more : false;
  const limitLabel =
    status?.limit === -1
      ? "Unlimited (Pro)"
      : `${status?.count ?? "…"} / ${status?.limit ?? "…"}`;

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 p-8 overflow-y-auto">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-2xl font-bold text-gray-900 mb-8">Settings</h1>

          {/* ── Banner ────────────────────────────────────────────────────────── */}
          {banner && (
            <div
              className={`mb-6 flex items-start gap-3 px-4 py-3 rounded-xl border text-sm font-medium ${
                banner.type === "success"
                  ? "bg-green-50 border-green-200 text-green-800"
                  : "bg-red-50 border-red-200 text-red-800"
              }`}
            >
              <span>{banner.type === "success" ? "✓" : "⚠"}</span>
              <span className="flex-1">{banner.message}</span>
              <button
                onClick={() => setBanner(null)}
                className="text-current opacity-60 hover:opacity-100"
              >
                ×
              </button>
            </div>
          )}

          {/* ── Account profile ───────────────────────────────────────────────── */}
          <section className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
            <h2 className="font-semibold text-gray-900 mb-4">Account</h2>
            <div className="flex items-center gap-4">
              {user?.avatar_url ? (
                <img
                  src={user.avatar_url}
                  alt={user.name}
                  className="w-12 h-12 rounded-full object-cover"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-lg">
                  {user?.name?.[0]?.toUpperCase()}
                </div>
              )}
              <div>
                <p className="font-medium text-gray-900">{user?.name}</p>
                <p className="text-gray-500 text-sm">{user?.email}</p>
                <span
                  className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                    user?.plan === "pro"
                      ? "bg-blue-100 text-blue-700"
                      : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {user?.plan === "pro" ? "⭐ Pro" : "Free Plan"}
                </span>
              </div>
            </div>
          </section>

          {/* ── Connected Gmail Accounts ──────────────────────────────────────── */}
          <section className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
            <div className="flex items-center justify-between mb-1">
              <h2 className="font-semibold text-gray-900">Connected Gmail Accounts</h2>
              <span className="text-xs text-gray-400">{limitLabel}</span>
            </div>
            <p className="text-gray-500 text-sm mb-4">
              {user?.plan === "free"
                ? "Free plan supports up to 2 Gmail accounts."
                : "Pro plan — unlimited Gmail accounts."}
            </p>

            {loading ? (
              <div className="space-y-3">
                {[1, 2].map((i) => (
                  <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : error ? (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
                {error}
              </div>
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
                    ? "border-gray-200 text-gray-300 cursor-not-allowed"
                    : "border-gray-300 text-gray-500 hover:border-blue-400 hover:text-blue-600"
                }`}
              >
                <span className="text-lg leading-none">+</span>
                {isAtLimit && user?.plan === "free"
                  ? "Upgrade to add more accounts"
                  : "Add Gmail Account"}
              </button>
              {isAtLimit && user?.plan === "free" && (
                <p className="text-center text-xs text-gray-400 mt-2">
                  Free plan limit reached.{" "}
                  <button
                    onClick={() => setShowAddModal(true)}
                    className="text-blue-500 hover:underline"
                  >
                    Upgrade to Pro →
                  </button>
                </p>
              )}
            </div>
          </section>

          {/* ── AI Provider ───────────────────────────────────────────────────── */}
          <section className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
            <h2 className="font-semibold text-gray-900 mb-1">AI Provider</h2>
            <p className="text-gray-500 text-sm mb-4">
              Paste your API key once. Your key, your credits — MailMind never
              charges you for AI usage.
            </p>

            {aiKeyLoading ? (
              <div className="h-28 bg-gray-100 rounded-xl animate-pulse" />
            ) : aiKey?.has_key ? (
              <div>
                {/* Current key status */}
                <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-xl px-4 py-3 mb-4">
                  <div>
                    <p className="text-sm font-medium text-green-800">
                      ✓{" "}
                      {AI_PROVIDERS.find((p) => p.value === aiKey.provider)?.label ??
                        aiKey.provider}{" "}
                      configured
                    </p>
                    <p className="text-xs text-green-600 mt-0.5">
                      Model: {aiKey.model_preference}
                    </p>
                  </div>
                  <button
                    onClick={handleDeleteAiKey}
                    disabled={aiKeyDeleting}
                    className="text-xs text-red-500 hover:text-red-700 font-medium disabled:opacity-60 ml-4"
                  >
                    {aiKeyDeleting ? "Removing…" : "Remove"}
                  </button>
                </div>
                <p className="text-xs text-gray-500 mb-3">
                  Update your key or switch providers:
                </p>
                <AiKeyForm
                  provider={aiProvider}
                  model={aiModel}
                  keyInput={aiKeyInput}
                  saving={aiKeySaving}
                  error={aiKeyError}
                  onProviderChange={handleProviderChange}
                  onModelChange={setAiModel}
                  onKeyChange={setAiKeyInput}
                  onSubmit={handleSaveAiKey}
                />
              </div>
            ) : (
              <AiKeyForm
                provider={aiProvider}
                model={aiModel}
                keyInput={aiKeyInput}
                saving={aiKeySaving}
                error={aiKeyError}
                onProviderChange={handleProviderChange}
                onModelChange={setAiModel}
                onKeyChange={setAiKeyInput}
                onSubmit={handleSaveAiKey}
              />
            )}
          </section>

          {/* ── Billing ───────────────────────────────────────────────────────── */}
          <section className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
            <h2 className="font-semibold text-gray-900 mb-4">Billing</h2>
            <BillingCard />
          </section>
        </div>
      </main>

      {showAddModal && (
        <AddAccountModal
          onClose={() => setShowAddModal(false)}
          canAdd={canAddMore}
        />
      )}
    </div>
  );
}

// ── Internal AI key form ─────────────────────────────────────────────────────

function AiKeyForm({
  provider,
  model,
  keyInput,
  saving,
  error,
  onProviderChange,
  onModelChange,
  onKeyChange,
  onSubmit,
}) {
  const selected = AI_PROVIDERS.find((p) => p.value === provider) ?? AI_PROVIDERS[0];

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div>
        <label className="text-xs font-medium text-gray-700 block mb-1">
          Provider
        </label>
        <select
          value={provider}
          onChange={(e) => onProviderChange(e.target.value)}
          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          {AI_PROVIDERS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="text-xs font-medium text-gray-700 block mb-1">
          Model
        </label>
        <input
          type="text"
          value={model}
          onChange={(e) => onModelChange(e.target.value)}
          placeholder={selected.defaultModel}
          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="text-xs font-medium text-gray-700 block mb-1">
          API Key
        </label>
        <input
          type="password"
          value={keyInput}
          onChange={(e) => onKeyChange(e.target.value)}
          placeholder={selected.placeholder}
          autoComplete="off"
          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <p className="text-xs text-gray-400 mt-1">
          Encrypted at rest · never sent to third parties.
        </p>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={saving}
        className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
      >
        {saving ? (
          <>
            <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            Verifying key…
          </>
        ) : (
          "Save & Verify"
        )}
      </button>
    </form>
  );
}
