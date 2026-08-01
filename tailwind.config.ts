import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          base: "#06080f",
          surface: "#0c0f1a",
          card: "#101420",
          hover: "#151924",
          border: "#1a1f30",
          muted: "#1e2436",
        },
        amber: {
          DEFAULT: "#f59e0b",
          dim: "#d97706",
          glow: "#fbbf24",
          muted: "#78350f",
          subtle: "#1c1208",
        },
        electric: {
          DEFAULT: "#38bdf8",
          dim: "#0ea5e9",
          muted: "#0c4a6e",
          subtle: "#061018",
        },
        status: {
          none: "#ef4444",
          broken: "#f97316",
          outdated: "#eab308",
          poor: "#a78bfa",
          needs: "#38bdf8",
          decent: "#22c55e",
        },
      },
      fontFamily: {
        display: ["var(--font-syne)", "sans-serif"],
        mono: ["var(--font-ibm-mono)", "monospace"],
        body: ["var(--font-dm-sans)", "sans-serif"],
      },
      animation: {
        "scan-line": "scanLine 8s linear infinite",
        "pulse-amber": "pulseAmber 2s ease-in-out infinite",
        "fade-in": "fadeIn 0.4s ease forwards",
        "slide-up": "slideUp 0.4s ease forwards",
        "card-in": "cardIn 0.5s ease forwards",
        shimmer: "shimmer 2s linear infinite",
        "ping-slow": "ping 3s cubic-bezier(0,0,0.2,1) infinite",
        ticker: "ticker 20s linear infinite",
      },
      keyframes: {
        scanLine: {
          "0%": { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(100vh)" },
        },
        pulseAmber: {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(245,158,11,0)" },
          "50%": { boxShadow: "0 0 12px 3px rgba(245,158,11,0.3)" },
        },
        fadeIn: {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        slideUp: {
          from: { opacity: "0", transform: "translateY(16px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        cardIn: {
          from: { opacity: "0", transform: "translateY(20px) scale(0.98)" },
          to: { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-700px 0" },
          "100%": { backgroundPosition: "700px 0" },
        },
        ticker: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
      },
      backgroundImage: {
        "grid-pattern":
          "linear-gradient(rgba(245,158,11,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(245,158,11,0.03) 1px, transparent 1px)",
        "card-gradient":
          "linear-gradient(135deg, rgba(245,158,11,0.05) 0%, transparent 60%)",
        "glow-amber":
          "radial-gradient(circle at 50% 50%, rgba(245,158,11,0.15) 0%, transparent 70%)",
        shimmer:
          "linear-gradient(90deg, transparent 0%, rgba(245,158,11,0.06) 50%, transparent 100%)",
      },
      backgroundSize: {
        grid: "32px 32px",
      },
      boxShadow: {
        card: "0 1px 3px rgba(0,0,0,0.4), 0 0 0 1px rgba(26,31,48,1)",
        "card-hover":
          "0 4px 20px rgba(0,0,0,0.5), 0 0 0 1px rgba(245,158,11,0.2), 0 0 20px rgba(245,158,11,0.05)",
        amber: "0 0 20px rgba(245,158,11,0.3)",
        "amber-sm": "0 0 8px rgba(245,158,11,0.2)",
        status: "inset 0 0 0 1px",
      },
    },
  },
  plugins: [],
};

export default config;
