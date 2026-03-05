import { apiClient } from "./client.js";

export const createSubscription = (currency = "inr") =>
  apiClient.post("/billing/create-subscription", { currency }).then((r) => r.data);

export const verifyPayment = (data) =>
  apiClient.post("/billing/verify-payment", data).then((r) => r.data);

export const cancelSubscription = () =>
  apiClient.post("/billing/cancel-subscription").then((r) => r.data);

/**
 * Detect whether the user is likely in India based on timezone / language.
 * Returns "inr" or "usd".
 */
export function detectCurrency() {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    if (tz.startsWith("Asia/Kolkata") || tz.startsWith("Asia/Calcutta")) return "inr";
    const lang = navigator.language || "";
    if (lang.startsWith("hi") || lang === "en-IN") return "inr";
  } catch { /* fallback */ }
  return "usd";
}

let _razorpayLoaded = false;

function loadRazorpayScript() {
  if (_razorpayLoaded || window.Razorpay) {
    _razorpayLoaded = true;
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => { _razorpayLoaded = true; resolve(); };
    script.onerror = () => reject(new Error("Failed to load Razorpay SDK"));
    document.head.appendChild(script);
  });
}

/**
 * Open the Razorpay checkout modal.
 * Loads the Razorpay SDK on demand if not already present.
 * Returns a promise that resolves with the payment response or rejects on close.
 */
export async function openRazorpayCheckout({ subscriptionId, keyId, userName, userEmail, currency }) {
  await loadRazorpayScript();

  return new Promise((resolve, reject) => {
    const options = {
      key: keyId,
      subscription_id: subscriptionId,
      name: "MailMind",
      description: "Pro Plan — " + (currency === "inr" ? "₹499/mo" : "$6/mo"),
      prefill: {
        name: userName || "",
        email: userEmail || "",
      },
      theme: { color: "#4f46e5" },
      handler: (response) => resolve(response),
      modal: { ondismiss: () => reject(new Error("cancelled")) },
    };

    const rzp = new window.Razorpay(options);
    rzp.open();
  });
}
