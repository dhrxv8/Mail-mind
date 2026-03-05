import { createContext, useCallback, useContext, useState } from "react";

const ToastContext = createContext(null);

let _nextId = 0;

const TYPE_STYLES = {
  info:    "bg-gray-900 text-white",
  success: "bg-green-600 text-white",
  error:   "bg-red-600 text-white",
  warning: "bg-orange-500 text-white",
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = "info", duration = 4000) => {
    const id = ++_nextId;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration);
  }, []);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={addToast}>
      {children}
      {toasts.length > 0 && (
        <div className="fixed bottom-20 md:bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none px-4">
          {toasts.map((t) => (
            <div
              key={t.id}
              className={`flex items-center justify-between gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-medium pointer-events-auto animate-slide-up ${
                TYPE_STYLES[t.type] ?? TYPE_STYLES.info
              }`}
            >
              <span>{t.message}</span>
              <button
                onClick={() => dismiss(t.id)}
                aria-label="Dismiss notification"
                className="text-white/70 hover:text-white flex-shrink-0 text-lg leading-none"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </ToastContext.Provider>
  );
}

/** Returns `addToast(message, type?, duration?)` */
export function useToast() {
  const addToast = useContext(ToastContext);
  if (!addToast) throw new Error("useToast must be used within ToastProvider");
  return addToast;
}
