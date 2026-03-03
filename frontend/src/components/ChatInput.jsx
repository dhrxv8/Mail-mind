import { useEffect, useRef, useState } from "react";

/**
 * ChatInput — auto-resizing textarea with send / cancel controls.
 *
 * Props:
 *   onSend(content)  – called with trimmed text when the user submits
 *   onCancel()       – called when the user clicks the stop button
 *   streaming        – true while the AI is generating (disables send, shows stop)
 *   disabled         – hard-disable (e.g. no AI key configured)
 *   placeholder      – input placeholder text
 */
export default function ChatInput({
  onSend,
  onCancel,
  streaming = false,
  disabled = false,
  placeholder = "Ask anything about your emails…",
}) {
  const [value, setValue] = useState("");
  const textareaRef = useRef(null);

  // Auto-resize textarea as content grows
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
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const canSend = value.trim().length > 0 && !streaming && !disabled;

  return (
    <div className="border-t border-gray-200 bg-white px-4 py-3">
      <div
        className={`flex items-end gap-2 rounded-2xl border transition-colors ${
          disabled
            ? "border-gray-200 bg-gray-50"
            : "border-gray-300 bg-white focus-within:border-blue-400 focus-within:ring-1 focus-within:ring-blue-400"
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
          className="flex-1 resize-none bg-transparent px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none disabled:cursor-not-allowed disabled:text-gray-400 min-h-[48px] max-h-[200px] overflow-y-auto"
        />

        {/* Stop button (shown while streaming) */}
        {streaming ? (
          <button
            onClick={onCancel}
            className="m-2 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-gray-200 text-gray-600 transition-colors hover:bg-gray-300"
            title="Stop generating"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 12 12" fill="currentColor">
              <rect x="2" y="2" width="8" height="8" rx="1" />
            </svg>
          </button>
        ) : (
          /* Send button */
          <button
            onClick={handleSend}
            disabled={!canSend}
            className={`m-2 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg transition-colors ${
              canSend
                ? "bg-blue-600 text-white hover:bg-blue-700"
                : "bg-gray-100 text-gray-300 cursor-not-allowed"
            }`}
            title="Send message (Enter)"
          >
            <svg
              className="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        )}
      </div>

      <p className="mt-1.5 text-center text-xs text-gray-400">
        {streaming
          ? "Generating… press ■ to stop"
          : "Enter to send · Shift+Enter for newline"}
      </p>
    </div>
  );
}
