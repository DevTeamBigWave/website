import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Wonderland Playhouse brand palette
        coral: {
          DEFAULT: '#ff7783',
          50: '#FFF1F3',
          100: '#FFE0E4',
          200: '#FFC2CA',
          300: '#FFA4AF',
          400: '#FF8E9B',
          500: '#ff7783',
          600: '#E45661',
          700: '#B43E47',
        },
        sunshine: {
          DEFAULT: '#fdda26',
          50: '#FFFBE5',
          100: '#FFF6BF',
          200: '#FEEC85',
          300: '#FEE350',
          400: '#fdda26',
          500: '#E5C200',
          600: '#B89A00',
        },
        sky: {
          DEFAULT: '#89cff0',
          50: '#EAF6FD',
          100: '#D2ECFA',
          200: '#B0DEF6',
          300: '#89cff0',
          400: '#5FBCE9',
          500: '#3EA8DC',
          600: '#2487B9',
        },
        slate: {
          DEFAULT: '#50758f',
          50: '#EEF3F7',
          100: '#D8E2EB',
          200: '#B2C4D4',
          300: '#85A0B6',
          400: '#67869F',
          500: '#50758f',
          600: '#3E5C71',
          700: '#2C4253',
        },
        olive: '#967d00',
        cream: {
          DEFAULT: '#FFFBF5',
          deep: '#FFF3E0',
        },
      },
      fontFamily: {
        display: ['var(--font-display)', 'Fredoka', 'system-ui', 'sans-serif'],
        sans: ['var(--font-sans)', 'Nunito', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        lg: '14px',
        xl: '20px',
        '2xl': '28px',
        '3xl': '36px',
      },
      boxShadow: {
        playful: '0 12px 32px -8px rgba(255, 119, 131, 0.35)',
        card: '0 8px 24px -6px rgba(80, 117, 143, 0.18)',
      },
    },
  },
  plugins: [],
};

export default config;
