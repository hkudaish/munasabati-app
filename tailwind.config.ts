import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        saudi: {
          green: {
            50: "#f0fdf4",
            100: "#dcfce7",
            200: "#bbf7d0",
            300: "#86efac",
            400: "#4ade80",
            500: "#22c55e",
            600: "#16a34a",
            700: "#15803d",
            800: "#004D3F", // Saudi signature deep emerald
            900: "#00332A",
            950: "#001F19",
          },
          gold: {
            50: "#fbf8ee",
            100: "#f6eed4",
            200: "#eddaa8",
            300: "#e2c076",
            400: "#d4a444",
            500: "#C59B27", // Royal Gold
            600: "#8a6219",
            700: "#875f1a",
            800: "#6e4c1b",
            900: "#5b3f1b",
          },
          sand: {
            50: "#FAF7F2",
            100: "#F4EFE6",
            200: "#E8DFD0",
            300: "#D7C9B1",
            400: "#BFAB8E",
            500: "#A78F70",
          },
          maroon: "#721C24",
          violet: "#4A154B",
        },
      },
      // Type scale (apple-design): 11px is the floor; 16px is body.
      fontSize: {
        caption2: ["0.6875rem", { lineHeight: "1rem" }],
        caption: ["0.75rem", { lineHeight: "1.125rem" }],
        footnote: ["0.8125rem", { lineHeight: "1.25rem" }],
        subhead: ["0.9375rem", { lineHeight: "1.375rem" }],
        body: ["1rem", { lineHeight: "1.625rem" }],
        headline: ["1.0625rem", { lineHeight: "1.625rem", fontWeight: "700" }],
        title: ["1.375rem", { lineHeight: "1.875rem", fontWeight: "800" }],
        "large-title": ["2rem", { lineHeight: "2.5rem", fontWeight: "800" }],
      },
      fontFamily: {
        cairo: ["Saudi Riyal", "var(--font-cairo)", "Cairo", "sans-serif"],
        tajawal: ["Saudi Riyal", "var(--font-tajawal)", "Tajawal", "sans-serif"],
        sans: ["Saudi Riyal", "var(--font-tajawal)", "sans-serif"],
        mono: ["Saudi Riyal", "ui-monospace", "monospace"],
      },
      boxShadow: {
        glow: "0 0 25px -5px rgba(197, 155, 39, 0.25)",
        "glow-green": "0 0 25px -5px rgba(0, 77, 63, 0.25)",
        card: "0 10px 30px -10px rgba(0,0,0,0.06), 0 4px 6px -2px rgba(0,0,0,0.02)",
      },
      animation: {
        "fade-in": "fadeIn 0.3s ease-in-out",
        "slide-up": "slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
        "pulse-slow": "pulse 3s infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { transform: "translateY(16px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
      },
    },
  },
  plugins: [],
};
export default config;
