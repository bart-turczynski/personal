// eleventy.config.js
const fs = require("fs");
const { execSync } = require("child_process");

function getFsMtime(inputPath) {
  try {
    // Local filesystem modified time (your computer)
    return fs.statSync(inputPath).mtime;
  } catch {
    return null;
  }
}

function getGitLastCommitISO(inputPath) {
  try {
    // Git commit ISO 8601 timestamp (works on GitHub/Cloudflare)
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

function toISOTimestamp(d) {
  // Full ISO 8601 (e.g., 2025-11-01T12:34:56.789Z)
  return new Date(d).toISOString();
}

module.exports = function (eleventyConfig) {
  // Show a message so we know the config actually loaded
  console.log("[11ty] PassthroughCopy enabled for src/.well-known");

  // Copy src/.well-known → _site/.well-known
  eleventyConfig.addPassthroughCopy("src/.well-known");

  // Copy icons to site root
  eleventyConfig.addPassthroughCopy({ "src/assets/icons/*": "/" });

  // Filter: exclude from sitemap via front matter
  eleventyConfig.addFilter("isExcludedFromSitemap", (data = {}) => {
    return Boolean(data.excludeFromSitemap || data.eleventyExcludeFromCollections);
  });

  // Filter: absolute URL (prepend site.url)
  eleventyConfig.addFilter("absoluteUrl", (path, siteUrl) => {
    if (!siteUrl) return path;
    const u = new URL(path, siteUrl);
    return u.href;
  });

  // Filter: last modified timestamp in ISO format
  eleventyConfig.addFilter("lastmodISO", (page) => {
    if (!page || !page.inputPath) return toISOTimestamp(new Date());

    // 1) Local mtime (your computer)
    const fsMtime = getFsMtime(page.inputPath);
    if (fsMtime) return toISOTimestamp(fsMtime);

    // 2) Git commit timestamp
    const gitISO = getGitLastCommitISO(page.inputPath);
    if (gitISO) return gitISO; // already full ISO

    // 3) Page date or now
    if (page.date) return toISOTimestamp(page.date);
    return toISOTimestamp(new Date());
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