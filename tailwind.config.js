/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.html', './public/js/**/*.js'],
  theme: {
    extend: {
      fontFamily: { sans: ['Geist', 'sans-serif'] },
      colors: {
        primary: '#0f172a',
        'primary-light': '#f8fafc',
        accent: '#2563eb',
      },
    },
  },
  plugins: [],
};
