/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        atari: {
          black: '#111111',
          green: '#39ff14',
          pink: '#ff00ff',
          cyan: '#00ffff',
          yellow: '#ffff00',
          red: '#ff0000',
        }
      },
      fontFamily: {
        pixel: ['"Press Start 2P"', 'cursive'], // We need to import this in index.css
        mono: ['"VT323"', 'monospace'],
      },
      animation: {
        'scanline': 'scanline 8s linear infinite',
        'flicker': 'flicker 0.15s infinite',
        'pulse-fast': 'pulse 0.5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        scanline: {
          '0%': { transform: 'translateY(0)' },
          '100%': { transform: 'translateY(100vh)' },
        },
        flicker: {
          '0%': { opacity: '0.97' },
          '100%': { opacity: '1' },
        }
      },
      boxShadow: {
        'glow-green': '0 0 10px #39ff14, 0 0 20px #39ff14',
        'glow-pink': '0 0 10px #ff00ff, 0 0 20px #ff00ff',
      },
      textShadow: { // Note: standard tailwind doesn't have textShadow by default, but we can add utility via plugin or custom class
        'glow': '0 0 5px currentColor',
      }
    },
  },
  plugins: [],
}
