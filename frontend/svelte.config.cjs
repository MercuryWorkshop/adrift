// DO NOT CONVERT THIS TO ESMODULES, VITE WILL BREAK
const preprocess = require("svelte-preprocess");

const config = {
  preprocess: [
    preprocess({
      postcss: true,
      typescript: true,
    }),
  ],
};

module.exports = config;
