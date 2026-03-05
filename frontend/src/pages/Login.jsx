import { Navigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import GoogleIcon from "../components/icons/GoogleIcon.jsx";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

export default function Login() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const hasError = searchParams.get("error") === "auth_failed";

  if (user) return <Navigate to="/dashboard" replace />;

  const handleGoogleLogin = () => {
    window.location.href = `${API_BASE}/auth/google`;
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden"
         style={{ background: "linear-gradient(160deg, #1e1b4b 0%, #312e81 40%, #4f46e5 100%)" }}>
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-[500px] h-[500px] rounded-full opacity-20"
             style={{ background: "radial-gradient(circle, #818cf8, transparent)" }} />
        <div className="absolute -bottom-40 -left-40 w-[400px] h-[400px] rounded-full opacity-15"
             style={{ background: "radial-gradient(circle, #6366f1, transparent)" }} />
      </div>

      <div className="relative bg-white rounded-2xl shadow-2xl border border-slate-100 p-8 w-full max-w-md text-center animate-scale-in">
        {/* Brand icon */}
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5"
             style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}>
          <svg className="w-7 h-7 text-white" viewBox="0 0 20 20" fill="currentColor">
            <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
            <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-slate-900 mb-2 tracking-tight">
          Welcome to MailMind
        </h1>
        <p className="text-slate-500 text-sm mb-8 leading-relaxed">
          Connect your Gmail to build your personal AI memory.
          <br />
          Your key, your credits — we never charge for AI.
        </p>

        {hasError && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm mb-6 animate-slide-up">
            Authentication failed. Please try again.
          </div>
        )}

        <button
          onClick={handleGoogleLogin}
          className="w-full flex items-center justify-center gap-3 border border-slate-200 rounded-xl px-4 py-3.5 text-slate-700 font-medium hover:bg-slate-50 hover:border-slate-300 active:scale-[0.99] transition-all duration-150 shadow-card hover:shadow-card-hover"
        >
          <GoogleIcon />
          Continue with Google
        </button>

        <div className="mt-8 flex items-center gap-4 justify-center">
          {["Encrypted storage", "Delete anytime", "No raw emails stored"].map((text) => (
            <div key={text} className="flex items-center gap-1.5">
              <svg className="w-3 h-3 text-emerald-500 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              <span className="text-[11px] text-slate-400 font-medium">{text}</span>
            </div>
          ))}
        </div>

        <p className="text-xs text-slate-400 mt-4 leading-relaxed">
          By signing in you agree to our Terms of Service.
        </p>
      </div>
    </div>
  );
}

