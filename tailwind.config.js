/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        surface: 'var(--surface)',
        card: 'var(--card)',
        border: 'var(--border)',
        'border-hover': 'var(--border-hover)',
        dim: 'var(--text-dim)',
        muted: 'var(--text-muted)',
        accent: 'var(--accent)',
        win: 'var(--green)',
        loss: 'var(--red)',
        e1: 'var(--green)',
        e2: 'var(--orange)',
        e3: 'var(--teal)',
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      borderRadius: {
        card: '14px',
      },
      animation: {
        'scan': 'scan 4s ease-in-out infinite',
        'pulse-dot': 'pulse-dot 2s ease-in-out infinite',
        'ring-fill': 'ring-fill 1.5s ease-out forwards',
      },
      keyframes: {
        scan: {
          '0%': { left: '-100%' },
          '100%': { left: '100%' },
        },
        'pulse-dot': {
          '0%, 100%': { r: '4' },
          '50%': { r: '5.5' },
        },
        'ring-fill': {
          from: { strokeDashoffset: '138.2' },
        },
      },
    },
  },
  plugins: [],
}
