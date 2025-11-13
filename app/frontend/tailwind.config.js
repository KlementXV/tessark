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
        'excalidraw-rose': '#ffc0d9',
        'excalidraw-yellow': '#fff59d',
        'excalidraw-green': '#c6f6d5',
        'excalidraw-violet': '#e0bbff',
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

