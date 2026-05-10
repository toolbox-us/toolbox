/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#FFF2EC',
          100: '#FFD9CA',
          200: '#FFB79A',
          300: '#FF9369',
          400: '#FF7B4C',
          500: '#FF6C37',   // Postman-like orange
          600: '#E85D2A',
          700: '#C84B20',
          800: '#A43D1B',
          900: '#7B2E14',
        },
        ij: {
          bg:       '#0B0D10',
          panel:    '#111317',
          popup:    '#15181D',
          elevated: '#1B1F25',
          border:   '#272C33',
          hover:    '#222730',
          input:    '#0B0D10',
          inputBrd: '#303640',
          text:     '#D7DCE2',
          muted:    '#9AA3AD',
          dim:      '#727B86',
        }
      }
    }
  },
  plugins: []
};
