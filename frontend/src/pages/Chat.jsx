import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import ChatInput from "../components/ChatInput.jsx";
import MessageBubble from "../components/MessageBubble.jsx";
import Sidebar from "../components/Sidebar.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useChat } from "../hooks/useChat.js";

export default function Chat() {
  const { user } = useAuth();
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
  const inputReady = !!user;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const hasMessages = messages.length > 0;
  const activeConv  = conversations.find((c) => c.id === activeConvId);

  return (
    <div className="flex min-h-screen bg-[#f5f6fa]">
      <Sidebar />

      <div className="flex flex-1 overflow-hidden h-screen">

        {/* Conversation list panel */}
        {sidebarOpen && (
          <aside className="flex w-64 flex-shrink-0 flex-col border-r border-slate-100 bg-white overflow-hidden shadow-sm">
            <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-100">
              <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Conversations</h2>
              <button
                onClick={() => setSidebarOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all"
                title="Hide sidebar"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11 19l-7-7 7-7M19 19l-7-7 7-7" />
                </svg>
              </button>
            </div>

            <div className="px-3 py-2.5 border-b border-slate-100">
              <button
                onClick={() => selectConversation(null).catch(() => {})}
                className="flex w-full items-center gap-2 rounded-xl border border-dashed border-slate-200 px-3 py-2 text-xs font-medium text-slate-400 transition-all hover:border-brand-300 hover:text-brand-500 hover:bg-brand-50/50 active:scale-[0.98]"
              >
                <span className="text-base leading-none font-light">+</span>
                New Chat
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-2 no-scrollbar">
              {conversations.length === 0 ? (
                <p className="px-4 py-6 text-center text-xs text-slate-400">
                  No conversations yet.<br />Start typing below!
                </p>
              ) : (
                conversations.map((conv) => (
                  <button
                    key={conv.id}
                    onClick={() => selectConversation(conv.id)}
                    className={`w-full px-4 py-2.5 text-left transition-all hover:bg-slate-50 ${
                      conv.id === activeConvId
                        ? "bg-brand-50 border-r-2 border-brand-500"
                        : ""
                    }`}
                  >
                    <p className={`truncate text-xs font-medium ${conv.id === activeConvId ? "text-brand-700" : "text-slate-700"}`}>
                      {conv.title || "New conversation"}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-400">
                      {conv.message_count} msg{conv.message_count !== 1 ? "s" : ""}
                      {" · "}
                      {formatRelativeTime(conv.updated_at)}
                    </p>
                  </button>
                ))
              )}
            </div>
          </aside>
        )}

        {/* Main chat area */}
        <div className="flex flex-1 flex-col overflow-hidden bg-white">

          {/* Top bar */}
          <div className="flex items-center gap-3 border-b border-slate-100 bg-white px-4 py-3 shadow-sm">
            {!sidebarOpen && (
              <button
                onClick={() => setSidebarOpen(true)}
                className="rounded-lg p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all"
                title="Show sidebar"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                </svg>
              </button>
            )}
            <div className="flex-1 min-w-0">
              <p className="truncate text-sm font-semibold text-slate-800">
                {activeConv?.title || (hasMessages ? "New conversation" : "MailMind AI")}
              </p>
              {activeConv && (
                <p className="text-xs text-slate-400">
                  {activeConv.message_count} message{activeConv.message_count !== 1 ? "s" : ""}
                </p>
              )}
            </div>
            <div className="flex items-center gap-1.5 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse-dot" />
              <span className="text-xs font-medium text-emerald-600">Ready</span>
            </div>
          </div>

          {/* Error banner */}
          {error && (
            <div className="mx-4 mt-3 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700 animate-slide-up">
              <svg className="w-4 h-4 flex-shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <span className="flex-1">{error}</span>
              <button onClick={clearError} className="text-red-400 hover:text-red-600 ml-2 flex-shrink-0 transition-colors">
                <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          )}

          {/* Message thread */}
          <div className="flex-1 overflow-y-auto px-6 py-5 bg-[#f9fafb]">
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

const STARTER_PROMPTS = [
  { text: "What meetings or deadlines do I have coming up?", icon: "M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" },
  { text: "Summarise my recent emails from work.", icon: "M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" },
  { text: "Are there any unread messages I should reply to?", icon: "M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884zM18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" },
  { text: "What did I last hear from my team about the project?", icon: "M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" },
];

function EmptyState({ user, onPrompt }) {
  const firstName = user?.name?.split(" ")[0] ?? "there";
  return (
    <div className="flex h-full flex-col items-center justify-center py-12 text-center">
      <div className="mb-5 w-14 h-14 rounded-2xl flex items-center justify-center animate-float"
           style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}>
        <svg className="w-7 h-7 text-white" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zm-8-3a1 1 0 100 2 1 1 0 000-2zm-3 3a1 1 0 100 2 1 1 0 000-2zm6 0a1 1 0 100 2 1 1 0 000-2z" clipRule="evenodd" />
        </svg>
      </div>
      <h2 className="mb-1.5 text-xl font-bold text-slate-800 tracking-tight">Hi {firstName}, ask me anything.</h2>
      <p className="mb-6 max-w-xs text-sm text-slate-400 leading-relaxed">
        I have memory of your email history and can answer questions, find information, or surface important context.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-lg w-full">
        {STARTER_PROMPTS.map(({ text, icon }) => (
          <button
            key={text}
            onClick={() => onPrompt(text)}
            className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-left text-sm text-slate-600 transition-all duration-200 hover:border-brand-300 hover:bg-brand-50/50 hover:text-brand-700 shadow-sm hover:shadow-card group flex items-start gap-3"
          >
            <svg className="w-4 h-4 text-slate-400 group-hover:text-brand-500 flex-shrink-0 mt-0.5 transition-colors" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d={icon} clipRule="evenodd" />
            </svg>
            <span>{text}</span>
          </button>
        ))}
      </div>
      <p className="mt-6 text-xs text-slate-400">
        No AI key yet?{" "}
        <Link to="/settings" className="text-brand-500 hover:text-brand-600 font-medium">
          Add one in Settings →
        </Link>
      </p>
    </div>
  );
}

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
