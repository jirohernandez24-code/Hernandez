/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'medical-blue': '#1a73e8',
        'medical-green': '#0d9488',
        'medical-red': '#dc2626',
        'medical-amber': '#d97706',
        'vital-normal': '#22c55e',
        'vital-warning': '#eab308',
        'vital-critical': '#ef4444',
      },
      animation: {
        'pulse-vital': 'pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'heartbeat': 'heartbeat 1s ease-in-out infinite',
      },
      keyframes: {
        heartbeat: {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.05)' },
        },
      },
    },
  },
  plugins: [],
};
