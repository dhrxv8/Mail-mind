import { useCallback, useEffect, useRef, useState } from "react";
import {
  createConversation,
  getConversation,
  getConversations,
  streamMessage,
} from "../api/chat.js";

/**
 * useChat — manages conversation list, active conversation, message streaming.
 *
 * Returns:
 *   conversations   – Array of ConversationResponse (most-recent first)
 *   activeConvId    – UUID of the currently selected conversation, or null
 *   messages        – Array of MessageResponse + optimistic streaming entries
 *   streaming       – true while the AI is generating a response
 *   error           – string error or null
 *   loadConversations – force-reload conversation list
 *   selectConversation(id) – load + display a conversation
 *   sendMessage(content)   – send user message, stream reply
 *   cancelStream()         – abort the in-progress stream
 *   clearError()           – dismiss the error banner
 */
export function useChat() {
  const [conversations, setConversations] = useState([]);
  const [activeConvId, setActiveConvId]   = useState(null);
  const [messages, setMessages]           = useState([]);
  const [streaming, setStreaming]         = useState(false);
  const [error, setError]                 = useState(null);
  const abortRef = useRef(null);

  // ── Load conversation list ─────────────────────────────────────────────
  const loadConversations = useCallback(async () => {
    try {
      const data = await getConversations();
      setConversations(data);
    } catch {
      // non-fatal — list stays stale
    }
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // ── Select an existing conversation ───────────────────────────────────
  const selectConversation = useCallback(
    async (id) => {
      if (streaming) {
        abortRef.current?.abort();
        setStreaming(false);
      }
      try {
        const data = await getConversation(id);
        setActiveConvId(data.id);
        setMessages(data.messages);
        setError(null);
        // Sync title in list if it changed
        setConversations((prev) =>
          prev.map((c) => (c.id === data.id ? { ...c, title: data.title } : c)),
        );
      } catch {
        setError("Failed to load conversation.");
      }
    },
    [streaming],
  );

  // ── Send a message ─────────────────────────────────────────────────────
  const sendMessage = useCallback(
    async (content) => {
      const trimmed = content.trim();
      if (!trimmed || streaming) return;

      setError(null);

      // Create a new conversation on first message
      let convId = activeConvId;
      if (!convId) {
        try {
          const conv = await createConversation({});
          convId = conv.id;
          setActiveConvId(conv.id);
          setConversations((prev) => [conv, ...prev]);
        } catch {
          setError("Failed to create conversation. Please try again.");
          return;
        }
      }

      // Optimistic user message
      const userMsgId = crypto.randomUUID();
      setMessages((prev) => [
        ...prev,
        {
          id:         userMsgId,
          role:       "user",
          content:    trimmed,
          created_at: new Date().toISOString(),
        },
      ]);

      // Placeholder for streaming assistant reply
      const assistantMsgId = crypto.randomUUID();
      setMessages((prev) => [
        ...prev,
        {
          id:         assistantMsgId,
          role:       "assistant",
          content:    "",
          created_at: new Date().toISOString(),
          streaming:  true,
        },
      ]);
      setStreaming(true);

      const controller = new AbortController();
      abortRef.current = controller;

      await streamMessage(
        convId,
        trimmed,
        // onChunk
        (chunk) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsgId
                ? { ...m, content: m.content + chunk }
                : m,
            ),
          );
        },
        // onDone
        () => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsgId ? { ...m, streaming: false } : m,
            ),
          );
          setStreaming(false);
          // Reload list so the auto-generated title appears
          loadConversations();
        },
        // onError
        (errMsg) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsgId
                ? { ...m, content: errMsg || "Something went wrong.", streaming: false, isError: true }
                : m,
            ),
          );
          setError(errMsg || "Failed to get a response.");
          setStreaming(false);
        },
        controller.signal,
      );
    },
    [activeConvId, streaming, loadConversations],
  );

  // ── Cancel in-progress stream ──────────────────────────────────────────
  const cancelStream = useCallback(() => {
    abortRef.current?.abort();
    setStreaming(false);
    // Mark the last assistant message as no longer streaming
    setMessages((prev) =>
      prev.map((m, i) =>
        i === prev.length - 1 && m.streaming
          ? { ...m, streaming: false }
          : m,
      ),
    );
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return {
    conversations,
    activeConvId,
    messages,
    streaming,
    error,
    loadConversations,
    selectConversation,
    sendMessage,
    cancelStream,
    clearError,
  };
}
