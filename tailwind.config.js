/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./App.{js,jsx,ts,tsx}",
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: "#ffffff",
          muted: "#f5f5f5",
          raised: "#f0f0f0",
        },
        accent: {
          DEFAULT: "#0fb06a",
          secondary: "#3aa3ff",
        },
      },
    },
  },
  plugins: [],
};
