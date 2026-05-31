// tailwind.config.js  (JS configs still work, but keep it minimal)
module.exports = {
  content: [
    "./index.html",
    // Include all modularized renderer scripts for Tailwind's purging
    "./renderer/**/*.js",
    "./main.js",
    "./preload.js",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
