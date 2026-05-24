import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sora: ["Sora", "sans-serif"],
        sans: ["DM Sans", "sans-serif"],
      },
      colors: {
        sage: {
          50:  "#f2f7f4",
          100: "#e0ede6",
          200: "#c2dccf",
          300: "#96c2aa",
          400: "#63a07f",
          500: "#3f8260",
          600: "#2e684c",
          700: "#26543e",
          800: "#204433",
          900: "#1b382b",
        },
        rose: {
          50:  "#fff1f2",
          100: "#ffe4e6",
          200: "#fecdd3",
          300: "#fda4af",
          400: "#fb7185",
          500: "#f43f5e",
          600: "#e11d48",
        },
        amber: {
          50:  "#fffbeb",
          100: "#fef3c7",
          200: "#fde68a",
          300: "#fcd34d",
          400: "#fbbf24",
          500: "#f59e0b",
        },
      },
      borderRadius: {
        "2xl": "1rem",
        "3xl": "1.5rem",
        "4xl": "2rem",
      },
      backdropBlur: {
        xs: "2px",
      },
      boxShadow: {
        glass: "0 8px 32px rgba(0,0,0,0.06), 0 2px 8px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.9)",
        "glass-hover": "0 16px 48px rgba(0,0,0,0.10), 0 4px 16px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.9)",
        "card-sm": "0 2px 12px rgba(0,0,0,0.05)",
      },
      animation: {
        "count-up": "count-up 1.2s ease-out forwards",
        "fade-in": "fade-in 0.4s ease-out forwards",
        "slide-up": "slide-up 0.4s ease-out forwards",
      },
      keyframes: {
        "count-up": { "0%": { opacity: "0", transform: "translateY(8px)" }, "100%": { opacity: "1", transform: "translateY(0)" } },
        "fade-in": { "0%": { opacity: "0" }, "100%": { opacity: "1" } },
        "slide-up": { "0%": { opacity: "0", transform: "translateY(16px)" }, "100%": { opacity: "1", transform: "translateY(0)" } },
      },
    },
  },
  plugins: [],
};

export default config;
