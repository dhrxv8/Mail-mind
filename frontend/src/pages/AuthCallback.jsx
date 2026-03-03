import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

/**
 * Handles the redirect from the backend after Google OAuth completes.
 * The backend sends: /auth/callback?access_token=...&refresh_token=...
 */
export default function AuthCallback() {
  const [searchParams] = useSearchParams();
  const { login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const accessToken = searchParams.get("access_token");
    const refreshToken = searchParams.get("refresh_token");

    if (accessToken && refreshToken) {
      login(accessToken, refreshToken);
      navigate("/dashboard", { replace: true });
    } else {
      navigate("/login?error=auth_failed", { replace: true });
    }
  }, [searchParams, login, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-4" />
        <p className="text-gray-600 text-sm">Connecting your account…</p>
      </div>
    </div>
  );
}
