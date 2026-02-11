/** @type {import('tailwindcss').Config} */
module.exports = {
  presets: [require("nativewind/preset")],
  darkMode: "class",
  content: [
    "./App.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}",
    "./app/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        roboto: ["Roboto"],
      },
      colors: {
        brand: {
          dark: "#011a34",
          darkAlt: "#042450",
          primary: "#007bff",
          primaryDark: "#0066cc",
          success: "#4CAF50",
          warning: "#ff7043",
          danger: "#e53935",
        },
        primary: {
          50: "#eef6ff",
          100: "#d9ebff",
          200: "#b6d7ff",
          300: "#89beff",
          400: "#5aa2ff",
          500: "#007bff",
          600: "#0066cc",
          700: "#005bb5",
          800: "#004a94",
          900: "#003b73",
        },
        accent: "#007bff",
        "surface-light": "#f5f7fb",
        "surface-dark": "#04101f",

        // tokens para light/dark
        "background-light": "#f5f7fb",
        "background-dark": "#011a34",

        "card-light": "#ffffff",
        "card-dark": "#042450",

        "border-light": "#d9e3f0",
        "border-dark": "#0b2a52",

        "text-light": "#0f172a",
        "text-dark": "#f8fafc",

        "subtext-light": "#5b6b7e",
        "subtext-dark": "#b7c6d8",

        muted: "#eef2f7",
        border: "#d9e3f0",
        text: "#0f172a",
        subtext: "#5b6b7e",
      },
      boxShadow: {
        card: "0 12px 30px rgba(1, 26, 52, 0.12)",
      },
    },
  },
  plugins: [],
};
