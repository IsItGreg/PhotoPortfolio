/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{html,js,ts,tsx}"],
  theme: {
    extend: {
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
    },
  },
  plugins: [],
};
