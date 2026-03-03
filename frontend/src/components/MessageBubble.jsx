/**
 * MessageBubble — renders one chat message.
 *
 * User messages are right-aligned with a blue bubble.
 * Assistant messages are left-aligned on a white card with basic markdown.
 *
 * Props:
 *   message – { id, role, content, streaming?, isError? }
 */
export default function MessageBubble({ message }) {
  const isUser = message.role === "user";

  return (
    <div
      className={`flex w-full ${isUser ? "justify-end" : "justify-start"} mb-4`}
    >
      {/* Assistant avatar */}
      {!isUser && (
        <div className="mr-2.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs text-white font-bold self-end">
          AI
        </div>
      )}

      <div
        className={`relative max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
          isUser
            ? "bg-blue-600 text-white rounded-br-sm"
            : message.isError
            ? "bg-red-50 border border-red-200 text-red-700 rounded-bl-sm"
            : "bg-white border border-gray-200 text-gray-800 rounded-bl-sm shadow-sm"
        }`}
      >
        {isUser ? (
          /* User messages: plain text with whitespace preserved */
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
        ) : (
          /* Assistant messages: basic markdown rendering */
          <MarkdownContent content={message.content} />
        )}

        {/* Streaming cursor */}
        {message.streaming && (
          <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-current opacity-70" />
        )}
      </div>

      {/* User avatar */}
      {isUser && (
        <div className="ml-2.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gray-200 text-xs text-gray-600 font-bold self-end">
          You
        </div>
      )}
    </div>
  );
}

/**
 * MarkdownContent — lightweight markdown renderer (no external library).
 *
 * Handles:
 *   - Fenced code blocks  (```...```)
 *   - Inline code         (`code`)
 *   - Bold                (**text** or __text__)
 *   - Unordered lists     (- item or * item)
 *   - Ordered lists       (1. item)
 *   - Horizontal rules    (---)
 *   - Paragraphs and line breaks
 */
function MarkdownContent({ content }) {
  if (!content) return null;

  const segments = splitCodeBlocks(content);

  return (
    <div className="prose-sm space-y-2">
      {segments.map((seg, i) =>
        seg.type === "code" ? (
          <pre
            key={i}
            className="overflow-x-auto rounded-lg bg-gray-900 p-3 text-xs text-gray-100 whitespace-pre"
          >
            {seg.lang && (
              <span className="mb-1 block text-[10px] text-gray-400 uppercase tracking-wide">
                {seg.lang}
              </span>
            )}
            <code>{seg.content}</code>
          </pre>
        ) : (
          <div key={i}>{renderInlineBlocks(seg.content)}</div>
        ),
      )}
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function splitCodeBlocks(text) {
  const result = [];
  const codeRe = /```(\w*)\n?([\s\S]*?)```/g;
  let lastIndex = 0;
  let match;

  while ((match = codeRe.exec(text)) !== null) {
    if (match.index > lastIndex) {
      result.push({ type: "text", content: text.slice(lastIndex, match.index) });
    }
    result.push({ type: "code", lang: match[1] || "", content: match[2].trimEnd() });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    result.push({ type: "text", content: text.slice(lastIndex) });
  }

  return result;
}

function renderInlineBlocks(text) {
  return text.split("\n").map((line, lineIdx, arr) => {
    const trimmed = line.trimStart();

    // Horizontal rule
    if (/^---+$/.test(trimmed)) {
      return <hr key={lineIdx} className="my-2 border-gray-200" />;
    }

    // Unordered list item
    const ulMatch = trimmed.match(/^[-*]\s+(.+)/);
    if (ulMatch) {
      return (
        <div key={lineIdx} className="flex items-start gap-1.5">
          <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-gray-400" />
          <span>{renderInline(ulMatch[1])}</span>
        </div>
      );
    }

    // Ordered list item
    const olMatch = trimmed.match(/^(\d+)\.\s+(.+)/);
    if (olMatch) {
      return (
        <div key={lineIdx} className="flex items-start gap-1.5">
          <span className="flex-shrink-0 text-gray-400 text-xs mt-0.5">{olMatch[1]}.</span>
          <span>{renderInline(olMatch[2])}</span>
        </div>
      );
    }

    // Heading (### ## #)
    const headingMatch = trimmed.match(/^(#{1,3})\s+(.+)/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const cls =
        level === 1
          ? "text-base font-bold text-gray-900"
          : level === 2
          ? "text-sm font-bold text-gray-800"
          : "text-sm font-semibold text-gray-700";
      return (
        <p key={lineIdx} className={cls}>
          {renderInline(headingMatch[2])}
        </p>
      );
    }

    // Empty line → spacer
    if (!trimmed) {
      return lineIdx < arr.length - 1 ? (
        <div key={lineIdx} className="h-2" />
      ) : null;
    }

    // Regular paragraph line
    return (
      <p key={lineIdx} className="whitespace-pre-wrap break-words">
        {renderInline(line)}
      </p>
    );
  });
}

function renderInline(text) {
  // Split on inline code, bold, and italic markers
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*|__[^_]+__|_[^_]+_|\*[^*]+\*)/);

  return parts.map((part, i) => {
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code
          key={i}
          className="rounded bg-gray-100 px-1 py-0.5 font-mono text-xs text-gray-800"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    if (
      (part.startsWith("**") && part.endsWith("**")) ||
      (part.startsWith("__") && part.endsWith("__"))
    ) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    if (
      (part.startsWith("_") && part.endsWith("_")) ||
      (part.startsWith("*") && part.endsWith("*"))
    ) {
      return <em key={i}>{part.slice(1, -1)}</em>;
    }
    return part;
  });
}
