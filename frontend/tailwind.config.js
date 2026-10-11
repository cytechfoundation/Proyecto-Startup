/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        navy: { 950: "#060B1A", 900: "#0A1230", 800: "#101B45" },
        electric: { 400: "#22D3EE", 500: "#06B6D4" },
      },
    },
  },
  plugins: [],
};
