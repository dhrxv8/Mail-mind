import { apiClient } from "./client.js";

/**
 * Fetch paginated inbox.
 * @param {object} params  – account_id, is_read, triage_label, q, page, limit
 */
export const getInbox = (params = {}) =>
  apiClient.get("/inbox", { params }).then((r) => r.data);

/** Per-account unread counts. */
export const getInboxStats = () =>
  apiClient.get("/inbox/stats").then((r) => r.data);

/** Mark a single email as read. */
export const markRead = (emailId) =>
  apiClient.post(`/inbox/${emailId}/mark-read`).then((r) => r.data);

/** Generate an AI draft reply for an email. */
export const generateDraft = (emailId) =>
  apiClient.post(`/emails/${emailId}/draft`).then((r) => r.data);

/** Send a reply via Gmail API. */
export const sendEmail = (emailId, payload) =>
  apiClient.post(`/emails/${emailId}/send`, payload).then((r) => r.data);

/** Fetch (or generate) today's AI briefing. */
export const getDailyInsights = () =>
  apiClient.get("/insights/daily").then((r) => r.data);
