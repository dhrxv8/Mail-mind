import { useEffect, useState } from "react";
import { getMemoryStats } from "../api/memory.js";

export default function MemoryStats({ className = "" }) {
  const [stats, setStats]     = useState(null);
  const [error, setError]     = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const data = await getMemoryStats();
        if (!cancelled) { setStats(data); setError(false); }
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    const interval = setInterval(load, 30_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  if (loading) {
    return (
      <div className={`flex items-center gap-2 text-xs text-slate-400 ${className}`}>
        <span className="inline-block w-3 h-3 border-2 border-slate-300 border-t-transparent rounded-full animate-spin" />
        Loading memory stats...
      </div>
    );
  }

  if (error || !stats) return null;

  const { emails_processed, total_chunks, total_entities } = stats;

  const factsLabel =
    total_entities > 0
      ? `${total_entities.toLocaleString()} facts stored`
      : total_chunks > 0
      ? `${total_chunks.toLocaleString()} memory chunks`
      : "No memory built yet";

  const learningLabel =
    emails_processed > 0
      ? `Learning from ${emails_processed.toLocaleString()} email${emails_processed === 1 ? "" : "s"}`
      : "No emails processed yet";

  const isActive = emails_processed > 0 || total_chunks > 0;

  return (
    <div
      className={`flex items-center gap-2 text-xs font-medium ${
        isActive ? "text-brand-600" : "text-slate-400"
      } ${className}`}
    >
      <span className={`flex-shrink-0 ${isActive ? "animate-pulse" : ""}`}>
        <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
          <path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z" />
        </svg>
      </span>
      <span>
        {learningLabel}
        {isActive && (
          <>
            <span className="mx-1.5 text-brand-300">·</span>
            {factsLabel}
          </>
        )}
      </span>
    </div>
  );
}
