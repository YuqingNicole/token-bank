/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,tsx,jsx}",
    "./components/**/*.{js,ts,tsx,jsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"SF Mono"', '"Cascadia Code"', 'monospace'],
      },
      colors: {
        vault: {
          bg: 'var(--bg)',
          surface: 'var(--surface)',
          raised: 'var(--surface-raised)',
        },
      },
      boxShadow: {
        'vault': 'var(--shadow-sm)',
        'vault-md': 'var(--shadow-md)',
        'vault-lg': 'var(--shadow-lg)',
      },
      transitionTimingFunction: {
        'out-expo': 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
    },
  },
  plugins: [],
}
