/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./*.html'],
  // Some classes are built at runtime from JS template strings (e.g. `w-${size} h-${size}`
  // in avatarHtml()), so the content scanner can't see them literally. Safelist every size
  // that actually gets passed in across the app so the CSS for them is still generated.
  safelist: [
    'w-8', 'h-8',
    'w-9', 'h-9',
    'w-10', 'h-10',
    'w-16', 'h-16',
    'w-20', 'h-20'
  ],
  theme: {
    extend: {
      colors: {
        brand: { 50: '#f5f3ff', 100: '#ede9fe', 500: '#8b5cf6', 600: '#7c3aed', 700: '#6d28d9', 950: '#06040d' },
        cyber: { glowGreen: '#10b981', glowBlue: '#00f0ff', glowPink: '#ff007f' }
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'Inter', 'sans-serif'],
        mono: ['Space Grotesk', 'monospace']
      }
    }
  },
  plugins: []
};
