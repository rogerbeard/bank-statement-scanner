/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        blueprint: {
          bg: '#0a1628',
          surface: '#0d1f3c',
          panel: '#112244',
          border: '#1e3a5f',
          line: '#2a5298',
          accent: '#4a90d9',
          bright: '#7ab8f5',
          white: '#e8f4ff',
          dim: '#8ab0d0',
          grid: 'rgba(74, 144, 217, 0.08)',
        },
        status: {
          success: '#00e5a0',
          warning: '#f5a623',
          error: '#ff4d6d',
          info: '#4a90d9',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      backgroundImage: {
        'blueprint-grid': `
          linear-gradient(rgba(74,144,217,0.07) 1px, transparent 1px),
          linear-gradient(90deg, rgba(74,144,217,0.07) 1px, transparent 1px)
        `,
        'blueprint-grid-fine': `
          linear-gradient(rgba(74,144,217,0.04) 1px, transparent 1px),
          linear-gradient(90deg, rgba(74,144,217,0.04) 1px, transparent 1px)
        `,
      },
      backgroundSize: {
        'grid-40': '40px 40px',
        'grid-8': '8px 8px',
      },
      boxShadow: {
        'blueprint': '0 0 0 1px rgba(74,144,217,0.3), 0 4px 24px rgba(10,22,40,0.8)',
        'blueprint-glow': '0 0 20px rgba(74,144,217,0.2), 0 0 0 1px rgba(74,144,217,0.4)',
        'blueprint-inner': 'inset 0 1px 0 rgba(74,144,217,0.15)',
      },
      animation: {
        'scan-line': 'scanLine 2s linear infinite',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
      },
      keyframes: {
        scanLine: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100vh)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}
