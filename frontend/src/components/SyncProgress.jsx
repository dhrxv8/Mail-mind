import { useEffect, useRef, useState } from "react";
import { getSyncStatus } from "../api/gmail.js";

const POLL_INTERVAL_MS = 3000;

const STATUS_CONFIG = {
  idle:     { label: "Not synced",  color: "text-slate-400",   bg: "bg-slate-50"    },
  syncing:  { label: "Syncing...",  color: "text-brand-600",   bg: "bg-brand-50"    },
  complete: { label: "Synced",      color: "text-emerald-600", bg: "bg-emerald-50"  },
  failed:   { label: "Sync failed", color: "text-red-600",     bg: "bg-red-50"      },
};

export default function SyncProgress({ accountId, onComplete }) {
  const [syncData, setSyncData] = useState(null);
  const [error, setError]       = useState(null);
  const intervalRef             = useRef(null);

  const fetchStatus = async () => {
    try {
      const data = await getSyncStatus(accountId);
      setSyncData(data);
      setError(null);

      if (data.sync_status === "complete") {
        clearInterval(intervalRef.current);
        onComplete?.();
      } else if (data.sync_status === "failed") {
        clearInterval(intervalRef.current);
      }
    } catch {
      setError("Could not fetch sync status.");
      clearInterval(intervalRef.current);
    }
  };

  useEffect(() => {
    fetchStatus();
    intervalRef.current = setInterval(fetchStatus, POLL_INTERVAL_MS);
    return () => clearInterval(intervalRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId]);

  if (error) {
    return <p className="text-xs text-red-500 mt-1">{error}</p>;
  }

  if (!syncData) {
    return <div className="mt-2 h-4 w-32 bg-slate-100 rounded animate-pulse" />;
  }

  const cfg = STATUS_CONFIG[syncData.sync_status] ?? STATUS_CONFIG.idle;
  const isActive = syncData.sync_status === "syncing";

  return (
    <div className={`mt-2 flex items-center gap-2 px-3 py-1.5 rounded-lg ${cfg.bg} transition-colors`}>
      {isActive && (
        <span className="inline-block w-3 h-3 border-2 border-brand-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
      )}
      <span className={`text-xs font-medium ${cfg.color}`}>
        {cfg.label}
        {syncData.emails_synced > 0 && (
          <span className="font-normal ml-1">
            — {syncData.emails_synced.toLocaleString()} emails
          </span>
        )}
      </span>
      {syncData.last_synced_at && syncData.sync_status === "complete" && (
        <span className="text-xs text-slate-400 ml-auto">
          {new Date(syncData.last_synced_at).toLocaleDateString()}
        </span>
      )}
    </div>
  );
}
