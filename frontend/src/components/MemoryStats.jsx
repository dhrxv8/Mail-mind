import { useEffect, useState } from "react";
import { getMemoryStats } from "../api/memory.js";

/**
 * MemoryStats — compact banner that shows the user's memory pipeline status.
 *
 * Displays: "Learning from X emails • Y facts stored"
 *
 * Props:
 *   className – optional extra Tailwind classes for the wrapper
 */
export default function MemoryStats({ className = "" }) {
  const [stats, setStats]   = useState(null);
  const [error, setError]   = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const data = await getMemoryStats();
        if (!cancelled) {
          setStats(data);
          setError(false);
        }
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    // Refresh every 30 s so the UI stays roughly current during background processing
    const interval = setInterval(load, 30_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  if (loading) {
    return (
      <div className={`flex items-center gap-2 text-xs text-gray-400 ${className}`}>
        <span className="inline-block w-3 h-3 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />
        Loading memory stats…
      </div>
    );
  }

  if (error || !stats) {
    return null;
  }

  const { emails_processed, total_chunks, total_entities } = stats;

  // Surface the most meaningful non-zero number as the "facts" count.
  // Entities are richer signal; fall back to raw chunks if none yet.
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
        isActive ? "text-blue-600" : "text-gray-400"
      } ${className}`}
    >
      {/* Pulsing brain icon when memory is being built */}
      <span
        className={`text-base leading-none ${
          isActive ? "animate-pulse" : ""
        }`}
        aria-hidden="true"
      >
        🧠
      </span>
      <span>
        {learningLabel}
        {isActive && (
          <>
            <span className="mx-1.5 text-blue-300">•</span>
            {factsLabel}
          </>
        )}
      </span>
    </div>
  );
}
