import axios from "axios";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

export const apiClient = axios.create({
  baseURL: API_BASE,
  headers: { "Content-Type": "application/json" },
  withCredentials: true,
});

// On 401, attempt a single cookie-based token refresh then retry.
// If the refresh also fails, redirect to /login.
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;

    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        await axios.post(`${API_BASE}/auth/refresh`, null, {
          withCredentials: true,
        });
        return apiClient(original);
      } catch {
        window.location.href = "/login";
      }
    }

    return Promise.reject(error);
  }
);
