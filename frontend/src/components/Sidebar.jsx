import { useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { getInboxStats } from "../api/inbox.js";

const STATIC_NAV = [
  { to: "/dashboard", icon: "🏠", label: "Dashboard" },
  { to: "/inbox",     icon: "📥", label: "Inbox"     },
  { to: "/chat",      icon: "💬", label: "Chat"      },
  { to: "/settings",  icon: "⚙️", label: "Settings"  },
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [totalUnread, setTotalUnread] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getInboxStats()
      .then((data) => { if (!cancelled) setTotalUnread(data.total_unread ?? 0); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const handleLogout = () => {
    logout();
    navigate("/", { replace: true });
  };

  return (
    <>
      {/* ── Desktop sidebar ──────────────────────────────────────────────────── */}
      <aside className="hidden md:flex w-64 min-h-screen bg-gray-900 text-white flex-col flex-shrink-0">
        {/* Logo */}
        <div className="px-6 py-5 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <span className="text-xl">✉️</span>
            <span className="font-bold text-lg tracking-tight">MailMind</span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {STATIC_NAV.map(({ to, icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-blue-600 text-white"
                    : "text-gray-400 hover:text-white hover:bg-gray-800"
                }`
              }
            >
              <span>{icon}</span>
              <span className="flex-1">{label}</span>
              {to === "/inbox" && totalUnread > 0 && (
                <span className="bg-blue-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                  {totalUnread > 99 ? "99+" : totalUnread}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        {/* User footer */}
        <div className="px-4 py-4 border-t border-gray-800">
          <div className="flex items-center gap-3 mb-3">
            {user?.avatar_url ? (
              <img
                src={user.avatar_url}
                alt={user.name}
                className="w-8 h-8 rounded-full object-cover"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold">
                {user?.name?.[0]?.toUpperCase() ?? "U"}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{user?.name}</p>
              <p className="text-xs text-gray-400">
                {user?.plan === "pro" ? "⭐ Pro" : "Free plan"}
              </p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* ── Mobile bottom nav ─────────────────────────────────────────────────── */}
      <nav className="flex md:hidden fixed bottom-0 inset-x-0 z-40 bg-gray-900 border-t border-gray-800">
        {STATIC_NAV.map(({ to, icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center py-2 text-xs font-medium transition-colors ${
                isActive ? "text-blue-400" : "text-gray-400"
              }`
            }
          >
            <span className="text-xl mb-0.5 relative">
              {icon}
              {to === "/inbox" && totalUnread > 0 && (
                <span className="absolute -top-1 -right-2 bg-blue-500 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                  {totalUnread > 9 ? "9+" : totalUnread}
                </span>
              )}
            </span>
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </>
  );
}
