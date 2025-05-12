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
        accentHover: "#A063E0",
        navbar: "#1E1E1E",
        input: "#333333",
      },
      fontFamily: {
        sans: ["Inter", "sans-serif"],
      },
      transitionTimingFunction: {
        DEFAULT: "ease-in-out",
      },
      animation: {
        fadeIn: "fadeIn 0.5s ease-in-out",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
      },
    },
  },
  plugins: [],
};
