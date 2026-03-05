import { useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

/**
 * Handles the redirect from the backend after Google OAuth completes.
 * The backend already set httpOnly auth cookies on the redirect response,
 * so we just need to verify auth state and navigate to the dashboard.
 */
export default function AuthCallback() {
  const [searchParams] = useSearchParams();
  const { fetchUser } = useAuth();
  const navigate = useNavigate();
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;

    const error = searchParams.get("error");
    if (error) {
      navigate("/login?error=auth_failed", { replace: true });
      return;
    }

    fetchUser().then(() => {
      navigate("/dashboard", { replace: true });
    });
  }, [searchParams, fetchUser, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-600 mx-auto mb-4" />
        <p className="text-slate-600 text-sm">Connecting your account…</p>
      </div>
    </div>
  );
}
