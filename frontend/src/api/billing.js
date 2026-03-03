import { apiClient } from "./client.js";

export const createCheckout = () =>
  apiClient.post("/billing/create-checkout").then((r) => r.data);

export const getBillingPortal = () =>
  apiClient.get("/billing/portal").then((r) => r.data);
