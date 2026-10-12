/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}"
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: '#0B1220',
        surface: '#111A2E',
        surfaceHover: '#18243F',
        border: '#1E2A44',
        tealVerdict: '#4FD1B5',
        amberVerdict: '#F6C26B',
        purpleVerdict: '#A78BFA',
        roseVerdict: '#F87171',
        fogSlate: '#64748B'
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace']
      }
    }
  },
  plugins: []
};
