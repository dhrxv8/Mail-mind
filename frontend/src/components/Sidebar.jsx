import { useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { getInboxStats } from "../api/inbox.js";

// SVG icons — no emoji
const Icons = {
  Dashboard: () => (
    <svg className="w-4.5 h-4.5" viewBox="0 0 20 20" fill="currentColor">
      <path d="M2 10a8 8 0 018-8v8h8a8 8 0 11-16 0z" />
      <path d="M12 2.252A8.014 8.014 0 0117.748 8H12V2.252z" />
    </svg>
  ),
  Inbox: () => (
    <svg className="w-4.5 h-4.5" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M5 3a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2V5a2 2 0 00-2-2H5zm0 2h10v7h-2l-1 2H8l-1-2H5V5z" clipRule="evenodd" />
    </svg>
  ),
  Chat: () => (
    <svg className="w-4.5 h-4.5" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
    </svg>
  ),
  Settings: () => (
    <svg className="w-4.5 h-4.5" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
    </svg>
  ),
  LogOut: () => (
    <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M3 3a1 1 0 011 1v12a1 1 0 11-2 0V4a1 1 0 011-1zm7.707 3.293a1 1 0 010 1.414L9.414 9H17a1 1 0 110 2H9.414l1.293 1.293a1 1 0 01-1.414 1.414l-3-3a1 1 0 010-1.414l3-3a1 1 0 011.414 0z" clipRule="evenodd" />
    </svg>
  ),
};

const STATIC_NAV = [
  { to: "/dashboard", Icon: Icons.Dashboard, label: "Dashboard" },
  { to: "/inbox",     Icon: Icons.Inbox,     label: "Inbox"     },
  { to: "/chat",      Icon: Icons.Chat,      label: "Chat"      },
  { to: "/settings",  Icon: Icons.Settings,  label: "Settings"  },
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

  const handleLogout = async () => {
    await logout();
    navigate("/", { replace: true });
  };

  const avatarLetter = user?.name?.[0]?.toUpperCase() ?? "U";

  return (
    <>
      {/* ── Desktop sidebar ──────────────────────────────────────────────── */}
      <aside className="hidden md:flex w-60 min-h-screen flex-col flex-shrink-0"
             style={{ background: "linear-gradient(160deg, #1e1b4b 0%, #16133d 100%)" }}>

        {/* Logo */}
        <div className="px-5 py-5 border-b border-white/8">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                 style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}>
              <svg className="w-4 h-4 text-white" viewBox="0 0 20 20" fill="currentColor">
                <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
              </svg>
            </div>
            <span className="font-bold text-base tracking-tight"
                  style={{ background: "linear-gradient(90deg, #a5b4fc, #e0e7ff)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              MailMind
            </span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {STATIC_NAV.map(({ to, Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group ${
                  isActive
                    ? "bg-brand-500/20 text-white border border-brand-400/20"
                    : "text-indigo-300/80 hover:text-white hover:bg-white/6"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span className={`flex-shrink-0 transition-colors ${isActive ? "text-brand-300" : "text-indigo-400 group-hover:text-indigo-200"}`}>
                    <Icon />
                  </span>
                  <span className="flex-1">{label}</span>
                  {to === "/inbox" && totalUnread > 0 && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center"
                          style={{ background: "rgba(99,102,241,0.35)", color: "#c7d2fe" }}>
                      {totalUnread > 99 ? "99+" : totalUnread}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* User footer */}
        <div className="px-3 py-4 border-t border-white/8">
          <div className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-white/5 transition-colors">
            {user?.avatar_url ? (
              <img
                src={user.avatar_url}
                alt={user.name}
                className="w-8 h-8 rounded-full object-cover ring-2 ring-brand-500/40 flex-shrink-0"
              />
            ) : (
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                   style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}>
                {avatarLetter}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate leading-tight">{user?.name}</p>
              <p className="text-[11px] mt-0.5">
                {user?.plan === "pro" ? (
                  <span className="text-amber-300 font-medium">Pro</span>
                ) : (
                  <span className="text-indigo-400">Free plan</span>
                )}
              </p>
            </div>
            <button
              onClick={handleLogout}
              className="text-indigo-500 hover:text-indigo-300 transition-colors flex-shrink-0"
              title="Sign out"
            >
              <Icons.LogOut />
            </button>
          </div>
        </div>
      </aside>

      {/* ── Mobile bottom nav ─────────────────────────────────────────────── */}
      <nav className="flex md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-white/10"
           style={{ background: "linear-gradient(160deg, #1e1b4b 0%, #16133d 100%)" }}>
        {STATIC_NAV.map(({ to, Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center py-2.5 text-[11px] font-medium transition-colors ${
                isActive ? "text-brand-300" : "text-indigo-400 hover:text-indigo-200"
              }`
            }
          >
            {({ isActive }) => (
              <>
                <span className="relative mb-0.5">
                  <Icon />
                  {to === "/inbox" && totalUnread > 0 && (
                    <span className="absolute -top-1 -right-2 bg-brand-500 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                      {totalUnread > 9 ? "9+" : totalUnread}
                    </span>
                  )}
                </span>
                <span>{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </>
  );
}
