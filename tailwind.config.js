/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#121212",
        card: "#1E1E1E",
        textPrimary: "#FFFFFF",
        textSecondary: "#B3B3B3",
        accent: "#BB86FC",
      },
    },
  },
  plugins: [],
};
