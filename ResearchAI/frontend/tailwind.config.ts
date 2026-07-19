import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Satoshi', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        satoshi: ['Satoshi', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        sidebar: {
          DEFAULT: 'transparent',
          border: 'rgba(255,255,255,0.06)',
          foreground: '#9f96c2',
          accent: 'rgba(139,92,246,0.15)',
          'accent-foreground': '#ffffff',
        },
      },
      backgroundImage: {
        'saas': "url('/saas-bg.png')",
        'sidebar-rail': 'linear-gradient(180deg, #A855F7 0%, #9333EA 50%, #D946EF 100%)',
        'header-rail': 'linear-gradient(90deg, #A855F7 0%, #9333EA 50%, #D946EF 100%)',
      },
      boxShadow: {
        'glow-purple': '0 0 30px rgba(168, 85, 247, 0.35)',
        'glow-pink': '0 0 30px rgba(217, 70, 239, 0.35)',
      },
      keyframes: {
        'pulse-orb': {
          '0%, 100%': { opacity: '0.6', transform: 'scale(1)' },
          '50%': { opacity: '0.9', transform: 'scale(1.05)' },
        },
      },
      animation: {
        'pulse-orb': 'pulse-orb 3s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}

export default config
