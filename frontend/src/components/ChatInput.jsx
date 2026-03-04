import { useEffect, useRef, useState } from "react";

export default function ChatInput({
  onSend,
  onCancel,
  streaming = false,
  disabled = false,
  placeholder = "Ask anything about your emails...",
}) {
  const [value, setValue] = useState("");
  const textareaRef = useRef(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [value]);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = () => {
    const trimmed = value.trim();
    if (!trimmed || streaming || disabled) return;
    onSend(trimmed);
    setValue("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  };

  const canSend = value.trim().length > 0 && !streaming && !disabled;

  return (
    <div className="border-t border-slate-100 bg-white px-4 py-3">
      <div
        className={`flex items-end gap-2 rounded-2xl border transition-all duration-200 ${
          disabled
            ? "border-slate-100 bg-slate-50"
            : "border-slate-200 bg-white focus-within:border-brand-400 focus-within:ring-2 focus-within:ring-brand-500/10 focus-within:shadow-glow-sm"
        }`}
      >
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={disabled ? "Add an AI key in Settings to start chatting." : placeholder}
          disabled={disabled}
          rows={1}
          className="flex-1 resize-none bg-transparent px-4 py-3.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none disabled:cursor-not-allowed disabled:text-slate-400 min-h-[52px] max-h-[200px] overflow-y-auto"
        />

        {streaming ? (
          <button
            onClick={onCancel}
            className="m-2.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 transition-all hover:bg-red-50 hover:text-red-500"
            title="Stop generating"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 12 12" fill="currentColor">
              <rect x="2" y="2" width="8" height="8" rx="1.5" />
            </svg>
          </button>
        ) : (
          <button
            onClick={handleSend}
            disabled={!canSend}
            className={`m-2.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl transition-all duration-200 ${
              canSend
                ? "text-white hover:opacity-90 active:scale-95 shadow-glow-sm"
                : "bg-slate-100 text-slate-300 cursor-not-allowed"
            }`}
            style={canSend ? { background: "linear-gradient(135deg, #4f46e5, #6366f1)" } : undefined}
            title="Send message (Enter)"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        )}
      </div>

      <p className="mt-1.5 text-center text-[11px] text-slate-400">
        {streaming ? (
          <span className="flex items-center justify-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-pulse-dot" />
            Generating... press stop to cancel
          </span>
        ) : (
          "Enter to send · Shift+Enter for newline"
        )}
      </p>
    </div>
  );
}
