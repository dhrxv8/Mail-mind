import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import ChatInput from "../components/ChatInput.jsx";
import MessageBubble from "../components/MessageBubble.jsx";
import Sidebar from "../components/Sidebar.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useChat } from "../hooks/useChat.js";

export default function Chat() {
  const { user }                    = useAuth();
  const {
    conversations,
    activeConvId,
    messages,
    streaming,
    error,
    selectConversation,
    sendMessage,
    cancelStream,
    clearError,
  } = useChat();

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const bottomRef  = useRef(null);
  const inputReady = !!user; // could gate on AI key check in a future phase

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const hasMessages = messages.length > 0;
  const activeConv  = conversations.find((c) => c.id === activeConvId);

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />

      {/* ── Inner layout ─────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden h-screen">

        {/* ── Conversation list panel ──────────────────────────────────── */}
        {sidebarOpen && (
          <aside className="flex w-72 flex-shrink-0 flex-col border-r border-gray-200 bg-white overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-800">Conversations</h2>
              <button
                onClick={() => setSidebarOpen(false)}
                className="rounded p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                title="Hide sidebar"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11 19l-7-7 7-7M19 19l-7-7 7-7" />
                </svg>
              </button>
            </div>

            {/* New chat button */}
            <div className="px-3 py-2 border-b border-gray-100">
              <button
                onClick={() => {
                  // Clear active conversation — next sendMessage creates a new one
                  selectConversation(null).catch(() => {});
                  // Force clear by resetting activeConvId indirectly:
                  // The hook handles null gracefully (sendMessage creates new conv)
                }}
                className="flex w-full items-center gap-2 rounded-xl border-2 border-dashed border-gray-200 px-3 py-2 text-xs font-medium text-gray-500 transition-colors hover:border-blue-300 hover:text-blue-600"
              >
                <span className="text-base leading-none">+</span>
                New Chat
              </button>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto py-2">
              {conversations.length === 0 ? (
                <p className="px-4 py-6 text-center text-xs text-gray-400">
                  No conversations yet.
                  <br />Start typing below!
                </p>
              ) : (
                conversations.map((conv) => (
                  <button
                    key={conv.id}
                    onClick={() => selectConversation(conv.id)}
                    className={`w-full px-4 py-2.5 text-left transition-colors hover:bg-gray-50 ${
                      conv.id === activeConvId
                        ? "bg-blue-50 border-r-2 border-blue-500"
                        : ""
                    }`}
                  >
                    <p
                      className={`truncate text-xs font-medium ${
                        conv.id === activeConvId
                          ? "text-blue-700"
                          : "text-gray-700"
                      }`}
                    >
                      {conv.title || "New conversation"}
                    </p>
                    <p className="mt-0.5 text-xs text-gray-400">
                      {conv.message_count} message{conv.message_count !== 1 ? "s" : ""}
                      {" · "}
                      {formatRelativeTime(conv.updated_at)}
                    </p>
                  </button>
                ))
              )}
            </div>
          </aside>
        )}

        {/* ── Main chat area ────────────────────────────────────────────── */}
        <div className="flex flex-1 flex-col overflow-hidden">

          {/* Top bar */}
          <div className="flex items-center gap-3 border-b border-gray-200 bg-white px-4 py-2.5">
            {!sidebarOpen && (
              <button
                onClick={() => setSidebarOpen(true)}
                className="rounded p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                title="Show sidebar"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                </svg>
              </button>
            )}
            <div className="flex-1 min-w-0">
              <p className="truncate text-sm font-medium text-gray-800">
                {activeConv?.title || (hasMessages ? "New conversation" : "MailMind AI")}
              </p>
              {activeConv && (
                <p className="text-xs text-gray-400">
                  {activeConv.message_count} message{activeConv.message_count !== 1 ? "s" : ""}
                </p>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full bg-green-400" />
              <span className="text-xs text-gray-500">Ready</span>
            </div>
          </div>

          {/* Error banner */}
          {error && (
            <div className="mx-4 mt-3 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
              <span className="flex-1">{error}</span>
              <button
                onClick={clearError}
                className="text-red-400 hover:text-red-600 ml-2 flex-shrink-0"
              >
                ×
              </button>
            </div>
          )}

          {/* Message thread */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {!hasMessages ? (
              <EmptyState user={user} onPrompt={sendMessage} />
            ) : (
              <>
                {messages.map((msg) => (
                  <MessageBubble key={msg.id} message={msg} />
                ))}
                <div ref={bottomRef} />
              </>
            )}
          </div>

          {/* Input */}
          <ChatInput
            onSend={sendMessage}
            onCancel={cancelStream}
            streaming={streaming}
            disabled={!inputReady}
          />
        </div>
      </div>
    </div>
  );
}

// ── Empty state ────────────────────────────────────────────────────────────────

const STARTER_PROMPTS = [
  "What meetings or deadlines do I have coming up?",
  "Summarise my recent emails from work.",
  "Are there any unread messages I should reply to?",
  "What did I last hear from my team about the project?",
];

function EmptyState({ user, onPrompt }) {
  const firstName = user?.name?.split(" ")[0] ?? "there";
  return (
    <div className="flex h-full flex-col items-center justify-center py-12 text-center">
      <div className="mb-4 text-5xl">✉️</div>
      <h2 className="mb-1 text-xl font-semibold text-gray-800">
        Hi {firstName}, ask me anything.
      </h2>
      <p className="mb-6 max-w-xs text-sm text-gray-500">
        I have memory of your email history and can answer questions, find
        information, or surface important context.
      </p>
      <div className="flex max-w-sm flex-col gap-2 w-full">
        {STARTER_PROMPTS.map((prompt) => (
          <button
            key={prompt}
            onClick={() => onPrompt(prompt)}
            className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-left text-sm text-gray-600 transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
          >
            {prompt}
          </button>
        ))}
      </div>
      <p className="mt-6 text-xs text-gray-400">
        No AI key yet?{" "}
        <Link to="/settings" className="text-blue-500 hover:underline">
          Add one in Settings →
        </Link>
      </p>
    </div>
  );
}

// ── Utility ────────────────────────────────────────────────────────────────────

function formatRelativeTime(isoString) {
  if (!isoString) return "";
  const diff = Date.now() - new Date(isoString).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1)  return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}
