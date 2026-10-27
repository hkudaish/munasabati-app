import type { Config } from "tailwindcss";

const config: Config = {
  // Only the class strategy: nothing sets it, so `dark:` utilities no longer follow the OS setting.
  darkMode: "class",
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
      // Type scale: nothing meant to be read is under 13px (Arabic letterforms need the room); 16px is body.
      // xs and sm are the two sizes most running text uses, so they are set here rather than at each use.
      fontSize: {
        xs: ["0.8125rem", { lineHeight: "1.25rem" }],
        sm: ["0.9375rem", { lineHeight: "1.5rem" }],
        caption2: ["0.8125rem", { lineHeight: "1.125rem" }],
        caption: ["0.8125rem", { lineHeight: "1.125rem" }],
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
      // Radius follows the role of the surface: controls 10px, cards 14px, sheets and dialogs 20px.
      borderRadius: {
        lg: "0.5rem",
        xl: "0.625rem",
        "2xl": "0.875rem",
        "3xl": "1.25rem",
      },
      // Shadows are emerald-tinted and shallow; depth is reserved for things that float (menus, dialogs).
      boxShadow: {
        sm: "0 1px 2px rgba(0, 51, 42, 0.06)",
        DEFAULT: "0 1px 3px rgba(0, 51, 42, 0.08)",
        md: "0 2px 6px -1px rgba(0, 51, 42, 0.08)",
        lg: "0 6px 16px -4px rgba(0, 51, 42, 0.10)",
        xl: "0 12px 28px -8px rgba(0, 51, 42, 0.14)",
        "2xl": "0 24px 48px -12px rgba(0, 51, 42, 0.22)",
        glow: "0 0 0 3px rgba(197, 155, 39, 0.18)",
        "glow-green": "0 0 0 3px rgba(0, 77, 63, 0.14)",
        card: "0 1px 2px rgba(0, 51, 42, 0.05)",
      },
      animation: {
        "fade-in": "fadeIn 0.2s cubic-bezier(0.23, 1, 0.32, 1)",
        "slide-up": "slideUp 0.3s cubic-bezier(0.23, 1, 0.32, 1)",
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
