import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        serif: ['var(--font-serif)', 'Georgia', 'serif'],
        mono: ['var(--font-mono)', 'monospace'],
      },
      colors: {
        atelier: {
          limestone: '#f8f9fa',
          charcoal: '#1a1c1e',
          bronze: '#715a3e',
          'bronze-light': '#8b7355',
          'bronze-surface': '#f5ede4',
          surface: '#ffffff',
          border: '#e0e0e3',
          'text-primary': '#1a1c1e',
          'text-secondary': '#5a5c62',
          'text-muted': '#8a8c94',
        },
        'status-draft-bg': '#e7e8e9',
        'status-draft-text': '#44474a',
        'status-sent-bg': '#d8e3fa',
        'status-sent-text': '#3c475a',
        'status-partial-bg': '#fdddb9',
        'status-partial-text': '#584329',
        'status-paid-bg': '#dde8dd',
        'status-paid-text': '#2a5130',
        'status-overdue-bg': '#ffdad6',
        'status-overdue-text': '#93000a',
      },
      boxShadow: {
        card: '0px 4px 20px rgba(26, 28, 30, 0.04)',
        'card-hover': '0px 8px 32px rgba(26, 28, 30, 0.08)',
      },
    },
  },
  plugins: [],
}

export default config
