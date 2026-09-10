/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,ts}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"IBM Plex Sans"', 'system-ui', 'sans-serif'],
      },
      colors: {
        paper: '#F3F3EF',
        surface: '#FFFFFF',
        ink: {
          DEFAULT: '#1B211C',
          muted: '#616B62',
          faint: '#8B948C',
        },
        line: '#DCDED6',
        primary: {
          DEFAULT: '#1F5B4C',
          dark: '#153F35',
          light: '#E7EFEC',
        },
        success: {
          DEFAULT: '#3E7A4C',
          light: '#E6F0E7',
        },
        pending: {
          DEFAULT: '#C9821E',
          light: '#FBF0DF',
        },
        danger: {
          DEFAULT: '#B5432E',
          light: '#F8E7E3',
        },
      },
      borderRadius: {
        DEFAULT: '6px',
      },
    },
  },
  plugins: [],
}
