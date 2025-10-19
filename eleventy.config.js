// eleventy.config.js
module.exports = function () {
  return {
    dir: { input: "src", output: "_site", includes: "_includes" },
    templateFormats: ["md", "njk", "html"],
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk"
  };
};