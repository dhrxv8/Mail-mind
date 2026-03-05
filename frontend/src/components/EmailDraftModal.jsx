import { useEffect, useRef, useState } from "react";
import { generateDraft, sendEmail } from "../api/inbox.js";

/**
 * EmailDraftModal — generate, preview, edit, and send an AI draft reply.
 *
 * Props:
 *   email     – InboxEmailResponse (needs id, subject, sender, sender_email)
 *   onClose() – called when the modal should be dismissed
 *   onSent()  – called after a successful send
 */
export default function EmailDraftModal({ email, onClose, onSent }) {
  const [draft, setDraft]       = useState("");
  const [to, setTo]             = useState(email.sender_email || "");
  const [subject, setSubject]   = useState(`Re: ${email.subject || ""}`.trim());
  const [loading, setLoading]   = useState(true);
  const [sending, setSending]   = useState(false);
  const [error, setError]       = useState(null);
  const textareaRef             = useRef(null);

  // Generate draft on mount
  useEffect(() => {
    let cancelled = false;
    generateDraft(email.id)
      .then((data) => {
        if (cancelled) return;
        setDraft(data.draft);
        setTo(data.to || email.sender_email || "");
        setSubject(data.subject || subject);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err?.response?.data?.detail ?? "Failed to generate draft. Try again.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [email.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [draft]);

  const handleSend = async () => {
    if (!draft.trim() || !to.trim()) return;
    setSending(true);
    setError(null);
    try {
      await sendEmail(email.id, { draft, to, subject });
      onSent?.();
      onClose();
    } catch (err) {
      setError(err?.response?.data?.detail ?? "Failed to send email. Try again.");
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl mx-4 bg-white rounded-2xl shadow-2xl flex flex-col max-h-[90vh] border border-slate-100">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Draft Reply</h2>
            <p className="text-xs text-slate-400 mt-0.5 truncate max-w-xs">
              Re: {email.subject || "(no subject)"}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Fields */}
        <div className="px-6 pt-4 space-y-2.5 flex-shrink-0">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-2.5">
            <span className="text-xs font-medium text-slate-400 w-14 flex-shrink-0">To</span>
            <input
              type="email"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="flex-1 text-sm text-slate-800 bg-transparent focus:outline-none placeholder-slate-300"
              disabled={sending}
            />
          </div>
          <div className="flex items-center gap-3 border-b border-slate-100 pb-2.5">
            <span className="text-xs font-medium text-slate-400 w-14 flex-shrink-0">Subject</span>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="flex-1 text-sm text-slate-800 bg-transparent focus:outline-none placeholder-slate-300"
              disabled={sending}
            />
          </div>
        </div>

        {/* Draft body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 min-h-0">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-slate-400">Generating AI draft…</p>
            </div>
          ) : (
            <textarea
              ref={textareaRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              disabled={sending}
              className="w-full resize-none text-sm text-slate-800 bg-slate-50 rounded-xl p-4 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 disabled:opacity-60 min-h-[160px] transition-all"
              placeholder="Draft will appear here…"
            />
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="mx-6 mb-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5">
            {error}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 flex-shrink-0">
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            AI-generated — review before sending
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              disabled={sending}
              className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSend}
              disabled={loading || sending || !draft.trim() || !to.trim()}
              className="px-4 py-2 text-sm font-semibold text-white rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 hover:opacity-90 active:scale-95"
              style={{ background: "linear-gradient(135deg, #4f46e5, #6366f1)" }}
            >
              {sending ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Sending…
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                    <line x1="22" y1="2" x2="11" y2="13" />
                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                  Send
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
