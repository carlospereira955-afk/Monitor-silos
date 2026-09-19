/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        silo: {
          low: '#ef4444',
          medium: '#f59e0b',
          full: '#22c55e',
        },
      },
      keyframes: {
        wave: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
      },
      animation: {
        wave: 'wave 3s linear infinite',
      },
    },
  },
  plugins: [],
}
