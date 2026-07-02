import type { Config } from 'tailwindcss';

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // A modern, dark-mode friendly primary palette
        primary: {
          50: '#faf5ff',
          100: '#f3e8ff',
          500: '#a855f7',
          600: '#9333ea',
          900: '#581c87',
        },
        background: '#0f172a',
        surface: '#1e293b',
      },
    },
  },
  plugins: [],
} satisfies Config;