import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext.jsx";
import { ToastProvider } from "./context/ToastContext.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import RouteErrorBoundary from "./components/RouteErrorBoundary.jsx";

const Landing = lazy(() => import("./pages/Landing.jsx"));
const Login = lazy(() => import("./pages/Login.jsx"));
const AuthCallback = lazy(() => import("./pages/AuthCallback.jsx"));
const Dashboard = lazy(() => import("./pages/Dashboard.jsx"));
const Chat = lazy(() => import("./pages/Chat.jsx"));
const Inbox = lazy(() => import("./pages/Inbox.jsx"));
const Settings = lazy(() => import("./pages/Settings.jsx"));

function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f5f6fa]" aria-label="Loading page">
      <div className="w-6 h-6 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" aria-hidden />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <AuthProvider>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              {/* Public */}
              <Route path="/" element={<RouteErrorBoundary><Landing /></RouteErrorBoundary>} />
              <Route path="/login" element={<RouteErrorBoundary><Login /></RouteErrorBoundary>} />
              <Route path="/auth/callback" element={<RouteErrorBoundary><AuthCallback /></RouteErrorBoundary>} />

              {/* Protected — requires valid JWT */}
              <Route element={<ProtectedRoute />}>
                <Route path="/dashboard" element={<RouteErrorBoundary><Dashboard /></RouteErrorBoundary>} />
                <Route path="/inbox" element={<RouteErrorBoundary><Inbox /></RouteErrorBoundary>} />
                <Route path="/chat" element={<RouteErrorBoundary><Chat /></RouteErrorBoundary>} />
                <Route path="/chat/:conversationId" element={<RouteErrorBoundary><Chat /></RouteErrorBoundary>} />
                <Route path="/settings" element={<RouteErrorBoundary><Settings /></RouteErrorBoundary>} />
              </Route>
            </Routes>
          </Suspense>
        </AuthProvider>
      </ToastProvider>
    </ErrorBoundary>
  );
}
