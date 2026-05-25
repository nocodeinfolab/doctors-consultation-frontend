/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        kura: {
          purple: {
            deep: '#23163A',
            DEFAULT: '#31214B',
            soft: '#51406F',
          },
          lilac: {
            DEFAULT: '#DCD2EC',
            soft: '#EEE7F7',
            mist: '#F7F3FB',
          },
          pearl: {
            DEFAULT: '#F9F7FC',
            soft: '#FFFCFE',
          },
          gold: {
            DEFAULT: '#C6A052',
            soft: '#F3E8CF',
          },
          danger: {
            DEFAULT: '#DC2626',
            soft: '#FEE2E2',
          },
        },
        premium: {
          lilac: {
            DEFAULT: '#DCD2EC',
            light: '#EEE7F7',
            soft: '#F7F3FB',
          },
          purple: {
            DEFAULT: '#51406F',
            dark: '#31214B',
            plum: '#23163A',
          },
          indigo: {
            DEFAULT: '#2B1D43',
            dark: '#23163A',
            deep: '#170F28',
          },
          royal: {
            DEFAULT: '#3C2B59',
            glow: '#5C497D',
          },
          pearl: {
            DEFAULT: '#FFFCFE',
            tint: '#F9F7FC',
          },
          ivory: '#FFFCFE',
          surface: '#F7F3FB',
          champagne: {
            DEFAULT: '#E9D7B0',
            gold: '#C6A052',
            soft: '#F3E8CF',
          },
        },
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        display: ['"Playfair Display"', 'serif'],
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.25rem',
        '4xl': '1.5rem',
      },
      boxShadow: {
        'premium-soft': '0 10px 28px rgba(35, 22, 58, 0.08)',
        'premium-layered':
          '0 16px 32px -18px rgba(35, 22, 58, 0.18), 0 8px 18px -12px rgba(35, 22, 58, 0.1)',
        'premium-hover': '0 16px 32px -18px rgba(35, 22, 58, 0.24)',
        'premium-glow': '0 0 14px rgba(92, 73, 125, 0.16)',
        'premium-ambient': '0 18px 36px rgba(23, 15, 40, 0.24)',
        'gold-glow': '0 0 10px rgba(198, 160, 82, 0.18)',
      },
    },
  },
  plugins: [],
};
