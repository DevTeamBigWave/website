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
        // Brand palette — pulled from the transactional email templates
        terracotta: {
          DEFAULT: '#C66B3D',
          50: '#FBF1EA',
          100: '#F4DAC8',
          200: '#EAB69B',
          300: '#DF916D',
          400: '#D27E55',
          500: '#C66B3D',
          600: '#A8552E',
          700: '#7E3F22',
        },
        cream: {
          DEFAULT: '#FAF6EE',
          deep: '#F2EAD8',
        },
        ink: {
          DEFAULT: '#1F1B16',
          soft: '#7A5A3F',
        },
        sage: {
          DEFAULT: '#7C8E5C',
          deep: '#5E6E45',
        },
      },
      fontFamily: {
        serif: ['var(--font-serif)', 'Georgia', 'serif'],
        sans: ['var(--font-sans)', 'Helvetica', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        lg: '12px',
        xl: '16px',
        '2xl': '20px',
      },
    },
  },
  plugins: [],
};

export default config;
