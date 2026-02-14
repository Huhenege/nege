/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  corePlugins: {
    preflight: false,
    container: false,
  },
  theme: {
    extend: {},
  },
  plugins: [],
}
