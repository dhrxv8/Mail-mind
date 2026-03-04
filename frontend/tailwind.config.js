/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "-apple-system", "sans-serif"],
      },
      colors: {
        brand: {
          50:  "#eef2ff",
          100: "#e0e7ff",
          200: "#c7d2fe",
          300: "#a5b4fc",
          400: "#818cf8",
          500: "#6366f1",
          600: "#4f46e5",
          700: "#4338ca",
          800: "#3730a3",
          900: "#312e81",
          950: "#1e1b4b",
        },
      },
      boxShadow: {
        card:        "0 1px 3px 0 rgba(0,0,0,0.06), 0 4px 16px 0 rgba(0,0,0,0.04)",
        "card-hover":"0 4px 16px 0 rgba(0,0,0,0.10), 0 1px 3px 0 rgba(0,0,0,0.06)",
        "glow":      "0 0 24px rgba(99,102,241,0.20)",
        "glow-sm":   "0 0 12px rgba(99,102,241,0.15)",
        "glow-lg":   "0 0 40px rgba(99,102,241,0.25)",
      },
      keyframes: {
        "slide-up": {
          "0%":   { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          "0%":   { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "scale-in": {
          "0%":   { opacity: "0", transform: "scale(0.97)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        "shimmer": {
          "0%":   { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "pulse-dot": {
          "0%, 100%": { opacity: "1", transform: "scale(1)" },
          "50%":      { opacity: "0.6", transform: "scale(0.85)" },
        },
        "float": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%":      { transform: "translateY(-6px)" },
        },
      },
      animation: {
        "slide-up":  "slide-up 0.2s ease-out",
        "fade-in":   "fade-in 0.3s ease-out",
        "scale-in":  "scale-in 0.18s ease-out",
        "shimmer":   "shimmer 2s linear infinite",
        "pulse-dot": "pulse-dot 2s ease-in-out infinite",
        "float":     "float 3s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
