/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js}'],
  theme: {
    extend: {
      colors: {
        ink: '#0F1B2D',
        terracotta: '#C65D3E',
        warm: '#FBF8F3',
        'slate-warm': '#4A5568',
        sand: '#E8DDD0',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        serif: ['"IBM Plex Serif"', 'ui-serif', 'Georgia', 'serif'],
      },
    },
  },
  plugins: [],
};
