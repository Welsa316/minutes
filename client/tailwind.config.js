/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // All semantic tokens read from CSS vars so a single `.dark` class on
        // the html element flips the whole palette. Terracotta stays the same
        // in both modes — it's the brand accent.
        ink:        'rgb(var(--c-ink) / <alpha-value>)',
        terracotta: 'rgb(var(--c-terracotta) / <alpha-value>)',
        warm:       'rgb(var(--c-warm) / <alpha-value>)',
        'slate-warm': 'rgb(var(--c-slate-warm) / <alpha-value>)',
        sand:       'rgb(var(--c-sand) / <alpha-value>)',
        surface:    'rgb(var(--c-surface) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        serif: ['"IBM Plex Serif"', 'ui-serif', 'Georgia', 'serif'],
      },
    },
  },
  plugins: [],
};
