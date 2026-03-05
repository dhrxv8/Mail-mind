import { apiClient } from "./client.js";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

/**
 * Create a new empty Conversation.
 * @returns {Promise<{id, title, created_at, updated_at, message_count}>}
 */
export const createConversation = (body = {}) =>
  apiClient.post("/chat", body).then((r) => r.data);

/**
 * List all conversations for the current user (most-recent first).
 * @returns {Promise<Array>}
 */
export const getConversations = () =>
  apiClient.get("/conversations").then((r) => r.data);

/**
 * Load a conversation with its full message history.
 * @param {string} conversationId
 * @returns {Promise<{id, title, messages: Array}>}
 */
export const getConversation = (conversationId) =>
  apiClient.get(`/conversations/${conversationId}`).then((r) => r.data);

/**
 * Send a message and stream the AI response using the native fetch API.
 *
 * SSE events:
 *   data: {"chunk": "..."}   — text chunk to append
 *   data: {"error": "..."}   — error message
 *   data: [DONE]             — stream complete
 *
 * @param {string}   conversationId
 * @param {string}   content        - User message text
 * @param {function} onChunk        - Called with each string chunk
 * @param {function} onDone         - Called when stream ends normally
 * @param {function} onError        - Called with error string on failure
 * @param {AbortSignal} [signal]    - Optional AbortController signal
 */
export const streamMessage = async (
  conversationId,
  content,
  onChunk,
  onDone,
  onError,
  signal,
) => {
  let response;

  try {
    response = await fetch(`${API_BASE}/chat/${conversationId}/message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ content }),
      signal,
    });
  } catch (err) {
    if (err.name !== "AbortError") {
      onError("Network error — could not reach the server.");
    }
    return;
  }

  if (!response.ok) {
    let detail = "Request failed";
    try {
      const body = await response.json();
      detail = body.detail ?? detail;
    } catch {
      // ignore parse errors
    }
    onError(detail);
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? ""; // keep last incomplete line

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6).trim();
        if (data === "[DONE]") {
          onDone();
          return;
        }
        try {
          const parsed = JSON.parse(data);
          if (parsed.chunk !== undefined) onChunk(parsed.chunk);
          if (parsed.error !== undefined) onError(parsed.error);
        } catch {
          // ignore malformed SSE line
        }
      }
    }
  } catch (err) {
    if (err.name !== "AbortError") {
      onError("Stream read error. Please try again.");
    }
  } finally {
    reader.releaseLock();
  }

  onDone();
};
