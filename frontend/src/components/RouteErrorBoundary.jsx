import { Component } from "react";
import { Link } from "react-router-dom";

/**
 * Error boundary for a single route. Catches errors in the route component
 * and shows a compact recovery UI so the rest of the app (sidebar, auth) stays usable.
 * "Try again" remounts the route; "Go home" navigates to dashboard.
 */
export default class RouteErrorBoundary extends Component {
  state = { hasError: false, retryKey: 0 };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error("RouteErrorBoundary caught:", error, info.componentStack);
  }

  handleRetry = () => {
    this.setState((prev) => ({ hasError: false, retryKey: prev.retryKey + 1 }));
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          className="min-h-[60vh] flex items-center justify-center p-6"
          role="alert"
          aria-live="assertive"
        >
          <div className="max-w-sm text-center">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-4"
              style={{ background: "linear-gradient(135deg, #fee2e2, #fecaca)" }}
            >
              <svg
                className="w-6 h-6 text-red-500"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden
              >
                <path
                  fillRule="evenodd"
                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-slate-900 mb-1.5">
              Something went wrong on this page
            </h2>
            <p className="text-slate-500 text-sm mb-6">
              You can try again or go back to the dashboard.
            </p>
            <div className="flex flex-col sm:flex-row gap-2 justify-center">
              <button
                type="button"
                onClick={this.handleRetry}
                className="px-4 py-2.5 rounded-xl text-sm font-medium text-white transition-all hover:opacity-90 active:scale-[0.98]"
                style={{ background: "linear-gradient(135deg, #4f46e5, #6366f1)" }}
                aria-label="Try loading this page again"
              >
                Try again
              </button>
              <Link
                to="/dashboard"
                className="px-4 py-2.5 rounded-xl text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 transition-all text-center"
                aria-label="Go to dashboard"
              >
                Go to dashboard
              </Link>
            </div>
          </div>
        </div>
      );
    }
    return <div key={this.state.retryKey}>{this.props.children}</div>;
  }
}
