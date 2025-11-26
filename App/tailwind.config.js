/** @type {import('tailwindcss').Config} */
module.exports = {
  presets: [require('nativewind/preset')],
  content: [
    './App.{js,jsx,ts,tsx}',
    './src/**/*.{js,jsx,ts,tsx}',
    './app/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
        accent: '#0f5cff',
        muted: '#f1f5f9',
        border: '#e2e8f0',
        text: '#0f172a',
        subtext: '#475569',
      },
      boxShadow: {
        card: '0 4px 12px rgba(15, 92, 255, 0.08)',
      },
    },
  },
  plugins: [],
};

