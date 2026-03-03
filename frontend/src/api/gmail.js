import { apiClient } from "./client.js";

/**
 * Enqueue a full initial sync for one Gmail account.
 * Returns { status: "queued" | "already_syncing", account_id }
 */
export const triggerInitialSync = async (accountId) => {
  const { data } = await apiClient.post(`/gmail/sync/initial/${accountId}`);
  return data;
};

/**
 * Poll sync progress for one Gmail account.
 * Returns SyncStatusResponse: { account_id, gmail_address, sync_status,
 *                                emails_synced, last_synced_at }
 */
export const getSyncStatus = async (accountId) => {
  const { data } = await apiClient.get(`/gmail/sync-status/${accountId}`);
  return data;
};

/**
 * Register (or renew) a Gmail Pub/Sub watch.
 * Returns WatchResponse: { account_id, gmail_address, history_id, watch_expiration }
 */
export const setupWatch = async (accountId) => {
  const { data } = await apiClient.post(`/gmail/watch/${accountId}`);
  return data;
};
