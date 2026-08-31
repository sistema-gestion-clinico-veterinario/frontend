/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{html,ts}",
  ],
  theme: {
    extend: {
      fontSize: {
        base: ['15px', '1.5'],
      },
      fontFamily: {
        sans: ['Barlow', 'sans-serif'],
      },
      keyframes: {
        'slide-in-right': {
          '0%':   { transform: 'translateX(100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)',    opacity: '1' }
        }
      },
      animation: {
        'slide-in-right': 'slide-in-right 0.22s cubic-bezier(0.25, 0.46, 0.45, 0.94) both'
      }
    },
  },
  plugins: [],
}

