/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'weni': {
          50: '#f0fdfc',
          100: '#ccfbf6',
          200: '#99f6ec',
          300: '#5eeadb',
          400: '#00DED2',
          500: '#00c4b8',
          600: '#00a89d',
          700: '#058076',
          800: '#0a655f',
          900: '#0d524e',
        },
      },
      fontFamily: {
        'sans': ['Plus Jakarta Sans', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
