import { useCallback, useEffect, useState } from "react";
import { getAccounts, getAccountsStatus } from "../api/accounts.js";

/**
 * Fetches and exposes the current user's Gmail accounts and plan-slot status.
 *
 * Returns:
 *   accounts   – Array of GmailAccountResponse objects
 *   status     – { count, limit, can_add_more }  (null while loading)
 *   loading    – true on first fetch
 *   error      – error message string, or null
 *   refetch    – call to force a fresh load (e.g. after add/remove)
 */
export function useAccounts() {
  const [accounts, setAccounts] = useState([]);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [accountsData, statusData] = await Promise.all([
        getAccounts(),
        getAccountsStatus(),
      ]);
      setAccounts(accountsData);
      setStatus(statusData);
    } catch (err) {
      setError(
        err?.response?.data?.detail ?? err.message ?? "Failed to load accounts"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  return { accounts, status, loading, error, refetch: fetchAccounts };
}
