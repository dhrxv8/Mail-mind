export default function MessageBubble({ message }) {
  const isUser = message.role === "user";

  return (
    <div className={`flex w-full ${isUser ? "justify-end" : "justify-start"} mb-4 animate-fade-in`}>
      {!isUser && (
        <div className="mr-2.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs text-white font-bold self-end shadow-glow-sm"
             style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}>
          AI
        </div>
      )}

      <div
        className={`relative max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
          isUser
            ? "text-white rounded-br-md shadow-lg"
            : message.isError
            ? "bg-red-50 border border-red-200 text-red-700 rounded-bl-md"
            : "bg-white border border-slate-100 text-slate-800 rounded-bl-md shadow-card"
        }`}
        style={isUser ? { background: "linear-gradient(135deg, #4f46e5, #6366f1)" } : undefined}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
        ) : (
          <MarkdownContent content={message.content} />
        )}

        {message.streaming && (
          <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-current opacity-70 rounded-full" />
        )}
      </div>

      {isUser && (
        <div className="ml-2.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold self-end"
             style={{ background: "linear-gradient(135deg, #e0e7ff, #c7d2fe)", color: "#4338ca" }}>
          You
        </div>
      )}
    </div>
  );
}

function MarkdownContent({ content }) {
  if (!content) return null;
  const segments = splitCodeBlocks(content);
  return (
    <div className="prose-sm space-y-2">
      {segments.map((seg, i) =>
        seg.type === "code" ? (
          <pre key={i} className="overflow-x-auto rounded-xl bg-slate-900 p-3 text-xs text-slate-100 whitespace-pre">
            {seg.lang && (
              <span className="mb-1 block text-[10px] text-slate-400 uppercase tracking-wide font-medium">{seg.lang}</span>
            )}
            <code>{seg.content}</code>
          </pre>
        ) : (
          <div key={i}>{renderInlineBlocks(seg.content)}</div>
        )
      )}
    </div>
  );
}

function splitCodeBlocks(text) {
  const result = [];
  const codeRe = /```(\w*)\n?([\s\S]*?)```/g;
  let lastIndex = 0;
  let match;
  while ((match = codeRe.exec(text)) !== null) {
    if (match.index > lastIndex) result.push({ type: "text", content: text.slice(lastIndex, match.index) });
    result.push({ type: "code", lang: match[1] || "", content: match[2].trimEnd() });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) result.push({ type: "text", content: text.slice(lastIndex) });
  return result;
}

function renderInlineBlocks(text) {
  return text.split("\n").map((line, lineIdx, arr) => {
    const trimmed = line.trimStart();
    if (/^---+$/.test(trimmed)) return <hr key={lineIdx} className="my-2 border-slate-200" />;
    const ulMatch = trimmed.match(/^[-*]\s+(.+)/);
    if (ulMatch) return (
      <div key={lineIdx} className="flex items-start gap-1.5">
        <span className="mt-1.5 h-1 w-1 flex-shrink-0 rounded-full bg-slate-400" />
        <span>{renderInline(ulMatch[1])}</span>
      </div>
    );
    const olMatch = trimmed.match(/^(\d+)\.\s+(.+)/);
    if (olMatch) return (
      <div key={lineIdx} className="flex items-start gap-1.5">
        <span className="flex-shrink-0 text-slate-400 text-xs mt-0.5 tabular-nums">{olMatch[1]}.</span>
        <span>{renderInline(olMatch[2])}</span>
      </div>
    );
    const headingMatch = trimmed.match(/^(#{1,3})\s+(.+)/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const cls = level === 1 ? "text-base font-bold text-slate-900" : level === 2 ? "text-sm font-bold text-slate-800" : "text-sm font-semibold text-slate-700";
      return <p key={lineIdx} className={cls}>{renderInline(headingMatch[2])}</p>;
    }
    if (!trimmed) return lineIdx < arr.length - 1 ? <div key={lineIdx} className="h-2" /> : null;
    return <p key={lineIdx} className="whitespace-pre-wrap break-words">{renderInline(line)}</p>;
  });
}

function renderInline(text) {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*|__[^_]+__|_[^_]+_|\*[^*]+\*)/);
  return parts.map((part, i) => {
    if (part.startsWith("`") && part.endsWith("`")) {
      return <code key={i} className="rounded-md bg-brand-50 border border-brand-100 px-1.5 py-0.5 font-mono text-xs text-brand-700">{part.slice(1, -1)}</code>;
    }
    if ((part.startsWith("**") && part.endsWith("**")) || (part.startsWith("__") && part.endsWith("__"))) {
      return <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong>;
    }
    if ((part.startsWith("_") && part.endsWith("_")) || (part.startsWith("*") && part.endsWith("*"))) {
      return <em key={i}>{part.slice(1, -1)}</em>;
    }
    return part;
  });
}
