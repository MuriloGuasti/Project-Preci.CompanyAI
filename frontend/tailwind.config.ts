import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        preci: {
          dark: '#171717',
          light: '#F5F5F5',
          cardDark: '#1E1E1E',
          cardLight: '#FFFFFF',
          borderDark: '#2E2E2E',
          borderLight: '#E5E5E5',
          subtleDark: '#888888',
          subtleLight: '#777777',
        },
      },
      fontFamily: {
        sans: ['Satoshi', 'Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },
    },
  },
  plugins: [],
} satisfies Config;
