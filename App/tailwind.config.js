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
      colors: {
        primary: {
          50: "#edf4ff",
          100: "#d8e2ff",
          200: "#aac7ff",
          300: "#7aaeff",
          400: "#4f90ff",
          500: "#2a73f5",
          600: "#0058bc",
          700: "#004b9f",
          800: "#003b7d",
          900: "#002b59",
        },
        accent: "#0A84FF",

        "background-light": "#f7f9fb",
        "background-dark": "#131313",

        "card-light": "#ffffff",
        "card-dark": "#201f1f",

        "border-light": "#d9dee7",
        "border-dark": "#353534",

        "text-light": "#191c1e",
        "text-dark": "#e5e2e1",

        "subtext-light": "#5d6472",
        "subtext-dark": "#aeb5c0",

        muted: "#eceef0",
        border: "#d9dee7",
        text: "#191c1e",
        subtext: "#5d6472",
      },
      boxShadow: {
        card: "0 16px 40px rgba(16, 24, 40, 0.08)",
      },
    },
  },
  plugins: [],
};
