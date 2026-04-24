import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        // Semantic color palette
        primary: {
          DEFAULT: '#3b82f6', // blue-500
          subtle: '#eff6ff', // blue-50
        },
        surface: {
          DEFAULT: '#f9fafb', // gray-50
          elevated: '#ffffff',
        },
        border: {
          default: '#e5e7eb', // gray-200
        },
        text: {
          primary: '#111827', // gray-900
          secondary: '#6b7280', // gray-500
        },
      },
    },
  },
  plugins: [],
};

export default config;
