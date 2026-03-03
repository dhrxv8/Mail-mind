import { apiClient } from "./client.js";

/**
 * Fetch memory statistics for the current user.
 *
 * Returns { total_chunks, total_entities, emails_processed,
 *            last_processed_at, by_account[] }
 */
export const getMemoryStats = () =>
  apiClient.get("/memory/stats").then((r) => r.data);

/**
 * Semantic search across the user's memory chunks.
 *
 * @param {Object} body
 * @param {string} body.query        - Search query string (1-2000 chars)
 * @param {string} [body.account_id] - Restrict to one Gmail account UUID
 * @param {number} [body.limit]      - Max results, 1-50 (default 10)
 * @returns {Promise<SearchResult[]>}
 */
export const searchMemory = (body) =>
  apiClient.post("/memory/search", body).then((r) => r.data);

/**
 * Manually enqueue memory processing for a single email.
 *
 * @param {string} emailId - UUID of the email to process
 * @returns {Promise<{ status: string, email_id: string }>}
 */
export const triggerEmailProcessing = (emailId) =>
  apiClient.post(`/memory/process/${emailId}`).then((r) => r.data);
