/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/app/**/*.{js,jsx}',
    './src/components/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef7f6',
          100: '#d3ebe8',
          200: '#a7d7d1',
          300: '#79bfb6',
          400: '#4aa198',
          500: '#2f847a', // primario — evoca fibra óptica / señal
          600: '#246a62',
          700: '#1c534c',
          800: '#153f3a',
          900: '#0f2e2a',
        },
        accent: '#f2a541', // acento cálido (facturación / alertas positivas)
      },
      fontFamily: {
        display: ['var(--font-display)'],
        body: ['var(--font-body)'],
      },
    },
  },
  plugins: [],
};
