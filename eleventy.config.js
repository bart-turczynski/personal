// eleventy.config.js
module.exports = function (eleventyConfig) {
  // Show a message so we know the config actually loaded
  console.log("[11ty] PassthroughCopy enabled for src/.well-known");

  // Copy src/.well-known → _site/.well-known
  eleventyConfig.addPassthroughCopy("src/.well-known");
  eleventyConfig.addPassthroughCopy({ "src/assets/icons": "" });

  return {
    dir: {
      input: "src",
      output: "_site",
      includes: "_includes",
    },
    templateFormats: ["md", "njk", "html"],
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
  };
};