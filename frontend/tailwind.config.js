/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}', './public/index.html'],
  theme: {
    extend: {
      fontFamily: {
        Outfit: ['Outfit', 'sans-serif'],
        Manrope: ['Manrope', 'sans-serif'],
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};
