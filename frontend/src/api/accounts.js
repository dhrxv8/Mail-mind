import { apiClient } from "./client.js";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

/**
 * Fetch all Gmail accounts connected to the current user.
 * @returns {Promise<Array>}
 */
export const getAccounts = async () => {
  const { data } = await apiClient.get("/accounts");
  return data;
};

/**
 * Fetch account slot usage: { count, limit, can_add_more }.
 * limit == -1 means unlimited (Pro plan).
 * @returns {Promise<{count: number, limit: number, can_add_more: boolean}>}
 */
export const getAccountsStatus = async () => {
  const { data } = await apiClient.get("/accounts/status");
  return data;
};

/**
 * Change the label (account_type) for a Gmail account.
 * @param {string} accountId - UUID of the GmailAccount
 * @param {string} accountType - "personal" | "edu" | "work" | "freelance"
 * @returns {Promise<Object>}
 */
export const updateAccountLabel = async (accountId, accountType) => {
  const { data } = await apiClient.put(`/accounts/${accountId}/label`, {
    account_type: accountType,
  });
  return data;
};

/**
 * Revoke Google OAuth tokens and remove the account from MailMind.
 * @param {string} accountId - UUID of the GmailAccount
 * @returns {Promise<{message: string}>}
 */
export const revokeAccount = async (accountId) => {
  const { data } = await apiClient.post(`/auth/google/revoke/${accountId}`);
  return data;
};

/**
 * Get the Google OAuth URL for connecting an additional Gmail account.
 * The caller should navigate to the returned URL via window.location.href.
 *
 * @param {string|null} loginHint - optional email to pre-fill the Google picker
 * @returns {Promise<{url: string}>}
 */
export const getAddAccountUrl = async (loginHint = null) => {
  const params = loginHint
    ? `?login_hint=${encodeURIComponent(loginHint)}`
    : "";
  const { data } = await apiClient.get(`/auth/google/add-account${params}`);
  return data; // { url: "https://accounts.google.com/..." }
};

/**
 * Navigate the browser to the Google account-picker for re-authentication.
 * Uses login_hint to skip the account-picker and land directly on the
 * right Google account.
 *
 * @param {string} gmailAddress - the address that needs re-auth
 */
export const triggerReauth = async (gmailAddress) => {
  const { url } = await getAddAccountUrl(gmailAddress);
  window.location.href = url;
};
