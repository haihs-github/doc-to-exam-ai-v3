// Created by Haihs on 11/11/2026
// Tailwind 3.4 theme ported from the source client: brand/ink palettes, flat shadows, class dark mode.
const brand = {
  50: '#f7f5ff',
  100: '#efeafe',
  200: '#e0d8fd',
  300: '#cbbcfc',
  400: '#b39dfa',
  500: '#9277ee',
  600: '#7c5ce6',
  700: '#6d4fd6',
  800: '#5a3fb8',
  900: '#43308a',
};
const ink = {
  50: '#fafafa',
  100: '#f4f4f5',
  200: '#e4e4e7',
  300: '#d4d4d8',
  400: '#a1a1aa',
  500: '#71717a',
  600: '#52525b',
  700: '#3f3f46',
  800: '#27272a',
  900: '#18181b',
  950: '#09090b',
};

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./src/**/*.{html,ts}'],
  theme: {
    extend: {
      keyframes: {
        progress: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(300%)' },
        },
      },
      animation: { progress: 'progress 1.1s ease-in-out infinite' },
      borderRadius: { lg: '0.375rem', xl: '0.5rem', '2xl': '0.5rem', '3xl': '0.5rem' },
      fontWeight: { bold: '600', extrabold: '600', black: '600' },
      fontFamily: {
        sans: [
          '"Be Vietnam Pro"',
          'Roboto',
          '"Google Sans"',
          'system-ui',
          '-apple-system',
          '"Segoe UI"',
          'Arial',
          'sans-serif',
        ],
      },
      boxShadow: {
        raised: '0 1px 2px rgba(60,64,67,0.15)',
        floating: '0 1px 3px rgba(60,64,67,0.3)',
        overlay: '0 4px 12px rgba(60,64,67,0.3)',
        field: 'none',
        'raised-dark': '0 1px 2px rgba(0,0,0,0.5)',
        'floating-dark': '0 1px 3px rgba(0,0,0,0.6)',
        'overlay-dark': '0 4px 12px rgba(0,0,0,0.7)',
        'field-dark': 'none',
      },
      colors: {
        primary: brand,
        sky: brand,
        blue: brand,
        violet: brand,
        indigo: brand,
        gray: ink,
        slate: ink,
      },
    },
  },
  plugins: [],
};
