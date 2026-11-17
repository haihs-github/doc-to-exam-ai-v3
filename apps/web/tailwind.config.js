// Created by Haihs on 11/11/2026
// Tailwind 3.4 theme ported from the source client: brand/ink palettes, flat shadows, class dark mode.
const brand = { 50: '#f7f5ff', 100: '#efeafe', 200: '#e0d8fd', 300: '#cbbcfc', 400: '#b39dfa', 500: '#9277ee', 600: '#7c5ce6', 700: '#6d4fd6', 800: '#5a3fb8', 900: '#43308a' };
// Haihs: palette enterprise xanh dương (thanh trên #1A67A3 ở mức 700) và ink ngả xanh đen cho dark mode - start
const primary = { 50: '#eef5fb', 100: '#d9e8f5', 200: '#b3d1ea', 300: '#8dbbe3', 400: '#5b9bd5', 500: '#2f80c2', 600: '#2272b3', 700: '#1a67a3', 800: '#145286', 900: '#0f3e66' };
const success = { 50: '#edf7ee', 100: '#d4ecd6', 200: '#a9d9ad', 300: '#7cc383', 400: '#52a95a', 500: '#3a9142', 600: '#2e7d32', 700: '#256628', 800: '#1d501f', 900: '#153a17' };
// const status = { new: '#1f78d1', progress: '#b36b00', confirmed: '#2e7d32', resolved: '#0e7c70', closed: '#647385' }; // Haihs: đóng code cũ, progress/new chưa đạt AA khi dùng làm chữ - start - end
const status = { new: '#1a6fc4', progress: '#9a5b00', confirmed: '#2e7d32', resolved: '#0e7c70', closed: '#647385' }; // Haihs: tăng tương phản progress/new đạt AA - start - end
const type = { bug: '#c62828', feature: '#2e7d32', task: '#1a67a3' };
// const ink = { 50: '#fafafa', 100: '#f4f4f5', 200: '#e4e4e7', 300: '#d4d4d8', 400: '#a1a1aa', 500: '#71717a', 600: '#52525b', 700: '#3f3f46', 800: '#27272a', 900: '#18181b', 950: '#09090b' }; // đóng code cũ
const ink = { 50: '#f6f8fa', 100: '#eef1f5', 200: '#dde3ea', 300: '#c3ccd6', 400: '#9aa7b6', 500: '#647385', 600: '#4b5a6c', 700: '#33404f', 800: '#222c38', 900: '#1b2430', 950: '#141a23' };
// Haihs: palette enterprise xanh dương và ink xanh đen - end

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./src/**/*.{html,ts}'],
  theme: {
    extend: {
      keyframes: { progress: { '0%': { transform: 'translateX(-100%)' }, '100%': { transform: 'translateX(300%)' } } },
      animation: { progress: 'progress 1.1s ease-in-out infinite' },
      // borderRadius: { lg: '0.375rem', xl: '0.5rem', '2xl': '0.5rem', '3xl': '0.5rem' }, // Haihs: đóng code cũ, bo góc nhỏ 2-3px kiểu enterprise - start - end
      borderRadius: { DEFAULT: '2px', sm: '2px', md: '3px', lg: '3px', xl: '3px', '2xl': '3px', '3xl': '3px' }, // Haihs: bo góc nhỏ 2-3px kiểu enterprise - start - end
      fontWeight: { bold: '600', extrabold: '600', black: '600' },
      fontFamily: {
        sans: ['"Be Vietnam Pro"', 'Roboto', '"Google Sans"', 'system-ui', '-apple-system', '"Segoe UI"', 'Arial', 'sans-serif'],
      },
      boxShadow: {
        // Haihs: bóng mỏng hơn - start
        // raised: '0 1px 2px rgba(60,64,67,0.15)',
        // floating: '0 1px 3px rgba(60,64,67,0.3)',
        // overlay: '0 4px 12px rgba(60,64,67,0.3)',
        raised: '0 1px 1px rgba(27,36,48,0.08)',
        floating: '0 1px 2px rgba(27,36,48,0.18)',
        overlay: '0 2px 8px rgba(27,36,48,0.22)',
        // Haihs: bóng mỏng hơn - end
        field: 'none',
        'raised-dark': '0 1px 2px rgba(0,0,0,0.5)',
        'floating-dark': '0 1px 3px rgba(0,0,0,0.6)',
        'overlay-dark': '0 4px 12px rgba(0,0,0,0.7)',
        'field-dark': 'none',
      },
      colors: {
        // primary: brand, sky: brand, blue: brand, violet: brand, indigo: brand, // Haihs: đóng code cũ, mọi alias trỏ về primary xanh - start - end
        primary, sky: primary, blue: primary, violet: primary, indigo: primary, success, status, type, // Haihs: alias về primary, thêm success/status/type - start - end
        gray: ink, slate: ink,
      },
    },
  },
  plugins: [],
};
