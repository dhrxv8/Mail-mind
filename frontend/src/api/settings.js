import { apiClient } from "./client.js";

export const saveAiKey = (data) =>
  apiClient.put("/settings/ai-key", data).then((r) => r.data);

export const getAiKey = () =>
  apiClient.get("/settings/ai-key").then((r) => r.data);

export const deleteAiKey = () =>
  apiClient.delete("/settings/ai-key").then((r) => r.data);
