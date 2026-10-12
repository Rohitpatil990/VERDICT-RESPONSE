/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        background: '#F8FAFC',
        surface: '#FFFFFF',
        surfaceHover: '#F1F5F9',
        surfaceSubtle: '#F8FAFC',
        border: '#E2E8F0',
        borderSubtle: '#F1F5F9',
        borderDark: '#CBD5E1',
        primaryText: '#172033',
        secondaryText: '#64748B',
        tertiaryText: '#94A3B8',
        primaryAction: '#2563EB',
        primaryActionHover: '#1D4ED8',
        tealVerdict: '#0F9D91',
        tealSubtle: '#F0FDFA',
        tealBorder: '#99F6E4',
        success: '#15803D',
        successSubtle: '#F0FDF4',
        successBorder: '#BBF7D0',
        warning: '#B45309',
        warningSubtle: '#FFFBEB',
        warningBorder: '#FDE68A',
        error: '#B91C1C',
        errorSubtle: '#FEF2F2',
        errorBorder: '#FECACA'
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace']
      },
      boxShadow: {
        subtle: '0 1px 2px 0 rgba(0, 0, 0, 0.04)',
        card: '0 1px 3px 0 rgba(0, 0, 0, 0.06), 0 1px 2px -1px rgba(0, 0, 0, 0.04)',
        panel: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.03)'
      }
    }
  },
  plugins: []
};
