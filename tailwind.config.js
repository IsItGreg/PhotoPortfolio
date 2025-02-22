/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{html,js,ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        name: ["Just Another Hand", "sans-serif"],
        lost: ["Lost Late", "sans-serif"],
        handwriting: ["Handwriting", "sans-serif"],
      },
      colors: {
        mine: {
          dark: "#473C18",
          light: "#C7BFA7",
          "alt-dark": "#211847",
          "alt-light": "#ADA7C7",
          other: "#182D47",
        },
      },
      aspectRatio: {
        "17/20": ".85 / 1",
      },
      flex: {
        "img-hor": "15 0 0",
        "img-ver": "7 0 0",
        "img-sqr": "10 0 0",
      },
      animation: {
        "slow-bounce": "slow-bounce 2s infinite",
        "fade-in": "fade-in 0.5s ease-in-out",
      },
      keyframes: {
        "slow-bounce": {
          "0%, 100%": {
            transform: "translateY(0)",
          },
          "50%": {
            transform: "translateY(-5px)",
          },
        },
        "fade-in": {
          "0%": {
            opacity: "0",
          },
          "100%": {
            opacity: "1",
          },
        },
      },
    },
  },
  plugins: [],
};
