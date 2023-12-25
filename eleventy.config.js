/** @param {import("@11ty/eleventy").UserConfig} eleventyConfig */

module.exports = function (eleventyConfig) {
  // Copy stylesheets
  eleventyConfig.addPassthroughCopy("./src/assets/css/*.css");

  return {
    dir: { input: "./src" },
  };
};
