/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './pages/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Excalidraw color palette
        'excalidraw-slate': '#626262',
        'excalidraw-slate-light': '#f5f5f5',
        'excalidraw-azure': '#a7f3d0',
        'excalidraw-azure-light': '#d4f1f9',
        'excalidraw-azure-dark': '#5dd9c1',
        'excalidraw-rose': '#ffc0d9',
        'excalidraw-rose-light': '#ffe4f0',
        'excalidraw-rose-dark': '#ff8fa3',
        'excalidraw-yellow': '#fff59d',
        'excalidraw-yellow-light': '#fffde7',
        'excalidraw-yellow-dark': '#ffea58',
        'excalidraw-green': '#c6f6d5',
        'excalidraw-green-light': '#e1ffd1',
        'excalidraw-green-dark': '#86efac',
        'excalidraw-violet': '#e0bbff',
        'excalidraw-violet-light': '#f0e4ff',
        'excalidraw-violet-dark': '#c084fc',
        'excalidraw-blue': '#b3d9ff',
        'excalidraw-blue-light': '#e0efff',
        'excalidraw-blue-dark': '#6bb6ff',
        'excalidraw-orange': '#ffc97e',
        'excalidraw-orange-light': '#ffe5c0',
        'excalidraw-orange-dark': '#ff9500',
      },
      fontFamily: {
        'excalidraw': ['"Cascadia Code"', '"Courier New"', 'monospace'],
      },
      boxShadow: {
        'sketchy': '0 0 0 1px rgba(0,0,0,0.1), 0 2px 4px rgba(0,0,0,0.1)',
        'sketchy-lg': '0 0 0 1px rgba(0,0,0,0.1), 0 8px 16px rgba(0,0,0,0.1)',
      },
    },
  },
  plugins: [],
};

