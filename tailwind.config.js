/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./packages/dashboard/index.html",
    "./packages/dashboard/src/**/*.{js,ts,jsx,tsx}",
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        app: {
          bg: '#F8FAFC',
          surface: '#FFFFFF',
          text: '#172033',
          muted: '#64748B',
          border: '#E2E8F0',
          primary: '#2563EB',
          'primary-hover': '#1D4ED8',
          success: '#15803D',
          warning: '#B45309',
          error: '#B91C1C'
        }
      },
      fontFamily: {
        sans: ['Inter', 'Noto Sans Devanagari', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      }
    },
  },
  plugins: [],
};
