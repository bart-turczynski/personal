// eleventy.config.js
const fs = require("fs");
const { execSync } = require("child_process");

function getFsMtime(inputPath) {
  try {
    // Local filesystem mtime (what you asked for)
    return fs.statSync(inputPath).mtime;
  } catch {
    return null;
  }
}

function getGitLastCommitISO(inputPath) {
  try {
    const out = execSync(`git log -1 --format=%cI -- "${inputPath}"`, {
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();
    return out || null;
  } catch {
    return null;
  }
}

function toISODateOnly(d) {
  return new Date(d).toISOString().split("T")[0]; // YYYY-MM-DD
}

module.exports = function (eleventyConfig) {
  // Show a message so we know the config actually loaded
  console.log("[11ty] PassthroughCopy enabled for src/.well-known");

  // Copy src/.well-known → _site/.well-known and icons to root
  eleventyConfig.addPassthroughCopy("src/.well-known");
  eleventyConfig.addPassthroughCopy({ "src/assets/icons/*": "/" });

  // Allow excluding pages from sitemap with front matter:
  // excludeFromSitemap: true  OR  eleventyExcludeFromCollections: true
  eleventyConfig.addFilter("isExcludedFromSitemap", (data = {}) => {
    return Boolean(data.excludeFromSitemap || data.eleventyExcludeFromCollections);
  });

  // Absolute URL builder that respects your site.url
  eleventyConfig.addFilter("absoluteUrl", (path, siteUrl) => {
    if (!siteUrl) return path;
    const u = new URL(path, siteUrl);
    return u.href;
  });

  // <lastmod> resolver:
  // Local build → file mtime (your computer)
  // CI (GitHub/Cloudflare) → git last commit date
  // Fallbacks: page.date → today
  eleventyConfig.addFilter("lastmodISO", (page) => {
    if (!page || !page.inputPath) return toISODateOnly(new Date());

    const fsMtime = getFsMtime(page.inputPath);
    if (fsMtime) return toISODateOnly(fsMtime);

    const gitISO = getGitLastCommitISO(page.inputPath);
    if (gitISO) return gitISO.split("T")[0];

    if (page.date) return toISODateOnly(page.date);
    return toISODateOnly(new Date());
  });

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