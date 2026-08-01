import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#01696f',
          hover: '#0c4e54',
          light: '#cedcd8',
        },
        success: '#437a22',
        warning: '#da7101',
        danger: '#a12c7b',
        surface: {
          DEFAULT: '#f7f6f2',
          card: '#f9f8f5',
          offset: '#f3f0ec',
        },
        border: 'rgba(40,37,29,0.12)',
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
    },
  },
  plugins: [],
}

export default config
