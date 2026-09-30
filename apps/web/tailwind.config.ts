import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: "#0b1220",
          soft: "#1a2436",
        },
        gold: {
          DEFAULT: "#c9a24b",
          light: "#e4c877",
        },
        // Semantic tokens for .lux screens (see globals.css)
        canvas: "var(--bg)",
        surface: "var(--surface)",
        raised: "var(--raised)",
        sunken: "var(--sunken)",
        line: { DEFAULT: "var(--line)", strong: "var(--line-strong)" },
        fg: { DEFAULT: "var(--fg)", 2: "var(--fg-2)", 3: "var(--fg-3)" },
        accent: { DEFAULT: "var(--accent)", text: "var(--accent-text)", soft: "var(--accent-soft)", on: "var(--on-accent)" },
        ok: { DEFAULT: "var(--ok)", soft: "var(--ok-soft)" },
        bad: { DEFAULT: "var(--bad)", soft: "var(--bad-soft)" },
        info: { DEFAULT: "var(--info)", soft: "var(--info-soft)" },
        warn: { DEFAULT: "var(--warn)", soft: "var(--warn-soft)" },
        neutral: { soft: "var(--neutral-soft)" },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "Georgia", "serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;
