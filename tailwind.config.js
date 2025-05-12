/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class', // Enable dark mode based on class
  content: [
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#121212',
        card: '#1E1E1E',
        textPrimary: '#FFFFFF',
        textSecondary: '#A0AEC0',
        accent: '#64FFDA',
        accentHover: '#45A692',
        input: '#2D3748',
        navbar: '#1A202C',
        darkBackground: '#000000',
        darkCard: '#333333',
        darkTextPrimary: '#FFFFFF',
        darkTextSecondary: '#A0AEC0',
        darkAccent: '#64FFDA',
        darkAccentHover: '#45A692',
        darkInput: '#4A5568',
        darkNavbar: '#2D3748',
      },
    },
  },
  plugins: [],
}
